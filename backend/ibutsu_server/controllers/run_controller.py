from datetime import datetime

import connexion
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Run
from ibutsu_server.filters import convert_filter
from ibutsu_server.tasks.runs import update_run as update_run_task
from ibutsu_server.util.projects import get_project_id


def get_run_list(filter_=None, page=1, page_size=25):
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
    :param page_size: Limit the number of results returned, defaults to 25
    :param page: Offset the results list, defaults to 0

    :rtype: List[Run]
    """
    query = Run.query
    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, Run)
            if filter_clause is not None:
                query = query.filter(filter_clause)
    offset = (page * page_size) - page_size
    total_items = query.count()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    runs = query.order_by(Run.data["start_time"].desc()).offset(offset).limit(page_size).all()
    return {
        "runs": [run.to_dict() for run in runs],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


def get_run(id_):
    """Get a run

    :param id: The ID of the run
    :type id: str

    :rtype: Run
    """
    run = Run.query.get(id_)
    return run.to_dict() if run else ("Run not found", 404)


def add_run(run=None):
    """Create a new run

    :param body: Run object
    :type body: dict | bytes

    :rtype: Run
    """
    if not connexion.request.is_json:
        return "Bad request, JSON is required", 400
    run_dict = connexion.request.get_json()
    current_time = datetime.utcnow()
    if "created" not in run_dict:
        run_dict["created"] = current_time.isoformat()
    if "start_time" not in run_dict:
        run_dict["start_time"] = current_time.timestamp()
    if run_dict.get("metadata") and run_dict.get("metadata", {}).get("project"):
        run_dict["metadata"]["project"] = get_project_id(run_dict["metadata"]["project"])
    run = Run.from_dict(run_dict)
    session.add(run)
    session.commit()
    update_run_task.apply_async((run.id,), countdown=5)
    return run.to_dict(), 201


def update_run(id_, run=None):
    """Updates a single run

    :param id: ID of run to update
    :type id: int
    :param body: Run
    :type body: dict

    :rtype: Run
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    run_dict = connexion.request.get_json()
    if run_dict.get("metadata") and run_dict.get("metadata", {}).get("project"):
        run_dict["metadata"]["project"] = get_project_id(run_dict["metadata"]["project"])
    run = Run.query.get(id_)
    if not run:
        return "Run not found", 404
    run.update(run_dict)
    session.add(run)
    session.commit()
    update_run_task.apply_async((id_,), countdown=5)
    return run.to_dict()
