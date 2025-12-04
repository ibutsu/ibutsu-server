from ibutsu_server.db import db
from ibutsu_server.db.base import Integer
from ibutsu_server.db.models import Run
from ibutsu_server.filters import apply_filters
from ibutsu_server.util.uuid import is_uuid
from ibutsu_server.util.widget import create_basic_summary_columns

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
    # Use shared utility for consistent summary columns
    summary_cols = create_basic_summary_columns(Run, cast_type=Integer)

    query = db.select(
        summary_cols["errors"].label("error"),
        summary_cols["skips"].label("skipped"),
        summary_cols["failures"].label("failed"),
        summary_cols["tests"].label("total"),
        summary_cols["xfailures"].label("xfailed"),
        summary_cols["xpasses"].label("xpassed"),
    ).select_from(Run)  # Explicitly select from Run to avoid implicit FROM clauses

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
    query_result = db.session.execute(query).first()

    # We only have one row since we're doing aggregates
    if query_result:
        error = query_result.error or 0
        skipped = query_result.skipped or 0
        failed = query_result.failed or 0
        total = query_result.total or 0
        xfailed = query_result.xfailed or 0
        xpassed = query_result.xpassed or 0

        # Update summary with the values
        summary["error"] = error
        summary["skipped"] = skipped
        summary["failed"] = failed
        summary["total"] = total
        summary["xfailed"] = xfailed
        summary["xpassed"] = xpassed
        summary["passed"] = total - (error + skipped + failed + xpassed + xfailed)

    return summary
