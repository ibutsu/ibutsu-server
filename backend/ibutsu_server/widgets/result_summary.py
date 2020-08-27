from ibutsu_server.db.base import Integer
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Run
from ibutsu_server.filters import apply_filters
from sqlalchemy import func

PAGE_SIZE = 250


def get_result_summary(source=None, env=None, job_name=None, project=None):
    """Get a summary of results"""
    summary = {"error": 0, "skipped": 0, "failed": 0, "passed": 0, "total": 0}
    query = session.query(
        func.sum(Run.data["summary"]["errors"].cast(Integer)),
        func.sum(Run.data["summary"]["skips"].cast(Integer)),
        func.sum(Run.data["summary"]["failures"].cast(Integer)),
        func.sum(Run.data["summary"]["tests"].cast(Integer)),
    )

    # parse any filters
    filters = []
    if source:
        filters.append(f"source={source}")
    if env:
        filters.append(f"metadata.env={env}")
    if job_name:
        filters.append(f"metadata.jenkins.job_name={job_name}")
    if project:
        filters.append(f"metadata.project={project}")

    # TODO: implement some page size here?
    if filters:
        query = apply_filters(query, filters, Run)

    # get the total number
    query_data = query.all()

    # parse the data
    for error, skipped, failed, total in query_data:
        summary["error"] += error
        summary["skipped"] += skipped
        summary["failed"] += failed
        summary["total"] += total
        summary["passed"] += total - (error + skipped + failed)

    return summary
