from sqlalchemy import desc, func

from ibutsu_server.db import db
from ibutsu_server.db.base import Float, Integer
from ibutsu_server.db.models import Run
from ibutsu_server.filters import apply_filters, string_to_column
from ibutsu_server.util.uuid import is_uuid
from ibutsu_server.util.widget import (
    create_basic_summary_columns,
    create_jenkins_columns,
    create_summary_columns,
)

NO_RUN_TEXT = "None"
NO_PASS_RATE_TEXT = "Build failed"  # noqa: S105


def _calculate_slope(pass_percentages):
    """Calculate the trend slope of the data using linear regression

    :param pass_percentages: A list of pass percentages in chronological order, e.g. [98, 54, 97, 99]
    :type pass_percentages: list

    :rtype float:
    """
    if not pass_percentages or len(pass_percentages) < 2:
        return 0

    # Special case: if all values are 100%, return 100 for stable trend
    if all(x == 100 for x in pass_percentages):
        return 100

    # Use time sequence as x-values (independent variable)
    # Pass percentages as y-values (dependent variable)
    x_values = list(range(len(pass_percentages)))  # [0, 1, 2, 3, ...]
    y_values = pass_percentages  # [98, 54, 97, 99]

    n = len(x_values)
    x_avg = sum(x_values) / n
    y_avg = sum(y_values) / n

    try:
        # Linear regression slope formula: slope = Σ((x-x̄)(y-ȳ)) / Σ((x-x̄)²)
        numerator = sum((x - x_avg) * (y - y_avg) for x, y in zip(x_values, y_values))
        denominator = sum((x - x_avg) ** 2 for x in x_values)

        if denominator == 0:
            return 0

        slope = numerator / denominator

        # Scale the slope to be more interpretable for the frontend
        # Positive slope = upward trend, negative slope = downward trend
        return slope

    except ZeroDivisionError:
        return 0


def _get_builds(job_name, builds, project=None, additional_filters=None):
    """Get available builds for the given job"""
    filters = [
        f"metadata.jenkins.job_name={job_name}",
        "metadata.jenkins.build_number@y",
    ]
    if additional_filters:
        filters.extend(additional_filters.split(","))
    if project and is_uuid(project):
        filters.append(f"project_id={project}")

    # Generate the build number column reference
    build_number_col = string_to_column("metadata.jenkins.build_number", Run)

    # Create a single query to get recent builds with their min start times
    query = db.select(
        func.min(Run.start_time).label("min_start_time"),
        build_number_col.cast(Integer).label("build_number"),
    ).select_from(Run)

    # Apply filters
    query = apply_filters(query, filters, Run)

    # Group and order to get the most recent builds
    query = (
        query.group_by(build_number_col.cast(Integer))
        .order_by(desc("min_start_time"))
        .limit(builds)
    )

    # Execute the query and extract results
    build_results = db.session.execute(query).all()

    if not build_results:
        return None, []

    build_numbers = [str(result.build_number) for result in build_results]
    min_start_time = min(result.min_start_time for result in build_results)

    return min_start_time, build_numbers


def _get_heatmap(job_name, builds, group_field, count_skips, project=None, additional_filters=None):
    """Get Jenkins Heatmap Data"""

    # Get the distinct builds that exist in the DB
    min_start_time, build_numbers = _get_builds(job_name, builds, project, additional_filters)

    if not build_numbers:
        return {}, []

    # Create the filters for the main heatmap query
    filters = [
        f"metadata.jenkins.job_name={job_name}",
        f"metadata.jenkins.build_number*{';'.join(build_numbers)}",
        f"{group_field}@y",
    ]
    if additional_filters:
        filters.extend(additional_filters.split(","))
    if min_start_time:
        filters.append(f"start_time>{min_start_time}")
    if project and is_uuid(project):
        filters.append(f"project_id={project}")

    # Get column references using helper function
    jenkins_cols = create_jenkins_columns(Run)
    group_field_col = string_to_column(group_field, Run)

    if group_field_col is None:
        return {}, build_numbers

    # Use shared utility for summary columns (basic version since we don't need time fields here)
    summary_cols = create_basic_summary_columns(Run, cast_type=Float)

    # Create a single comprehensive query using helper functions
    query = db.select(
        Run.id.label("run_id"),
        jenkins_cols["annotations"].label("annotations"),
        group_field_col.label("group_field"),
        jenkins_cols["job_name"].label("job_name"),
        jenkins_cols["build_number"].cast(Integer).label("build_number"),
        summary_cols["failures"],
        summary_cols["errors"],
        summary_cols["skips"],
        summary_cols["xfailures"],
        summary_cols["xpasses"],
        summary_cols["tests"].label("total"),
    ).select_from(Run)

    # Apply filters and grouping
    query = apply_filters(query, filters, Run)
    query = query.group_by(
        group_field_col, jenkins_cols["job_name"], jenkins_cols["build_number"], Run.id
    )

    # Execute query and process results in Python (more readable than complex SQL)
    query_data = db.session.execute(query).all()

    # Process data using dictionary operations and comprehensions
    data = {}
    for datum in query_data:
        if datum.group_field not in data:
            data[datum.group_field] = []

        # Calculate passes based on count_skips setting (more readable than SQL case statements)
        excluded_results = datum.errors + datum.failures + datum.xpasses + datum.xfailures
        if count_skips:
            excluded_results += datum.skips

        passes = datum.total - excluded_results

        # Calculate pass percentage with division by zero protection
        pass_percent = 0 if datum.total == 0 else round((100 * passes / datum.total), 2)

        data[datum.group_field].append(
            [
                pass_percent,
                datum.run_id,
                datum.annotations,
                str(datum.build_number),  # Convert to string for consistency
            ]
        )

    # Add slope information using dictionary comprehension (Python 3.9 compatible)
    data_with_slope = {}
    for key, value in data.items():
        slope_info = _calculate_slope([item[0] for item in value])
        # Insert slope as a single item at the beginning
        data_with_slope[key] = [[slope_info, 0]] + value

    return data_with_slope, build_numbers


def _pad_heatmap(heatmap, builds_in_db):
    """Pad Jenkins runs that are not present with Null"""
    padded_dict = {}
    if not heatmap:
        return heatmap

    for group in heatmap:
        # skip first item in list which contains slope info
        run_list = heatmap[group][1:]
        padded_run_list = []
        completed_runs = {run[3]: run for run in run_list}
        for build in builds_in_db:
            if build not in completed_runs:
                padded_run_list.append((NO_PASS_RATE_TEXT, NO_RUN_TEXT, None, build))
            else:
                padded_run_list.append(completed_runs[build])
        # sort the list by build number before adding slope info
        padded_run_list.sort(key=lambda e: int(e[-1]))
        # add the slope info back in at the beginning
        padded_run_list.insert(0, heatmap[group][0])
        padded_dict[group] = padded_run_list
    return padded_dict


def get_jenkins_heatmap(
    job_name,
    builds,
    group_field,
    count_skips=False,
    project=None,
    additional_filters=None,
):
    """Generate JSON data for a heatmap of Jenkins runs"""
    heatmap, builds_in_db = _get_heatmap(
        job_name, builds, group_field, count_skips, project, additional_filters
    )
    # do some postprocessing -- fill runs in which plugins failed to start with null
    heatmap = _pad_heatmap(heatmap, builds_in_db)
    return {"heatmap": heatmap}


def get_jenkins_summary(
    job_name,
    builds,
    project=None,
    additional_filters=None,
    run_limit=None,
):
    """Generate JSON data for a summary of Jenkins runs"""
    filters = [
        f"metadata.jenkins.job_name={job_name}",
        "metadata.jenkins.build_number@y",
    ]
    if additional_filters:
        filters.extend(additional_filters.split(","))
    if project and is_uuid(project):
        filters.append(f"project_id={project}")

    # Use shared utility functions for consistent column creation
    jenkins_cols = create_jenkins_columns(Run)
    summary_cols = create_summary_columns(Run, cast_type=Integer)

    query = db.select(
        jenkins_cols["job_name"].label("job_name"),
        jenkins_cols["build_number"].label("build_number"),
        func.min(jenkins_cols["build_url"]).label("build_url"),
        func.min(jenkins_cols["env"]).label("env"),
        summary_cols["source"],
        summary_cols["xfailures"],
        summary_cols["xpasses"],
        summary_cols["failures"],
        summary_cols["errors"],
        summary_cols["skips"],
        summary_cols["tests"],
        summary_cols["min_start_time"],
        summary_cols["max_start_time"],
        summary_cols["total_execution_time"],
        summary_cols["max_duration"],
    ).select_from(Run)

    # Apply filters and grouping
    query = apply_filters(query, filters, Run)
    query = (
        query.group_by(
            jenkins_cols["job_name"],
            jenkins_cols["build_number"],
        )
        .order_by(desc("max_start_time"))
        .limit(builds)
    )

    # Execute query and convert results to list of dictionaries
    result = db.session.execute(query).all()
    summary_data = [
        {
            "job_name": row.job_name,
            "build_number": row.build_number,
            "build_url": row.build_url,
            "env": row.env,
            "source": row.source,
            "xfailures": row.xfailures,
            "xpasses": row.xpasses,
            "failures": row.failures,
            "errors": row.errors,
            "skips": row.skips,
            "tests": row.tests,
            "min_start_time": row.min_start_time.isoformat() if row.min_start_time else None,
            "max_start_time": row.max_start_time.isoformat() if row.max_start_time else None,
            "total_execution_time": row.total_execution_time,
            "max_duration": row.max_duration,
        }
        for row in result
    ]

    return {"summary": summary_data}
