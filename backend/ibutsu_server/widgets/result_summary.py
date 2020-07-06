from ibutsu_server.mongo import mongo
from pymongo import DESCENDING

PAGE_SIZE = 250


def get_result_summary(source=None, env=None, job_name=None, project=None):
    """Get a summary of results"""
    summary = {"passed": 0, "failed": 0, "skipped": 0, "error": 0, "total": 0}
    filters = {}
    if source:
        filters["source"] = {"$eq": source}
    if env:
        filters["metadata.env"] = {"$eq": env}
    if job_name:
        filters["metadata.jenkins.job_name"] = {"$eq": job_name}
    if project:
        filters["metadata.project"] = {"$eq": project}
    offset = 0
    run_count = 250
    while run_count == PAGE_SIZE:
        runs = mongo.runs.find(
            filters, skip=offset, limit=PAGE_SIZE, sort=[("created", DESCENDING)]
        )
        # Convert the MongoDB Cursor into a list
        runs = list(runs)
        run_count = len(runs)
        offset += run_count
        for run in runs:
            if not run.get("summary"):
                continue
            summary["passed"] += (
                run["summary"].get("tests", 0)
                - run["summary"].get("errors", 0)
                - run["summary"].get("failures", 0)
                - run["summary"].get("skips", 0)
            )
            summary["failed"] += run["summary"].get("failures", 0)
            summary["error"] += run["summary"].get("errors", 0)
            summary["skipped"] += run["summary"].get("skips", 0)
            summary["total"] += run["summary"].get("tests", 0)
    return summary
