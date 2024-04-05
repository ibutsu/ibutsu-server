import time
from datetime import datetime
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
        return days**5


def _get_recent_result_data(group_field, days, project=None, run_id=None, additional_filters=None):
    """Count occurrences of distinct fields within results."""
    filters = [f"{group_field}@y"]

    if days:
        delta = timedelta(days=days).total_seconds()
        current_time = time.time()
        time_period_in_sec = current_time - delta
        # create filters for the start time and that the group_field exists
        filters.append(f"start_time>{datetime.utcfromtimestamp(time_period_in_sec)}")
    if additional_filters:
        filters.extend(additional_filters.split(","))
    if project:
        filters.append(f"project_id={project}")
    if run_id:
        filters.append(f"run_id={run_id}")

    # generate the group field
    group_field = string_to_column(group_field, Result)
    if not group_field:
        return []

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


def get_recent_result_data(
    group_field, days=None, project=None, chart_type="pie", run_id=None, additional_filters=None
):
    data = _get_recent_result_data(
        group_field,
        days=days,
        project=project,
        run_id=run_id,
        additional_filters=additional_filters,
    )
    return data
