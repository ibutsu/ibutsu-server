from ibutsu_server.constants import JJV_RUN_LIMIT
from ibutsu_server.db.base import Integer
from ibutsu_server.db.base import session
from ibutsu_server.db.base import Text
from ibutsu_server.db.models import Run
from ibutsu_server.filters import apply_filters
from ibutsu_server.filters import string_to_column
from sqlalchemy import desc
from sqlalchemy import func


def _get_jenkins_aggregation(filters=None, project=None, page=1, page_size=25, run_limit=None):
    """ Get a list of Jenkins jobs"""
    offset = (page * page_size) - page_size

    # first create the filters
    query_filters = ["metadata.jenkins.build_number@y", "metadata.jenkins.job_name@y"]
    if filters:
        for idx, filter in enumerate(filters):
            if "job_name" in filter or "build_number" in filter:
                filters[idx] = f"metadata.jenkins.{filter}"
        query_filters.extend(filters)
    if project:
        query_filters.append(f"project_id={project}")
    filters = query_filters

    # generate the group_fields
    job_name = string_to_column("metadata.jenkins.job_name", Run)
    build_number = string_to_column("metadata.jenkins.build_number", Run)
    build_url = string_to_column("metadata.jenkins.build_url", Run)
    env = string_to_column("env", Run)

    # get the runs on which to run the aggregation, we select from a subset of runs to improve
    # performance, otherwise we'd be aggregating over ALL runs
    sub_query = (
        apply_filters(Run.query, filters, Run)
        .order_by(desc("start_time"))
        .limit(run_limit or JJV_RUN_LIMIT)
        .subquery()
    )

    # create the base query
    query = (
        session.query(
            job_name.label("job_name"),
            build_number.label("build_number"),
            func.min(build_url.cast(Text)).label("build_url"),
            func.min(env).label("env"),
            func.min(Run.source).label("source"),
            func.sum(Run.summary["failures"].cast(Integer)).label("failures"),
            func.sum(Run.summary["errors"].cast(Integer)).label("errors"),
            func.sum(Run.summary["skips"].cast(Integer)).label("skips"),
            func.sum(Run.summary["tests"].cast(Integer)).label("tests"),
            func.min(Run.start_time).label("min_start_time"),
            func.max(Run.start_time).label("max_start_time"),
            func.sum(Run.duration).label("total_execution_time"),
            func.max(Run.duration).label("max_duration"),
        )
        .select_entity_from(sub_query)
        .group_by(job_name, build_number)
        .order_by(desc("max_start_time"))
    )

    # apply filters to the query
    query = apply_filters(query, filters, Run)

    # apply pagination and get data
    query_data = query.offset(offset).limit(page_size).all()

    # parse the data for the frontend
    data = {
        "jobs": [],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": query.count(),  # TODO: examine performance here
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
