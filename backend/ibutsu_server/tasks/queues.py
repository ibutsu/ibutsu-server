import logging

from celery import Celery
from celery import signals
from celery import Task
from celery.schedules import crontab
from dynaconf import settings


class IbutsuTask(Task):
    # Globally override the maximum retries.
    # This means the task will run for about 41 days and 22 hours
    max_retries = 1000


app = Celery(
    "ibutsu_server",
    broker=settings.get("CELERY_BROKER_URL"),
    include=[
        "ibutsu_server.tasks.db",
        "ibutsu_server.tasks.importers",
        "ibutsu_server.tasks.reports",
        "ibutsu_server.tasks.results",
        "ibutsu_server.tasks.runs",
    ],
)
app.conf.result_backend = settings.get("CELERY_RESULT_BACKEND")
app.Task = IbutsuTask
# Shortcut for the decorator
task = app.task
# Add in any periodic tasks
app.conf.beat_schedule = {
    "prune-old-artifact-files": {
        "task": "ibutsu_server.tasks.db.prune_old_files",
        "schedule": crontab(minute=0, hour=4, day_of_week=6),  # 4 am on Saturday, after DB dump
        "args": (3,),  # delete any artifact file older than 3 months
    }
}


@signals.task_failure.connect
def retry_task_on_exception(*args, **kwargs):
    """Retry a task automatically when it fails"""
    task = kwargs.get("sender")
    einfo = kwargs.get("einfo")
    logging.warning("Uncaught exception: %r for task %s", einfo, task)
    # Incremental backoff, starts at a minute and maxes out at 1 hour.
    backoff = min(2 ** task.request.retries, 3600)
    task.retry(countdown=backoff)


__all__ = ["app", "task"]
