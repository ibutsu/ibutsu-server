from datetime import datetime

import connexion
from ibutsu_server.constants import COUNT_TIMEOUT
from ibutsu_server.constants import MAX_DOCUMENTS
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Result
from ibutsu_server.filters import convert_filter
from ibutsu_server.util.projects import get_project_id
from sqlalchemy.exc import OperationalError


def add_result(result=None):
    """Creates a test result

    :param body: Result item
    :type body: dict | bytes

    :rtype: Result
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    result = Result.from_dict(**connexion.request.get_json())
    if result.data and result.data.get("project"):
        result.project_id = get_project_id(result.data["project"])
    result.env = result.data.get("env") if result.data else None
    result.component = result.data.get("component") if result.data else None
    result.run_id = result.data.get("run") if result.data else None
    result.start_time = result.start_time if result.start_time else datetime.utcnow()

    session.add(result)
    session.commit()
    return result.to_dict(), 201


def get_result_list(filter_=None, page=1, page_size=25, apply_max=False):
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
    query = Result.query
    count_estimate = None
    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, Result)
            if filter_clause is not None:
                query = query.filter(filter_clause)
    else:
        # use a count estimate when no filter is applied
        count_estimate = int(
            session.execute(
                "SELECT reltuples as approx_count FROM pg_class WHERE relname='results'"
            ).fetchall()[0][0]
        )

    offset = (page * page_size) - page_size
    if not count_estimate:
        try:
            # if the count is fast, just use it! Even if apply_max is set to true
            session.execute(f"SET statement_timeout TO {int(COUNT_TIMEOUT*1000)}; commit;")
            total_items = query.count()
        except OperationalError:
            # reset the timeout if we hit an exception
            session.execute("SET statement_timeout TO 0; commit;")
            if apply_max:
                print(
                    f"FunctionTimedOut: 'query.count' with filters: {filter_} timed out, "
                    f"using default items of {MAX_DOCUMENTS}"
                )
                if offset > MAX_DOCUMENTS:
                    raise ValueError(
                        f"Offset: {offset} exceeds the "
                        f"MAX_DOCUMENTS: {MAX_DOCUMENTS} able to be displayed in the UI. "
                        f"Please use the API for this request."
                    )
                total_items = MAX_DOCUMENTS
            else:
                print(
                    f"FunctionTimedOut: 'query.count' with args: {filter_} timed out, "
                    f"but limit_documents is set to False, proceeding"
                )
                # if we don't want to limit documents, just do the standard count
                total_items = query.count()
        else:
            # reset the timeout if we don't hit an exception
            session.execute("SET statement_timeout TO 0; commit;")
    else:
        total_items = count_estimate

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


def get_result(id_):
    """Get a single result

    :param id: ID of Result to return
    :type id: int

    :rtype: Result
    """
    result = Result.query.get(id_)
    return (result.to_dict(), 200) if result else ("Result not found", 404)


def update_result(id_, result=None):
    """Updates a single result

    :param id: ID of result to update
    :type id: int
    :param body: Result
    :type body: dict

    :rtype: Result
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    result_dict = connexion.request.get_json()
    if result_dict.get("metadata", {}).get("project"):
        result_dict["project_id"] = get_project_id(result_dict["metadata"]["project"])
    result = Result.query.get(id_)
    if not result:
        return "Result not found", 404
    result.update(result_dict)
    result.env = result.data.get("env") if result.data else None
    result.component = result.data.get("component") if result.data else None
    session.add(result)
    session.commit()
    return result.to_dict()
