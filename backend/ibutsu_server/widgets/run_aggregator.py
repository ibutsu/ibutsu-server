import time
from datetime import datetime, timedelta

from sqlalchemy import func

from ibutsu_server.db import db
from ibutsu_server.db.base import Float
from ibutsu_server.db.models import Run
from ibutsu_server.filters import apply_filters, string_to_column
from ibutsu_server.util.uuid import is_uuid


def _get_recent_run_data(weeks, group_field, project=None, additional_filters=None):
    """Get all the data from the time period and aggregate the results"""
    data = {
        "passed": {},
        "skipped": {},
        "error": {},
        "failed": {},
        "xfailed": {},
        "xpassed": {},
    }
    delta = timedelta(weeks=weeks).total_seconds()
    current_time = time.time()
    time_period_in_sec = current_time - delta

    # create filters for start time and that the group_field exists
    filters = [
        f"start_time>{datetime.utcfromtimestamp(time_period_in_sec)}",
        f"{group_field}@y",
    ]
    if additional_filters:
        filters.extend(additional_filters.split(","))
    if project and is_uuid(project):
        filters.append(f"project_id={project}")

    # generate the group field
    group_field = string_to_column(group_field, Run)

    if group_field is None:
        return data

    # create the query
    query = (
        db.select(
            group_field.label("group"),
            func.sum(Run.summary["failures"].cast(Float)).label("failed"),
            func.sum(Run.summary["errors"].cast(Float)).label("error"),
            func.sum(Run.summary["skips"].cast(Float)).label("skipped"),
            func.sum(Run.summary["tests"].cast(Float)).label("total"),
            func.sum(Run.summary["xpassed"].cast(Float)).label("xpassed"),
            func.sum(Run.summary["xfailed"].cast(Float)).label("xfailed"),
        )
        .select_from(Run)
        .group_by(group_field)
    )

    # filter the query
    query = apply_filters(query, filters, Run)

    # make the query
    query_data = db.session.execute(query).first()

    # parse the data
    if query_data:
        group = query_data.group
        failed = query_data.failed or 0
        error = query_data.error or 0
        skipped = query_data.skipped or 0
        total = query_data.total or 0
        xpassed = query_data.xpassed or 0
        xfailed = query_data.xfailed or 0
        # convert all data to percentages
        data["failed"][group] = int(round((failed / total) * 100.0))
        data["error"][group] = int(round((error / total) * 100.0))
        data["skipped"][group] = int(round((skipped / total) * 100.0))
        data["xpassed"][group] = int(round((xpassed or 0.0 / total) * 100.0))
        data["xfailed"][group] = int(round((xfailed or 0.0 / total) * 100.0))
        data["passed"][group] = int(
            100
            - (
                data["failed"][group]
                + data["error"][group]
                + data["skipped"][group]
                + data["xfailed"][group]
                + data["xpassed"][group]
            )
        )
    return data


def get_recent_run_data(
    weeks, group_field, project=None, chart_type="bar", additional_filters=None
):
    # TODO: Implement line chart by splitting weeks of data into distinct blocks of time
    data = _get_recent_run_data(weeks, group_field, project, additional_filters)
    return data
