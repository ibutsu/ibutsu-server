from ibutsu_server.db.models import Result
from ibutsu_server.db.models import Run
from ibutsu_server.db.models import User
from ibutsu_server.filters import convert_filter
from ibutsu_server.tasks import task
from ibutsu_server.util.count import get_count_estimate
from ibutsu_server.util.projects import add_user_filter


TABLENAME_TO_MODEL = {"results": Result, "runs": Run}


@task
def query_task(filter_=None, page=1, page_size=25, estimate=False, user=None, tablename="results"):
    """
    Run a large query as a task.
    """
    model = TABLENAME_TO_MODEL[tablename]
    user = User.query.get(user)
    query = model.query

    if user:
        query = add_user_filter(query, user, filter_=filter_, model=model)

    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, model)
            if filter_clause is not None:
                query = query.filter(filter_clause)

    if estimate:
        total_items = get_count_estimate(query, model=model)
    else:
        total_items = query.count()

    offset = (page * page_size) - page_size
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)

    data = query.order_by(model.start_time.desc()).offset(offset).limit(page_size).all()
    return {
        tablename: [datum.to_dict() for datum in data],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }
