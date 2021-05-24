from celery.result import AsyncResult
from ibutsu_server.util.uuid import validate_uuid

_STATE_TO_CODE = {"SUCCESS": 200, "PENDING": 206, "STARTED": 206, "RETRY": 206, "FAILURE": 203}


@validate_uuid
def get_task(id_):
    """
    Get the result or status of a single task.

    :param id_: id of the task
    """
    # lazy load the task app to avoid circular imports
    from ibutsu_server.tasks.queues import app

    async_result = AsyncResult(id_, app=app)
    response = {"state": async_result.state}

    if async_result.state == "SUCCESS":
        response["message"] = "Task has succeeded"
        response.update(async_result.get())
    elif async_result.state == "PENDING":
        response["message"] = "Task not yet started or invalid, check back later"
    elif async_result.state == "STARTED":
        response["message"] = "Task has started but is still running, check back later"
    elif async_result.state == "RETRY":
        response["message"] = "Task has been retried, possibly due to failure"
    else:
        response["message"] = "Task has failed!"
        response["error"] = async_result.traceback.split("\n")

    return response, _STATE_TO_CODE.get(async_result.state)
