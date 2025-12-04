import time
from datetime import datetime, timedelta

from sqlalchemy import desc, func

from ibutsu_server.db import db
from ibutsu_server.db.models import Result
from ibutsu_server.filters import apply_filters, string_to_column
from ibutsu_server.util.uuid import is_uuid

# Default limit for filter mode to prevent excessive results
FILTER_MODE_LIMIT = 200


def _build_filters(group_field, days, project, run_id, additional_filters):
    """Build filter list for the query."""
    filters = [f"{group_field}@y"]

    if days:
        delta = timedelta(days=days).total_seconds()
        current_time = time.time()
        time_period_in_sec = current_time - delta
        filters.append(f"start_time>{datetime.utcfromtimestamp(time_period_in_sec)}")
    if additional_filters:
        filters.extend(additional_filters.split(","))
    if project and is_uuid(project):
        filters.append(f"project_id={project}")
    # Only add run_id filter if it's a valid UUID, not "undefined" or empty
    if run_id and run_id != "undefined" and run_id.strip() and is_uuid(run_id):
        filters.append(f"run_id={run_id}")

    return filters


def _get_distinct_values(group_field, filters, limit=FILTER_MODE_LIMIT):
    """Get distinct values for a field without counting - optimized for filter dropdowns."""
    group_field_column = string_to_column(group_field, Result)
    if group_field_column is None:
        return []

    # Build query with DISTINCT - filters must be applied before limit
    query = db.select(group_field_column).distinct()

    # Add filters to the query first
    query = apply_filters(query, filters, Result)

    # Apply limit last
    query = query.limit(limit)

    query_data = db.session.execute(query).scalars().all()
    # Return simple structure without counts for filter dropdowns
    return [{"_id": _id} for _id in query_data]


def _get_recent_result_data(group_field, days, project=None, run_id=None, additional_filters=None):
    """Count occurrences of distinct fields within results."""
    filters = _build_filters(group_field, days, project, run_id, additional_filters)

    # generate the group field
    group_field_column = string_to_column(group_field, Result)
    if group_field_column is None:
        return []

    # create the query
    query = (
        db.select(group_field_column, func.count(Result.id).label("count"))
        .select_from(Result)  # Explicitly select from Result to avoid implicit FROM clauses
        .group_by(group_field_column)
        .order_by(desc("count"))
    )

    # add filters to the query
    query = apply_filters(query, filters, Result)

    query_data = db.session.execute(query).all()
    # parse the data for the frontend
    return [{"_id": _id, "count": count} for _id, count in query_data]


def get_recent_result_data(
    group_field,
    days=None,
    project=None,
    run_id=None,
    additional_filters=None,
    for_filter=False,
):
    """Get aggregated result data, optionally optimized for filter dropdowns.

    :param group_field: The field to group/aggregate by
    :param days: Number of days to look back (default 90)
    :param project: Project ID to filter by
    :param run_id: Run ID to filter by
    :param additional_filters: Additional filter strings
    :param for_filter: If True, use optimized DISTINCT query without counts (faster)
    :return: List of aggregated data
    """
    # Default to 90 days if not specified to prevent full table scans
    # Only skip the default if a run_id is specified (which limits results to a specific run)
    if days is None and run_id is None:
        days = 90

    filters = _build_filters(group_field, days, project, run_id, additional_filters)

    if for_filter:
        # Use optimized distinct query for filter dropdowns
        return _get_distinct_values(group_field, filters)

    return _get_recent_result_data(
        group_field,
        days=days,
        project=project,
        run_id=run_id,
        additional_filters=additional_filters,
    )
