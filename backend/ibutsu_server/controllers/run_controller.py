from datetime import UTC, datetime
from http import HTTPStatus

from flask import request

from ibutsu_server.constants import RESPONSE_JSON_REQ
from ibutsu_server.db import db
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Run, User
from ibutsu_server.filters import convert_filter, has_project_filter
from ibutsu_server.tasks.runs import update_run as update_run_task
from ibutsu_server.util import merge_dicts
from ibutsu_server.util.count import get_count_estimate
from ibutsu_server.util.projects import (
    add_user_filter,
    get_project,
    get_project_id,
    project_has_user,
)
from ibutsu_server.util.query import get_offset, query_as_task
from ibutsu_server.util.uuid import validate_uuid


def _validate_and_get_project(run, user):
    """Validate and get project for a run.

    Returns (project, error_response) tuple.
    If validation fails, project is None and error_response contains the error.
    If validation succeeds, project is set and error_response is None.
    """
    if not run.data:
        return None, ("Bad request, no data supplied", HTTPStatus.BAD_REQUEST)

    if run.data and not (run.data.get("project") or run.project_id):
        return None, ("Bad request, project or project_id is required", HTTPStatus.BAD_REQUEST)

    # Get project from metadata or project_id (get_project handles both names and UUIDs)
    if run.data and run.data.get("project"):
        project = get_project(run.data["project"])
    elif run.project_id:
        project = get_project(run.project_id)
    else:
        return None, ("Bad request, project or project_id is required", HTTPStatus.BAD_REQUEST)

    if not project:
        return None, ("Invalid project", HTTPStatus.BAD_REQUEST)
    if not project_has_user(project, user):
        return None, (HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN)

    return project, None


@query_as_task
def get_run_list(filter_=None, page=1, page_size=25, estimate=False, token_info=None, user=None):
    """Get a list of runs

    The `filter` parameter takes a list of filters to apply in the form of:

        {name}{operator}{value}

    where:

      - `name` is any valid column in the database
      - `operator` is one of `=`, `!`, `>`, `<`, `)`, `(`, `~`, `*`
      - `value` is what you want to filter by

    Operators are simple correspondents to MongoDB's query selectors:

      - `=` becomes `$eq`
      - `!` becomes `$ne`
      - `>` becomes `$gt`
      - `<` becomes `$lt`
      - `)` becomes `$gte`
      - `(` becomes `$lte`
      - `~` becomes `$regex`
      - `*` becomes `$in`
      - `@` becomes `$exists`

    Notes:

    - For the `$exists` operator, "true", "t", "yes", "y" and `1` will all be considered true,
      all other values are considered false.

    Example queries:

        /result?filter=metadata.run=63fe5
        /result?filter=test_id~neg
        /result?filter=result!passed


    :param filter: A list of filters to apply
    :param page_size: Limit the number of runs returned, defaults to 25
    :param page: Offset the runs list, defaults to 0
    :param estimate: Estimate the count of runs, defaults to False

    :rtype: List[Run]
    """
    requesting_user = db.session.get(User, user)

    # Validate query scope to prevent full table scans
    # If user is superadmin or query is not properly scoped by user projects,
    # require a project filter to prevent timeout
    query_has_project_filter = has_project_filter(filter_)
    if requesting_user and requesting_user.is_superadmin and not query_has_project_filter:
        return (
            "Bad request, project_id filter is required for unscoped queries",
            HTTPStatus.BAD_REQUEST,
        )

    query = db.select(Run)
    if requesting_user:
        query = add_user_filter(query, requesting_user, model=Run)
        # For non-superadmin users without projects, require project filter
        if (
            not requesting_user.is_superadmin
            and not requesting_user.projects
            and not query_has_project_filter
        ):
            return (
                "Bad request, project_id filter is required",
                HTTPStatus.BAD_REQUEST,
            )

    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, Run)
            if filter_clause is not None:
                query = query.where(filter_clause)

    if estimate:
        total_items = get_count_estimate(query)
    else:
        total_items = db.session.execute(
            db.select(db.func.count()).select_from(query.subquery())
        ).scalar()

    offset = get_offset(page, page_size)
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    runs = db.session.scalars(
        query.order_by(Run.start_time.desc()).offset(offset).limit(page_size)
    ).all()
    return {
        "runs": [run.to_dict() for run in runs],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


@validate_uuid
def get_run(id_, token_info=None, user=None):
    """Get a run

    :param id: The ID of the run
    :type id: str

    :rtype: Run
    """
    run = db.session.get(Run, id_)
    if not run:
        return "Run not found", HTTPStatus.NOT_FOUND
    if not project_has_user(run.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    return run.to_dict()


def add_run(body=None, token_info=None, user=None):
    """Create a new run

    :param body: Run object
    :type body: dict | bytes

    :rtype: Run
    """
    if not request.is_json:
        return RESPONSE_JSON_REQ
    # Use body parameter if provided, otherwise get from request
    body_data = body if body is not None else request.get_json()
    run = Run.from_dict(**body_data)

    # Validate and get project
    project, error_response = _validate_and_get_project(run, user)
    if error_response:
        return error_response
    run.project = project
    run.env = run.data.get("env") if run.data else None
    run.component = run.data.get("component") if run.data else None
    # allow start_time to be set by update_run task if no start_time present
    run.start_time = run.start_time if run.start_time else datetime.now(UTC)
    # if not present, created is the time at which the run is added to the DB
    run.created = run.created if run.created else datetime.now(UTC)

    session.add(run)
    session.commit()
    update_run_task.apply_async((run.id,), countdown=5)
    return run.to_dict(), HTTPStatus.CREATED


@validate_uuid
def update_run(id_, body=None, token_info=None, user=None):
    """Updates a single run

    :param id: ID of run to update
    :type id: int
    :param body: Run
    :type body: dict

    :rtype: Run
    """
    if not request.is_json:
        return RESPONSE_JSON_REQ
    # Use body parameter if provided, otherwise get from request
    body_data = body if body is not None else request.get_json()
    if body_data.get("metadata", {}).get("project"):
        body_data["project_id"] = get_project_id(body_data["metadata"]["project"])
        if not project_has_user(body_data["project_id"], user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    run = db.session.get(Run, id_)
    if run and not project_has_user(run.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    if not run:
        return "Run not found", HTTPStatus.NOT_FOUND
    run.update(body_data)
    session.add(run)
    session.commit()
    update_run_task.apply_async((id_,), countdown=5)
    return run.to_dict()


def bulk_update(filter_=None, page_size=1, body=None, token_info=None, user=None):
    """Updates multiple runs with common metadata

    Note: can only be used to update metadata on runs, limited to 25 runs

    :param filter_: A list of filters to apply
    :param page_size: Limit the number of runs updated, defaults to 1

    :rtype: List[Run]
    """
    if not request.is_json:
        return RESPONSE_JSON_REQ

    # Use body parameter if provided, otherwise get from request
    run_dict = body if body is not None else request.get_json()

    if not run_dict.get("metadata"):
        return "Bad request, can only update metadata", HTTPStatus.UNAUTHORIZED

    # ensure only metadata is updated
    run_dict = {"metadata": run_dict.pop("metadata")}

    if page_size > 25:
        return (
            "Bad request, cannot update more than 25 runs at a time",
            HTTPStatus.METHOD_NOT_ALLOWED,
        )

    if run_dict.get("metadata", {}).get("project"):
        project = get_project(run_dict["metadata"]["project"])
        if not project_has_user(project, user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
        run_dict["project_id"] = project.id

    runs = get_run_list(filter_=filter_, page_size=page_size, estimate=True).get("runs")

    if not runs:
        return f"No runs found with {filter_}", HTTPStatus.NOT_FOUND

    model_runs = []
    for run_json in runs:
        run = db.session.get(Run, run_json.get("id"))
        # update the json dict of the run with the new metadata
        merge_dicts(run_dict, run_json)
        run.update(run_json)
        session.add(run)
        model_runs.append(run)
    session.commit()

    return [run.to_dict() for run in model_runs]
