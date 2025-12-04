from sqlalchemy import desc, func

from ibutsu_server.constants import JJV_RUN_LIMIT
from ibutsu_server.db import db
from ibutsu_server.db.base import Integer, Text
from ibutsu_server.db.models import Run
from ibutsu_server.filters import apply_filters
from ibutsu_server.util.uuid import is_uuid
from ibutsu_server.util.widget import create_jenkins_columns, create_summary_columns


def _get_jenkins_aggregation(
    additional_filters=None, project=None, page=1, page_size=25, run_limit=JJV_RUN_LIMIT
):
    """Get a list of Jenkins jobs"""
    offset = (page * page_size) - page_size

    # first create the filters
    query_filters = ["metadata.jenkins.build_number@y", "metadata.jenkins.job_name@y"]
    if additional_filters:
        for idx, filter in enumerate(additional_filters):
            if "job_name" in filter or "build_number" in filter:
                additional_filters[idx] = f"metadata.jenkins.{filter}"
        query_filters.extend(additional_filters)
    if project and is_uuid(project):
        query_filters.append(f"project_id={project}")
    filters = query_filters

    # get the runs on which to run the aggregation, we select from a subset of runs to improve
    # performance, otherwise we'd be aggregating over ALL runs
    run_query = db.select(Run).select_from(Run)

    # Create a consistent ref to the Run model with or without limit and filter applied
    run_ref = Run
    column_ref = Run
    if run_limit is not None:
        run_query = apply_filters(run_query, filters, Run)
        run_ref = run_query.order_by(desc(Run.start_time)).limit(run_limit).subquery()
        column_ref = run_ref.c

    # Use shared utility functions for consistent column creation
    jenkins_cols = create_jenkins_columns(run_ref)
    summary_cols = create_summary_columns(column_ref, cast_type=Integer)

    # create the base query
    query = db.select(
        jenkins_cols["job_name"].label("job_name"),
        jenkins_cols["build_number"].label("build_number"),
        func.min(jenkins_cols["build_url"].cast(Text)).label("build_url"),
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
    ).select_from(run_ref)

    # Apply the filters to the main query if no limit was set
    if run_limit is None:
        query = apply_filters(query, filters, run_ref)

    query = query.group_by(jenkins_cols["job_name"], jenkins_cols["build_number"]).order_by(
        desc("max_start_time")
    )

    # form a count query
    count_query = query.subquery()
    total_count = db.session.execute(db.select(func.count()).select_from(count_query)).scalar()

    # apply pagination and get data
    query_data = db.session.execute(query.offset(offset).limit(page_size)).all()

    # parse the data for the frontend
    data = {
        "jobs": [],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_count,
        },
    }
    for datum in query_data:
        data["jobs"].append(
            {
                "_id": f"{datum.job_name}-{datum.build_number}",
                "build_number": datum.build_number,
                "build_url": datum.build_url,
                "duration": (datum.max_start_time.timestamp() - datum.min_start_time.timestamp())
                + (datum.max_duration or 0),
                "env": datum.env,
                "job_name": datum.job_name,
                "source": datum.source,
                "start_time": datum.min_start_time,
                "summary": {
                    "xfailures": datum.xfailures,
                    "xpasses": datum.xpasses,
                    "errors": datum.errors,
                    "failures": datum.failures,
                    "skips": datum.skips,
                    "tests": datum.tests,
                    "passes": datum.tests
                    - (
                        datum.errors
                        + datum.failures
                        + datum.skips
                        + datum.xfailures
                        + datum.xpasses
                    ),
                },
                "total_execution_time": datum.total_execution_time,
            }
        )

    return data


def get_jenkins_job_view(
    additional_filters=None, project=None, page=1, page_size=25, run_limit=None
):
    filters = []

    if additional_filters:
        if isinstance(additional_filters, str):
            # Handle string format (comma-separated)
            filters.extend(iter(additional_filters.split(",")))
        elif isinstance(additional_filters, list):
            # Handle list format
            filters = additional_filters

    jenkins_jobs = _get_jenkins_aggregation(filters, project, page, page_size, run_limit)
    total_items = jenkins_jobs["pagination"]["totalItems"]
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    jenkins_jobs["pagination"].update({"totalPages": total_pages})

    return jenkins_jobs
