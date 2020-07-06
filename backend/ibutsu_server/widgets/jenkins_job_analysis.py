from ibutsu_server.constants import HEATMAP_MAX_BUILDS
from ibutsu_server.widgets.jenkins_job_view import get_jenkins_job_view


def get_jenkins_line_chart(job_name, builds, group_field="build_number", project=None):
    data = {"duration": {}}
    jobs = get_jenkins_job_view(
        filter_=f"job_name={job_name}", page_size=builds, project=project
    ).get("jobs")
    # first determine duration differs from total_execution_time
    run_had_multiple_components = any(
        [job.get("total_execution_time") != job.get("duration") for job in jobs]
    )
    if run_had_multiple_components:
        data["total_execution_time"] = {}

    # now format the data
    for job in jobs:
        data_id = job.get(group_field)
        data["duration"][data_id] = round(job.get("duration") / (60 * 60), 2)  # convert s to hrs
        if run_had_multiple_components:
            data["total_execution_time"][data_id] = round(
                job.get("total_execution_time") / (60 * 60), 2
            )
    return data


def get_jenkins_bar_chart(job_name, builds, group_field="build_number", project=None):
    data = {"passed": {}, "skipped": {}, "error": {}, "failed": {}}
    jobs = get_jenkins_job_view(
        filter_=f"job_name={job_name}", page_size=builds, project=project
    ).get("jobs")
    for job in jobs:
        data_id = job.get(group_field)
        data["passed"][data_id] = job["summary"].get("passes")
        data["skipped"][data_id] = job["summary"].get("skips")
        data["error"][data_id] = job["summary"].get("errors")
        data["failed"][data_id] = job["summary"].get("failures")
    return data


def get_jenkins_analysis_data(job_name, builds, group_field="metadata.component", project=None):
    heatmap_params = {
        "job_name": job_name,
        "builds": min(builds, HEATMAP_MAX_BUILDS),
        "group_field": group_field,
        "count_skips": True,
        "sort_field": "start_time",
    }
    barchart_params = {
        "job_name": job_name,
        "builds": builds,
    }
    if project:
        heatmap_params["project"] = project
        barchart_params["project"] = project
    linechart_params = barchart_params.copy()
    return {
        "barchart_params": barchart_params,
        "heatmap_params": heatmap_params,
        "linechart_params": linechart_params,
    }
