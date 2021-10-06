from ibutsu_server.constants import HEATMAP_MAX_BUILDS
from ibutsu_server.constants import HEATMAP_RUN_LIMIT
from ibutsu_server.db.base import Float
from ibutsu_server.db.base import Integer
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Run
from ibutsu_server.filters import apply_filters
from ibutsu_server.filters import string_to_column
from sqlalchemy import case
from sqlalchemy import desc
from sqlalchemy import func

NO_RUN_TEXT = "None"
NO_PASS_RATE_TEXT = "Build failed"


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


def _get_builds(job_name, builds, project=None, additional_filters=None):
    filters = [f"metadata.jenkins.job_name={job_name}", "metadata.jenkins.build_number@y"]
    if additional_filters:
        filters.extend(additional_filters.split(","))
    if project:
        filters.append(f"project_id={project}")

    # generate the group_field
    group_field = string_to_column("metadata.jenkins.build_number", Run)

    # get the runs on which to run the aggregation, we select from a subset of runs to improve
    # performance, otherwise we'd be aggregating over ALL runs
    heatmap_run_limit = int((HEATMAP_RUN_LIMIT / HEATMAP_MAX_BUILDS) * builds)
    sub_query = (
        apply_filters(Run.query, filters, Run)
        .order_by(desc("start_time"))
        .limit(heatmap_run_limit)
        .subquery()
    )

    # create the query
    query = (
        session.query(
            func.min(Run.start_time).label("min_start_time"),
            group_field.cast(Integer).label("build_number"),
        )
        .select_entity_from(sub_query)
        .group_by("build_number")
        .order_by(desc("min_start_time"))
    )

    # add filters to the query
    query = apply_filters(query, filters, Run)

    # make the query
    builds = [build for build in query.limit(builds)]
    min_start_times = [build.min_start_time for build in builds]
    if min_start_times:
        min_start_time = min(build.min_start_time for build in builds)
    else:
        min_start_time = None
    return min_start_time, [str(build.build_number) for build in builds]


def _get_heatmap(job_name, builds, group_field, count_skips, project=None, additional_filters=None):
    """Get Jenkins Heatmap Data."""

    # Get the distinct builds that exist in the DB
    min_start_time, builds = _get_builds(job_name, builds, project, additional_filters)

    # Create the filters for the query
    filters = [
        f"metadata.jenkins.job_name={job_name}",
        f"metadata.jenkins.build_number*{';'.join(builds)}",
        f"{group_field}@y",
    ]
    if additional_filters:
        filters.extend(additional_filters.split(","))
    if min_start_time:
        filters.append(f"start_time){min_start_time}")
    if project:
        filters.append(f"project_id={project}")

    # generate the group_fields
    group_field = string_to_column(group_field, Run)
    job_name = string_to_column("metadata.jenkins.job_name", Run)
    build_number = string_to_column("metadata.jenkins.build_number", Run)
    annotations = string_to_column("metadata.annotations", Run)

    # create the base query
    query = session.query(
        Run.id.label("run_id"),
        annotations.label("annotations"),
        group_field.label("group_field"),
        job_name.label("job_name"),
        build_number.label("build_number"),
        func.sum(Run.summary["failures"].cast(Float)).label("failures"),
        func.sum(Run.summary["errors"].cast(Float)).label("errors"),
        func.sum(Run.summary["skips"].cast(Float)).label("skips"),
        func.sum(Run.summary["xfailures"].cast(Float)).label("xfailures"),
        func.sum(Run.summary["xpasses"].cast(Float)).label("xpasses"),
        func.sum(Run.summary["tests"].cast(Float)).label("total"),
    ).group_by(group_field, job_name, build_number, Run.id)

    # add filters to the query
    query = apply_filters(query, filters, Run)

    # convert the base query to a sub query
    subquery = query.subquery()

    # create the main query (this allows us to do math on the SQL side)
    if count_skips:
        passes = subquery.c.total - (
            subquery.c.errors
            + subquery.c.skips
            + subquery.c.failures
            + subquery.c.xpasses
            + subquery.c.xfailures
        )
    else:
        passes = subquery.c.total - (
            subquery.c.errors + subquery.c.failures + subquery.c.xpasses + subquery.c.xfailures
        )

    query = session.query(
        subquery.c.group_field,
        subquery.c.build_number,
        subquery.c.run_id,
        subquery.c.annotations,
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
    for datum in query_data:
        data[datum.group_field].append(
            [round(datum.pass_percent, 2), datum.run_id, datum.annotations, datum.build_number]
        )
    # compute the slope for each component
    data_with_slope = data.copy()
    for key, value in data.items():
        slope_info = _calculate_slope([v[0] for v in value])
        data_with_slope[key].insert(0, [slope_info, 0])

    return data_with_slope, builds


def _pad_heatmap(heatmap, builds_in_db):
    """Pad Jenkins runs that are not present with Null"""
    padded_dict = {}
    if not heatmap:
        return heatmap

    for group in heatmap.keys():
        # skip first item in list which contains slope info
        run_list = heatmap[group][1:]
        padded_run_list = []
        completed_runs = {run[3]: run for run in run_list}
        for build in builds_in_db:
            if build not in completed_runs.keys():
                padded_run_list.append((NO_PASS_RATE_TEXT, NO_RUN_TEXT, None, build))
            else:
                padded_run_list.append(completed_runs[build])
        # add the slope info back in
        padded_run_list.insert(0, heatmap[group][0])
        # sort the list and then write to the padded_dict
        padded_run_list.sort(key=lambda e: int(e[-1]))
        padded_dict[group] = padded_run_list
    return padded_dict


def get_jenkins_heatmap(
    job_name, builds, group_field, count_skips=False, project=None, additional_filters=None
):
    """Generate JSON data for a heatmap of Jenkins runs"""
    heatmap, builds_in_db = _get_heatmap(
        job_name, builds, group_field, count_skips, project, additional_filters
    )
    # do some postprocessing -- fill runs in which plugins failed to start with null
    heatmap = _pad_heatmap(heatmap, builds_in_db)
    return {"heatmap": heatmap}
