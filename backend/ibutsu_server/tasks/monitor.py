import logging

from ibutsu_server.db.base import session
from ibutsu_server.db.models import Report
from ibutsu_server.tasks.queues import app


STATE = app.events.State()


def _set_report_error(report):
    report.data["status"] = "error"
    session.add(report)
    session.commit()


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
    report = Report.query.get(report_id)
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
