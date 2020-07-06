import time
from datetime import datetime
from datetime import timedelta

from bson import ObjectId
from bson.errors import InvalidId
from dynaconf import settings
from ibutsu_server.mongo import mongo
from ibutsu_server.tasks.queues import task
from ibutsu_server.tasks.results import add_result_start_time
from ibutsu_server.tasks.runs import update_run as update_run_task
from ibutsu_server.util import serialize
from kombu.exceptions import OperationalError
from pymongo import DESCENDING
from redis import Redis
from redis.exceptions import LockError

""" Tasks for DB related things"""

LOCK_EXPIRE = 1


@task
def create_runs_from_results():
    # 1. get all the runs
    runs_to_create = mongo.results.aggregate([{"$group": {"_id": "$metadata.run"}}])

    # 2. loop over all the runs
    for run_id in runs_to_create:
        # first check if the run exists already
        _id = run_id["_id"]
        try:
            if mongo.runs.find_one({"_id": ObjectId(_id)}):
                continue
        except InvalidId:
            continue
        run_dict = {
            "_id": ObjectId(_id),
        }
        # 3. Create the run in Ibutsu
        mongo.runs.insert_one(run_dict)
        run_dict = serialize(run_dict)
        # 4. Start the update task
        update_run_task.apply_async((run_dict["id"],), countdown=5)


@task
def add_start_time_to_results():
    """ Add the field 'start_time' to all the results. For this we create a task for each run. """

    for run in mongo.runs.find(sort=[("start_time", DESCENDING)]):
        run = serialize(run)
        try:
            add_result_start_time.apply_async((run["id"],), countdown=5)
        except OperationalError:
            pass


@task
def _add_project_metadata(run, project_id):
    """ Update all runs and results to add the 'metadata.project' field"""

    redis_client = Redis.from_url(settings["CELERY_BROKER_URL"])
    try:
        # Get a lock so that we don't run this task concurrently
        with redis_client.lock(f"update-run-lock-{run['id']}", blocking_timeout=LOCK_EXPIRE):
            # add project metadata to the run
            if not run.get("metadata"):
                run["metadata"] = {}
            run["metadata"]["project"] = project_id
            mongo.runs.replace_one({"_id": ObjectId(run["id"])}, run)

            results = mongo.results.find(
                {"metadata.run": run["id"], "metadata.project": {"$exists": False}}
            )
            for result in results:
                result = serialize(result)
                # add project metadata to the result
                if not result.get("metadata"):
                    result["metadata"] = {}
                result["metadata"]["project"] = project_id
                mongo.results.replace_one({"_id": ObjectId(result["id"])}, result)
    except LockError:
        # If this task is locked, discard it so that it doesn't clog up the system
        pass


@task
def add_project_metadata_to_objects(project_name="insights-qe"):
    """ Add IQE Project Metadata to historical DB objects. """

    project_id = serialize(mongo.projects.find_one({"name": project_name})).get("id")

    if not project_id:
        return

    for run in mongo.runs.find(
        {"metadata.project": {"$exists": False}}, sort=[("start_time", DESCENDING)]
    ):
        run = serialize(run)
        try:
            _add_project_metadata.apply_async((run, project_id), countdown=5)
        except OperationalError:
            pass


@task
def _delete_old_files(filename, max_date):
    """ Delete all files uploaded before the max_date """
    try:
        redis_client = Redis.from_url(settings["CELERY_BROKER_URL"])
        if not isinstance(max_date, datetime):
            max_date = datetime.fromisoformat(max_date)
        try:
            # Get a lock so that we don't run this task concurrently
            with redis_client.lock(f"delete-file-lock-{filename}", blocking_timeout=LOCK_EXPIRE):
                for file in mongo.fs.find({"filename": filename, "uploadDate": {"$lt": max_date}}):
                    mongo.fs.delete(file._id)
        except LockError:
            # If this task is locked, discard it so that it doesn't clog up the system
            pass
    except Exception:
        # we don't want to continually retry this task
        return


@task
def prune_old_files(months=5):
    """ Delete artifact files older than specified months (here defined as 4 weeks). """
    try:
        if isinstance(months, str):
            months = int(months)

        if months < 2:
            # we don't want to remove files more recent than 3 months
            return
        files_to_delete = ["traceback.log", "screenshot.png", "iqe.log"]
        delta = timedelta(weeks=months * 4).total_seconds()
        current_time = time.time()
        timestamp_in_sec = current_time - delta
        # get datetime obj
        max_date = datetime.fromtimestamp(timestamp_in_sec)
        # send out the tasks
        for filename in files_to_delete:
            try:
                _delete_old_files.apply_async((filename, max_date), countdown=5)
            except OperationalError:
                pass
    except Exception:
        # we don't want to continually retry this task
        return


@task
def delete_large_files(limit=256 * 1024):
    """ Delete 'iqe.log' files larger than the limit, defaults to 256 KiB"""
    try:
        if isinstance(limit, str):
            limit = int(limit)

        if limit < (256 * 1024):
            # we don't want to remove files smaller than 256 KiB
            return

        redis_client = Redis.from_url(settings["CELERY_BROKER_URL"])
        try:
            # Get a lock so that we don't run this task concurrently
            with redis_client.lock(f"delete-file-lock-{limit}", blocking_timeout=LOCK_EXPIRE):
                for file in mongo.fs.find({"length": {"$gt": limit}, "filename": "iqe.log"}):
                    mongo.fs.delete(file._id)
        except LockError:
            # If this task is locked, discard it so that it doesn't clog up the system
            pass
    except Exception:
        # we don't want to continually retry this task
        return
