from sqlalchemy import case, desc, func

from ibutsu_server.constants import HEATMAP_MAX_BUILDS, HEATMAP_RUN_LIMIT
from ibutsu_server.db.base import Float, session
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
        slope = sum((x - x_avg) * (y - y_avg) for x, y in zip(x_data, y_data)) / sum(
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
    group_field = string_to_column(group_field, Run)
    if group_field is None:
        return {}

    # get the runs on which to run the aggregation, we select from a subset of runs to improve
    # performance, otherwise we'd be aggregating over ALL runs
    heatmap_run_limit = int((HEATMAP_RUN_LIMIT / HEATMAP_MAX_BUILDS) * builds)
    sub_query = (
        apply_filters(Run.query, filters, Run)
        .order_by(desc("start_time"))
        .limit(heatmap_run_limit)
        .subquery()
    )

    query = (
        session.query(
            Run.id.label("run_id"),
            group_field.label("group_field"),
            Run.start_time.label("start_time"),
            func.sum(Run.summary["failures"].cast(Float)).label("failures"),
            func.sum(Run.summary["errors"].cast(Float)).label("errors"),
            func.sum(Run.summary["skips"].cast(Float)).label("skips"),
            func.sum(Run.summary["xfailures"].cast(Float)).label("xfailures"),
            func.sum(Run.summary["xpasses"].cast(Float)).label("xpasses"),
            func.sum(Run.summary["tests"].cast(Float)).label("total"),
        )
        .select_entity_from(sub_query)
        .order_by(desc("start_time"))
        .group_by(group_field, Run.id, Run.start_time)
    )

    # add filters to the query
    query = apply_filters(query, filters, Run)

    # convert the base query to a sub query
    subquery = query.subquery()

    # create the main query (this allows us to do math on the SQL side)
    passes = subquery.c.total - (
        subquery.c.errors + subquery.c.failures + subquery.c.xpasses + subquery.c.xfailures
    )

    query = session.query(
        subquery.c.group_field,
        subquery.c.run_id,
        subquery.c.start_time,
        # handle potential division by 0 errors, if the total is 0, set the pass_percent to 0
        case(
            [
                (subquery.c.total == 0, 0),
            ],
            else_=(100 * passes / subquery.c.total),
        ).label("pass_percent"),
    )

    # parse the data for the frontend
    query_data = query.all()
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
