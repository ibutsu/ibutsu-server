import time
from datetime import datetime, timedelta

from sqlalchemy import desc, func

from ibutsu_server.db.base import session
from ibutsu_server.db.models import Result
from ibutsu_server.filters import apply_filters, string_to_column
from ibutsu_server.util.uuid import is_uuid


def _get_min_count(days):
    if days <= 1:
        return 2e2 * days
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
    if project and is_uuid(project):
        filters.append(f"project_id={project}")
    if run_id and is_uuid(run_id):
        filters.append(f"run_id={run_id}")

    # generate the group field
    group_field = string_to_column(group_field, Result)
    if group_field is None:
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
    return [{"_id": _id, "count": count} for _id, count in query_data]


def get_recent_result_data(
    group_field,
    days=None,
    project=None,
    run_id=None,
    additional_filters=None,
):
    # Default to 90 days if not specified to prevent full table scans
    # Only skip the default if a run_id is specified (which limits results to a specific run)
    if days is None and run_id is None:
        days = 90

    return _get_recent_result_data(
        group_field,
        days=days,
        project=project,
        run_id=run_id,
        additional_filters=additional_filters,
    )
