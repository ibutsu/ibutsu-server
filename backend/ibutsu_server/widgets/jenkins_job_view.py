from sqlalchemy import desc, func

from ibutsu_server.constants import JJV_RUN_LIMIT
from ibutsu_server.db import db
from ibutsu_server.db.base import Integer, Text
from ibutsu_server.db.models import Run
from ibutsu_server.filters import apply_filters, string_to_column
from ibutsu_server.util.uuid import is_uuid


def _get_jenkins_aggregation(
    filters=None, project=None, page=1, page_size=25, run_limit=JJV_RUN_LIMIT
):
    """Get a list of Jenkins jobs"""
    offset = (page * page_size) - page_size

    # first create the filters
    query_filters = ["metadata.jenkins.build_number@y", "metadata.jenkins.job_name@y"]
    if filters:
        for idx, filter in enumerate(filters):
            if "job_name" in filter or "build_number" in filter:
                filters[idx] = f"metadata.jenkins.{filter}"
        query_filters.extend(filters)
    if project and is_uuid(project):
        query_filters.append(f"project_id={project}")
    filters = query_filters

    # get the runs on which to run the aggregation, we select from a subset of runs to improve
    # performance, otherwise we'd be aggregating over ALL runs
    run_query = db.select(Run).select_from(Run)

    # Create a consistent ref to the Run model with or without limit and filter applied
    runRef = Run
    columnRef = Run
    if run_limit is not None:
        run_query = apply_filters(run_query, filters, Run)
        runRef = run_query.order_by(desc(Run.start_time)).limit(run_limit).subquery()
        columnRef = runRef.c

    # generate the group_fields
    job_name = string_to_column("metadata.jenkins.job_name", runRef)
    build_number = string_to_column("metadata.jenkins.build_number", runRef)
    build_url = string_to_column("metadata.jenkins.build_url", runRef)
    env = string_to_column("env", runRef)

    # create the base query
    query = db.select(
        job_name.label("job_name"),
        build_number.label("build_number"),
        func.min(build_url.cast(Text)).label("build_url"),
        func.min(env).label("env"),
        func.min(columnRef.source).label("source"),
        func.sum(columnRef.summary["xfailures"].cast(Integer)).label("xfailures"),
        func.sum(columnRef.summary["xpasses"].cast(Integer)).label("xpasses"),
        func.sum(columnRef.summary["failures"].cast(Integer)).label("failures"),
        func.sum(columnRef.summary["errors"].cast(Integer)).label("errors"),
        func.sum(columnRef.summary["skips"].cast(Integer)).label("skips"),
        func.sum(columnRef.summary["tests"].cast(Integer)).label("tests"),
        func.min(columnRef.start_time).label("min_start_time"),
        func.max(columnRef.start_time).label("max_start_time"),
        func.sum(columnRef.duration).label("total_execution_time"),
        func.max(columnRef.duration).label("max_duration"),
    ).select_from(runRef)

    # Apply the filters to the main query if no limit was set
    if run_limit is None:
        query = apply_filters(query, filters, runRef)

    query = query.group_by(job_name, build_number).order_by(desc("max_start_time"))

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
                + datum.max_duration,  # noqa
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
                    "passes": datum.tests - (datum.errors + datum.failures + datum.skips),
                },
                "total_execution_time": datum.total_execution_time,
            }
        )

    return data


def get_jenkins_job_view(filter_=None, project=None, page=1, page_size=25, run_limit=None):
    filters = []

    if filter_:
        for filter_string in filter_.split(","):
            filters.append(filter_string)

    jenkins_jobs = _get_jenkins_aggregation(filters, project, page, page_size, run_limit)
    total_items = jenkins_jobs["pagination"]["totalItems"]
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    jenkins_jobs["pagination"].update({"totalPages": total_pages})

    return jenkins_jobs
