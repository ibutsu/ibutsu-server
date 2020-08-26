import time
from datetime import timedelta

from ibutsu_server.db.base import Float
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Run
from ibutsu_server.filters import convert_filter
from sqlalchemy import func


def _get_recent_run_data(weeks, group_field, project=None):
    """Get all the data from the time period and aggregate the results"""
    data = {"passed": {}, "skipped": {}, "error": {}, "failed": {}}
    delta = timedelta(weeks=weeks).total_seconds()
    current_time = time.time()
    time_period_in_sec = current_time - delta

    # create filters for start time and that the group_field exists
    filters = [f"start_time>{time_period_in_sec}", f"{group_field}@y"]
    if project:
        filters.append(f"metadata.project={project}")

    # generate the group field
    group_fields = group_field.split(".")
    group_field = Run.data
    for group in group_fields:
        group_field = group_field[group]

    # create the query
    query = session.query(
        group_field,
        func.sum(Run.data["summary"]["failures"].cast(Float)),
        func.sum(Run.data["summary"]["errors"].cast(Float)),
        func.sum(Run.data["summary"]["skips"].cast(Float)),
        func.sum(Run.data["summary"]["tests"].cast(Float)),
    ).group_by(group_field)

    # filter the query
    for filter_string in filters:
        filter_clause = convert_filter(filter_string, Run)
        if filter_clause is not None:
            query = query.filter(filter_clause)

    # make the query
    query_data = query.all()

    # parse the data
    for group, failed, error, skipped, total in query_data:
        # convert all data to percentages
        data["failed"][group] = int(round((failed / total) * 100.0))
        data["error"][group] = int(round((error / total) * 100.0))
        data["skipped"][group] = int(round((skipped / total) * 100.0))
        data["passed"][group] = int(
            100 - (data["failed"][group] + data["error"][group] + data["skipped"][group])
        )
    return data


def get_recent_run_data(weeks, group_field, project=None, chart_type="bar"):
    # TODO: Implement line chart by splitting weeks of data into distinct blocks of time
    data = _get_recent_run_data(weeks, group_field, project)
    return data
