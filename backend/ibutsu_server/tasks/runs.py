import time
from datetime import datetime

from bson import ObjectId
from dynaconf import settings
from ibutsu_server.mongo import mongo
from ibutsu_server.tasks.queues import task
from pymongo import ASCENDING
from redis import Redis
from redis.exceptions import LockError


LOCK_EXPIRE = 1
METADATA_TO_COPY = ["component", "env", "project", "jenkins", "tags"]


def _copy_result_metadata(result, metadata, key):
    if not metadata.get(key) and result.get("metadata") and result["metadata"].get(key):
        metadata[key] = result["metadata"][key]


@task(max_retries=1000)
def update_run(run_id):
    """Update the run summary from the results, this task will retry 1000 times"""
    redis_client = Redis.from_url(settings["CELERY_BROKER_URL"])
    try:
        # Get a lock so that we don't run this task concurrently
        with redis_client.lock(f"update-run-lock-{run_id}", blocking_timeout=LOCK_EXPIRE):
            key_map = {
                "failed": "failures",
                "error": "errors",
                "xfailed": "xfailures",
                "xpassed": "xpasses",
                "skipped": "skips",
            }
            run = mongo.runs.find_one({"_id": ObjectId(run_id)})
            if not run:
                return
            # sort according to starttime to get the most recent starting time of the run
            results = mongo.results.find({"metadata.run": run_id}, sort=[("start_time", ASCENDING)])
            summary = {
                "errors": 0,
                "failures": 0,
                "skips": 0,
                "xfailures": 0,
                "xpasses": 0,
                "tests": 0,
            }
            run_duration = 0.0
            metadata = run.get("metadata") or {}
            for counter, result in enumerate(results):
                if counter == 0:
                    if not run.get("start_time"):
                        run["start_time"] = result.get("start_time", result.get("starttime"))
                    if not run.get("created"):
                        run["created"] = datetime.fromtimestamp(
                            run.get("start_time") or time.time()
                        ).isoformat()
                summary["tests"] += 1
                key = key_map.get(result["result"], None)
                if key:
                    summary[key] += 1
                if result.get("duration"):
                    run_duration += result["duration"]
                if not run.get("source") and result.get("source"):
                    run["source"] = result["source"]
                for key in METADATA_TO_COPY:
                    _copy_result_metadata(result, metadata, key)
            run["summary"] = summary
            run["metadata"] = metadata
            if run_duration:
                run["duration"] = run_duration
            mongo.runs.replace_one({"_id": ObjectId(run_id)}, run)
    except LockError:
        # If this task is locked, discard it so that it doesn't clog up the system
        pass
