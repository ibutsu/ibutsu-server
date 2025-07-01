from http import HTTPStatus

from celery.result import AsyncResult

from ibutsu_server.util.uuid import validate_uuid

_STATE_TO_CODE = {
    "SUCCESS": HTTPStatus.OK,
    "PENDING": HTTPStatus.PARTIAL_CONTENT,
    "STARTED": HTTPStatus.PARTIAL_CONTENT,
    "RETRY": HTTPStatus.PARTIAL_CONTENT,
    "FAILURE": HTTPStatus.NON_AUTHORITATIVE_INFORMATION,
}


@validate_uuid
def get_task(id_, token_info=None, user=None):
    """
    Get the result or status of a single task.

    :param id_: id of the task
    """
    # Use the global celery app instance
    from ibutsu_server import celery_app

    async_result = AsyncResult(id_, app=celery_app)
    response = {"state": async_result.state}

    if async_result.state == "SUCCESS":
        response["message"] = "Task has succeeded"
        result = async_result.get()
        if result:
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
