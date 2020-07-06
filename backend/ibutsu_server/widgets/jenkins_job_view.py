from ibutsu_server.filters import generate_filter_object
from ibutsu_server.mongo import mongo
from pymongo import DESCENDING


def _get_jenkins_aggregation(filters=None, project=None, page=1, page_size=25):
    """ Get a list of Jenkins jobs """
    offset = (page * page_size) - page_size
    aggregation = [
        {
            "$match": {
                "metadata.jenkins.build_number": {"$exists": True},
                "metadata.jenkins.job_name": {"$exists": True},
            }
        },
        {
            "$group": {
                "_id": {
                    "job_name": "$metadata.jenkins.job_name",
                    "build_number": "$metadata.jenkins.build_number",
                },
                "job_name": {"$first": "$metadata.jenkins.job_name"},
                "build_number": {"$first": "$metadata.jenkins.build_number"},
                "build_url": {"$mergeObjects": {"build_url": "$metadata.jenkins.build_url"}},
                "source": {"$mergeObjects": {"source": "$source"}},
                "env": {"$mergeObjects": {"env": "$metadata.env"}},
                "total_execution_time": {"$sum": "$duration"},
                "tests": {"$sum": "$summary.tests"},
                "errors": {"$sum": "$summary.errors"},
                "skips": {"$sum": "$summary.skips"},
                "failures": {"$sum": "$summary.failures"},
                "first_start_time": {"$min": "$start_time"},
                "last_start_time": {"$max": "$start_time"},
                "max_duration": {"$max": "$duration"},
            }
        },
        {
            "$project": {
                "_id": {"$concat": ["$job_name", "-", "$build_number"]},
                "job_name": "$job_name",
                "build_url": "$build_url.build_url",
                "source": "$source.source",
                "build_number": "$build_number",
                "total_execution_time": "$total_execution_time",
                "start_time": "$first_start_time",
                "env": "$env.env",
                "duration": {
                    "$add": [
                        {"$subtract": ["$last_start_time", "$first_start_time"]},
                        "$max_duration",
                    ]
                },
                "summary": {
                    "tests": "$tests",
                    "errors": "$errors",
                    "failures": "$failures",
                    "skips": "$skips",
                    "passes": {
                        "$subtract": ["$tests", {"$add": ["$errors", "$failures", "$skips"]}]
                    },
                },
            }
        },
        {"$sort": {"start_time": DESCENDING}},
        {
            "$facet": {
                "pagination": [{"$count": "totalItems"}],
                "jobs": [{"$skip": offset}, {"$limit": page_size}],
            }
        },
    ]
    if filters:
        for key, value in filters.items():
            if key == "job_name" or key == "build_number":
                key = f"metadata.jenkins.{key}"
            if key == "env":
                key = f"metadata.{key}"
            aggregation[0]["$match"].update({key: value})
    if project:
        aggregation[0]["$match"].update({"metadata.project": project})

    return mongo.runs.aggregate(aggregation)


def get_jenkins_job_view(filter_=None, project=None, page=1, page_size=25):
    filters = {}
    if filter_:
        for filter_string in filter_.split(","):
            filter_obj = generate_filter_object(filter_string)
            if filter_obj:
                filters.update(filter_obj)
    aggr = _get_jenkins_aggregation(filters, project, page, page_size)

    try:
        jenkins_jobs = list(aggr)[0]
        jenkins_jobs["pagination"] = jenkins_jobs["pagination"][0]
        total_items = jenkins_jobs["pagination"]["totalItems"]
        total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
        jenkins_jobs["pagination"].update(
            {"page": page, "pageSize": page_size, "totalPages": total_pages}
        )
    except IndexError:
        # if no jobs found matching the filters
        jenkins_jobs = {
            "jobs": [],
            "pagination": {"page": page, "pageSize": page_size, "totalItems": 0, "totalPages": 0},
        }

    return jenkins_jobs
