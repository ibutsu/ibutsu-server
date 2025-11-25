from datetime import datetime
from http import HTTPStatus

import connexion

from ibutsu_server.constants import RESPONSE_JSON_REQ
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Result, User
from ibutsu_server.filters import convert_filter, has_project_filter
from ibutsu_server.util import merge_dicts
from ibutsu_server.util.count import get_count_estimate
from ibutsu_server.util.projects import add_user_filter, get_project, project_has_user
from ibutsu_server.util.query import get_offset, query_as_task
from ibutsu_server.util.uuid import validate_uuid


def _validate_and_set_project(result, user):
    """Validate and set project for a result.

    Returns error response tuple if validation fails, None otherwise.
    """
    if result.data and not result.data.get("project") and not result.project_id:
        return "Bad request, project or project_id is required", HTTPStatus.BAD_REQUEST

    if not result.project:
        # Get project from metadata or project_id (get_project handles both names and UUIDs)
        if result.data and result.data.get("project"):
            project = get_project(result.data["project"])
        elif result.project_id:
            project = get_project(result.project_id)
        else:
            return "Bad request, project or project_id is required", HTTPStatus.BAD_REQUEST

        if not project:
            return "Invalid project", HTTPStatus.BAD_REQUEST
        if not project_has_user(project, user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
        result.project = project

    return None


def add_result(result=None, token_info=None, user=None):
    """Creates a test result

    :param result: Result item
    :type result: dict | bytes

    :rtype: Result
    """
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    result_data = result if result is not None else connexion.request.get_json()
    result = Result.from_dict(**result_data)

    # Validate result doesn't already exist
    if result.id and Result.query.get(result.id):
        return f"Result id {result.id} already exist", HTTPStatus.BAD_REQUEST

    # Validate and get project
    error_response = _validate_and_set_project(result, user)
    if error_response:
        return error_response

    # promote user_properties to the level of metadata
    if result.data and result.data.get("user_properties"):
        user_properties = result.data.pop("user_properties")
        merge_dicts(user_properties, result.data)

    # promote some fields to their own column
    result.env = result.data.get("env") if result.data else None
    result.component = result.data.get("component") if result.data else None
    result.run_id = result.data.get("run") if result.data else None
    result.start_time = result.start_time if result.start_time else datetime.utcnow()

    session.add(result)
    session.commit()
    return result.to_dict(), HTTPStatus.CREATED


@query_as_task
def get_result_list(filter_=None, page=1, page_size=25, estimate=False, token_info=None, user=None):
    """Gets all results

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

    Note:

    For the `$exists` operator, "true", "t", "yes", "y" and `1` will all be considered true,
    all other values are considered false.


    Example queries:

        /result?filter=metadata.run=63fe5
        /result?filter=test_id~neg
        /result?filter=result!passed


    :param filter: A list of filters to apply
    :param pageSize: Limit the number of results returned, defaults to 25
    :param page: Offset the results list, defaults to 0
    :param apply_max: Avoid counting the total number of documents, which speeds up the query,
                            but has the drawback of only returning the MAX_DOCUMENTS
                            most recent results.

    :rtype: List[Result]
    """
    requesting_user = User.query.get(user)

    # Validate query scope to prevent full table scans
    # If user is superadmin or query is not properly scoped by user projects,
    # require a project filter to prevent timeout
    query_has_project_filter = has_project_filter(filter_)
    if requesting_user and requesting_user.is_superadmin and not query_has_project_filter:
        return (
            "Bad request, project_id filter is required for unscoped queries",
            HTTPStatus.BAD_REQUEST,
        )

    query = Result.query
    if requesting_user:
        query = add_user_filter(query, requesting_user, model=Result)
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
            filter_clause = convert_filter(filter_string, Result)
            if filter_clause is not None:
                query = query.filter(filter_clause)

    total_items = get_count_estimate(query) if estimate else query.count()

    offset = get_offset(page, page_size)
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)

    results = query.order_by(Result.start_time.desc()).offset(offset).limit(page_size).all()
    return {
        "results": [result.to_dict() for result in results],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


@validate_uuid
def get_result(id_, token_info=None, user=None):
    """Get a single result

    :param id: ID of Result to return
    :type id: int

    :rtype: Result
    """
    result = Result.query.get(id_)
    if not result:
        return "Result not found", HTTPStatus.NOT_FOUND
    if not project_has_user(result.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    return result.to_dict()


@validate_uuid
def update_result(id_, result=None, token_info=None, user=None, **_kwargs):
    """Updates a single result

    :param id: ID of result to update
    :type id: int
    :param result: Result
    :type result: dict

    :rtype: Result
    """
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    result_data = result if result is not None else connexion.request.get_json()
    if result_data.get("metadata", {}).get("project"):
        project = get_project(result_data["metadata"]["project"])
        if not project_has_user(project, user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
        if project:
            result_data["project_id"] = project.id

    # promote user_properties to the level of metadata
    if result_data.get("metadata", {}).get("user_properties"):
        user_properties = result_data["metadata"].pop("user_properties")
        merge_dicts(user_properties, result_data["metadata"])

    result_obj = Result.query.get(id_)
    if not result_obj:
        return "Result not found", HTTPStatus.NOT_FOUND
    if not project_has_user(result_obj.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    result_obj.update(result_data)
    result_obj.env = result_obj.data.get("env") if result_obj.data else None
    result_obj.component = result_obj.data.get("component") if result_obj.data else None
    session.add(result_obj)
    session.commit()
    return result_obj.to_dict()
    result.env = result.data.get("env") if result.data else None
    result.component = result.data.get("component") if result.data else None
    session.add(result)
    session.commit()
    return result.to_dict()
