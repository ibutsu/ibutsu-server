from datetime import datetime
from http import HTTPStatus

import connexion

from ibutsu_server.constants import RESPONSE_JSON_REQ
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Run, User
from ibutsu_server.filters import convert_filter
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
    user = User.query.get(user)
    query = Run.query
    if user:
        query = add_user_filter(query, user, model=Run)

    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, Run)
            if filter_clause is not None:
                query = query.filter(filter_clause)

    if estimate:
        total_items = get_count_estimate(query)
    else:
        total_items = query.count()

    offset = get_offset(page, page_size)
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    runs = query.order_by(Run.start_time.desc()).offset(offset).limit(page_size).all()
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
    run = Run.query.get(id_)
    if not run:
        return "Run not found", HTTPStatus.NOT_FOUND
    if not project_has_user(run.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    return run.to_dict()


def add_run(run=None, token_info=None, user=None):
    """Create a new run

    :param body: Run object
    :type body: dict | bytes

    :rtype: Run
    """
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    run = Run.from_dict(**connexion.request.get_json())

    if not run.data:
        return "Bad request, no data supplied", HTTPStatus.BAD_REQUEST

    if run.data and not (run.data.get("project") or run.project_id):
        return "Bad request, project or project_id is required", HTTPStatus.BAD_REQUEST

    project = get_project(run.data["project"])
    if not project:
        return "Invalid project", HTTPStatus.BAD_REQUEST
    if not project_has_user(project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    run.project = project
    run.env = run.data.get("env") if run.data else None
    run.component = run.data.get("component") if run.data else None
    # allow start_time to be set by update_run task if no start_time present
    run.start_time = run.start_time if run.start_time else datetime.utcnow()
    # if not present, created is the time at which the run is added to the DB
    run.created = run.created if run.created else datetime.utcnow()

    session.add(run)
    session.commit()
    update_run_task.apply_async((run.id,), countdown=5)
    return run.to_dict(), HTTPStatus.CREATED


@validate_uuid
def update_run(id_, run=None, body=None, token_info=None, user=None):
    """Updates a single run

    :param id: ID of run to update
    :type id: int
    :param body: Run
    :type body: dict

    :rtype: Run
    """
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    run_dict = connexion.request.get_json()
    if run_dict.get("metadata", {}).get("project"):
        run_dict["project_id"] = get_project_id(run_dict["metadata"]["project"])
        if not project_has_user(run_dict["project_id"], user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    run = Run.query.get(id_)
    if run and not project_has_user(run.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    if not run:
        return "Run not found", HTTPStatus.NOT_FOUND
    run.update(run_dict)
    session.add(run)
    session.commit()
    update_run_task.apply_async((id_,), countdown=5)
    return run.to_dict()


def bulk_update(filter_=None, page_size=1, token_info=None, user=None):
    """Updates multiple runs with common metadata

    Note: can only be used to update metadata on runs, limited to 25 runs

    :param filter_: A list of filters to apply
    :param page_size: Limit the number of runs updated, defaults to 1

    :rtype: List[Run]
    """
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ

    run_dict = connexion.request.get_json()

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
        run = Run.query.get(run_json.get("id"))
        # update the json dict of the run with the new metadata
        merge_dicts(run_dict, run_json)
        run.update(run_json)
        session.add(run)
        model_runs.append(run)
    session.commit()

    return [run.to_dict() for run in model_runs]
