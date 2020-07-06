import logging

from bson import ObjectId
from ibutsu_server.mongo import mongo
from ibutsu_server.tasks.queues import app


STATE = app.events.State()


def _set_report_error(report):
    report["status"] = "error"
    mongo.reports.replace_one({"_id": ObjectId(report["id"])}, report)


# --- Event Status Functions
def on_failed(event):
    """
    Currently only applies to reports, register failed tasks in the DB if the
    task is related to reports.
    """
    STATE.event(event)
    # task name is sent only with -received event, and state
    # will keep track of this for us.
    task = STATE.tasks.get(event["uuid"])

    # if the task is related to a report, set that report to failed
    report_id = eval(task.args)[0].get("id")  # get the report ID from the task
    report = mongo.reports.find_one({"_id": ObjectId(report_id)})
    if report:
        _set_report_error(report)

    # also print out the task so we have a record of it failing
    logging.warning(f"TASK FAILED: {task.name}, {task.uuid}, {task.info()}")


# --- Monitor Function
def monitor_reports(app):
    """
    Monitor celery for FAILED tasks

    :param: update_reports (bool): if True, try to find report associated with the task id,
                                   and set that report to an "error" status
    """
    with app.connection() as connection:
        recv = app.events.Receiver(
            connection, handlers={"task-failed": on_failed, "*": STATE.event}
        )
        recv.capture(limit=None, timeout=None, wakeup=True)


if __name__ == "__main__":
    monitor_reports(app)
