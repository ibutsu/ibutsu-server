from sqlalchemy import func

from ibutsu_server.db.base import Integer, session
from ibutsu_server.db.models import Run
from ibutsu_server.filters import apply_filters
from ibutsu_server.util.uuid import is_uuid

PAGE_SIZE = 250


def get_result_summary(source=None, env=None, job_name=None, project=None, additional_filters=None):
    """Get a summary of results"""
    summary = {
        "error": 0,
        "skipped": 0,
        "failed": 0,
        "passed": 0,
        "total": 0,
        "xfailed": 0,
        "xpassed": 0,
    }
    query = session.query(
        func.sum(Run.summary["errors"].cast(Integer)),
        func.sum(Run.summary["skips"].cast(Integer)),
        func.sum(Run.summary["failures"].cast(Integer)),
        func.sum(Run.summary["tests"].cast(Integer)),
        func.sum(Run.summary["xfailures"].cast(Integer)),
        func.sum(Run.summary["xpasses"].cast(Integer)),
    )

    # parse any filters
    filters = []
    if source:
        filters.append(f"source={source}")
    if env:
        filters.append(f"env={env}")
    if job_name:
        filters.append(f"metadata.jenkins.job_name={job_name}")
    if project and is_uuid(project):
        filters.append(f"project_id={project}")
    if additional_filters:
        filters.extend(additional_filters.split(","))

    # TODO: implement some page size here?
    if filters:
        query = apply_filters(query, filters, Run)

    # get the total number
    query_data = query.all()

    # parse the data
    for error_val, skipped_val, failed_val, total_val, xfailed_val, xpassed_val in query_data:
        error = error_val or 0
        skipped = skipped_val or 0
        failed = failed_val or 0
        total = total_val or 0
        xfailed = xfailed_val or 0
        xpassed = xpassed_val or 0
        summary["error"] += error
        summary["skipped"] += skipped
        summary["failed"] += failed
        summary["total"] += total
        summary["xfailed"] += xfailed
        summary["xpassed"] += xpassed
        summary["passed"] += total - (error + skipped + failed + xpassed + xfailed)

    return summary
