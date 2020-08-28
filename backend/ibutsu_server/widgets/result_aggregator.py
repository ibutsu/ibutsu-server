import time
from datetime import timedelta

from ibutsu_server.db.base import session
from ibutsu_server.db.models import Result
from ibutsu_server.filters import apply_filters
from ibutsu_server.filters import string_to_column
from sqlalchemy import desc
from sqlalchemy import func


def _get_min_count(days):
    if days <= 1:
        return 2e2 * days
    else:
        return days ** 5


def _get_recent_result_data(days, group_field, project=None):
    """ Count occurrences of distinct fields within results.
    """
    delta = timedelta(days=days).total_seconds()
    current_time = time.time()
    time_period_in_sec = current_time - delta

    # create filters for the start time and that the group_field exists
    filters = [f"start_time>{time_period_in_sec}", f"{group_field}@y"]
    if project:
        filters.append(f"metadata.project={project}")

    # generate the group field
    group_field = string_to_column(group_field, Result)

    # create the query
    query = (
        session.query(group_field, func.count(Result.id).label("count"))
        .group_by(group_field)
        .order_by(desc("count"))
    )

    # add filters to the query
    query = apply_filters(query, filters, Result)

    query_data = query.all()
    # parse the data for the frontend
    data = [{"_id": _id, "count": count} for _id, count in query_data]
    return data


def get_recent_result_data(days, group_field, project=None, chart_type="pie"):
    data = _get_recent_result_data(days, group_field, project)
    return data
