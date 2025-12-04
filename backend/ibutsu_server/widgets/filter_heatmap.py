from sqlalchemy import case, desc, func

from ibutsu_server.constants import HEATMAP_MAX_BUILDS, HEATMAP_RUN_LIMIT
from ibutsu_server.db import db
from ibutsu_server.db.base import Float
from ibutsu_server.db.models import Run
from ibutsu_server.filters import apply_filters, string_to_column
from ibutsu_server.util.uuid import is_uuid

NO_RUN_TEXT = "None"
NO_PASS_RATE_TEXT = "Build failed"  # noqa: S105


def _calculate_slope(x_data):
    """Calculate the trend slope of the data

    :param x_data: A list of the result percentages, e.g. [98, 54, 97, 99]
    :type x_data: list

    :rtype float:
    """
    if all(x == 100 for x in x_data):
        return 100
    y_data = list(range(len(x_data)))
    x_avg = sum(x_data) / len(x_data)
    y_avg = sum(y_data) / len(y_data)
    try:
        slope = sum((x - x_avg) * (y - y_avg) for x, y in zip(x_data, y_data, strict=False)) / sum(
            (x - x_avg) ** 2 for x in x_data
        )
    except ZeroDivisionError:
        slope = 0
    return slope


def _get_heatmap(additional_filters, builds, group_field, project=None):
    """Get Filtered Heatmap Data."""
    filters = additional_filters.split(",")
    if project and is_uuid(project):
        filters.append(f"project_id={project}")

    # generate the group_field
    group_field_col = string_to_column(group_field, Run)
    if group_field_col is None:
        return {}

    # get the runs on which to run the aggregation, we select from a subset of runs to improve
    # performance, otherwise we'd be aggregating over ALL runs
    heatmap_run_limit = int((HEATMAP_RUN_LIMIT / HEATMAP_MAX_BUILDS) * builds)

    # Build query with explicit column selection to avoid cartesian product later
    # We need to explicitly select the group_field with a label
    # so we can reference it from the subquery later
    base_query = db.select(
        Run.id,
        Run.start_time,
        Run.summary,
        group_field_col.label("group_field_value"),
    ).select_from(Run)

    # Apply filters
    base_query = apply_filters(base_query, filters, Run)
    sub_query = base_query.order_by(desc("start_time")).limit(heatmap_run_limit).subquery()

    # Now reference columns from the subquery to avoid cartesian product
    query = (
        db.select(
            sub_query.c.id.label("run_id"),
            sub_query.c.group_field_value.label("group_field"),
            sub_query.c.start_time.label("start_time"),
            func.sum(sub_query.c.summary["failures"].cast(Float)).label("failures"),
            func.sum(sub_query.c.summary["errors"].cast(Float)).label("errors"),
            func.sum(sub_query.c.summary["skips"].cast(Float)).label("skips"),
            func.sum(sub_query.c.summary["xfailures"].cast(Float)).label("xfailures"),
            func.sum(sub_query.c.summary["xpasses"].cast(Float)).label("xpasses"),
            func.sum(sub_query.c.summary["tests"].cast(Float)).label("total"),
        )
        .select_from(sub_query)
        .group_by(sub_query.c.group_field_value, sub_query.c.id, sub_query.c.start_time)
        .order_by(desc("start_time"))
    )

    # convert the base query to a sub query
    subquery = query.subquery()

    # create the main query (this allows us to do math on the SQL side)
    passes = subquery.c.total - (
        subquery.c.errors + subquery.c.failures + subquery.c.xpasses + subquery.c.xfailures
    )

    # Create a fresh select that only uses the subquery, to avoid cartesian product
    query = db.select(
        subquery.c.group_field,
        subquery.c.run_id,
        subquery.c.start_time,
        # handle potential division by 0 errors, if the total is 0, set the pass_percent to 0
        case(
            (subquery.c.total == 0, 0),
            else_=(100 * passes / subquery.c.total),
        ).label("pass_percent"),
    ).select_from(subquery)

    # parse the data for the frontend
    query_data = db.session.execute(query).all()
    data = {datum.group_field: [] for datum in query_data}
    for key, value in data.items():
        runs = [run for run in query_data if run.group_field == key]
        runs.sort(key=lambda run: run.start_time)
        for i, datum in enumerate(query_data):
            if datum.group_field == key and len(value) < builds:
                value.insert(0, [round(datum.pass_percent, 2), datum.run_id, None, str(i + 1)])
    # compute the slope for each component
    data_with_slope = data.copy()
    for key, value in data.items():
        slope_info = _calculate_slope([v[0] for v in value])
        data_with_slope[key].insert(0, [slope_info, 0])

    return data_with_slope


def get_filter_heatmap(additional_filters, builds, group_field, project=None):
    """Generate JSON data for a filtered heatmap of runs"""
    heatmap = _get_heatmap(additional_filters, builds, group_field, project)
    return {"heatmap": heatmap}
