from bson import ObjectId
from dynaconf import settings
from ibutsu_server.mongo import mongo
from ibutsu_server.tasks.queues import task
from ibutsu_server.util import serialize
from redis import Redis
from redis.exceptions import LockError

LOCK_EXPIRE = 1


@task
def add_result_start_time(run_id):
    """ Update all results in a run to add the 'start_time' field to a result"""
    redis_client = Redis.from_url(settings["CELERY_BROKER_URL"])
    try:
        # Get a lock so that we don't run this task concurrently
        with redis_client.lock(f"update-run-lock-{run_id}", blocking_timeout=LOCK_EXPIRE):
            run = mongo.runs.find_one({"_id": ObjectId(run_id)})
            if not run:
                return
            results = mongo.results.find({"metadata.run": run_id})
            for result in results:
                result = serialize(result)
                if not result.get("start_time"):
                    result["start_time"] = result.get("starttime")
                    mongo.results.replace_one({"_id": ObjectId(result["id"])}, result)
    except LockError:
        # If this task is locked, discard it so that it doesn't clog up the system
        pass
