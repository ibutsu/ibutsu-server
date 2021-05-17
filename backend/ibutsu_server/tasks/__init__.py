import logging
from contextlib import contextmanager

from celery import Celery
from celery import signals
from celery import Task
from celery.schedules import crontab
from flask import current_app
from ibutsu_server.constants import SYNC_RUN_TIME
from ibutsu_server.db.base import session
from redis import Redis
from redis.exceptions import LockError

LOCK_EXPIRE = 1
task = None
_celery_app = None


def create_celery_app(_app=None):
    """Create the Celery app, using the Flask app in _app"""
    global task, _celery_app

    if _celery_app:
        return _celery_app

    class IbutsuTask(Task):
        abstract = True

        def __call__(self, *args, **kwargs):
            with _app.app_context():
                return super().__call__(*args, **kwargs)

        def after_return(self, status, retval, task_id, args, kwargs, einfo):
            """
            After each Celery task, teardown our db session.
            FMI: https://gist.github.com/twolfson/a1b329e9353f9b575131
            Flask-SQLAlchemy uses create_scoped_session at startup which avoids any setup on a
            per-request basis. This means Celery can piggyback off of this initialization.
            """
            if _app.config["SQLALCHEMY_COMMIT_ON_TEARDOWN"]:
                if not isinstance(retval, Exception):
                    session.commit()
            session.remove()

    app = Celery(
        "ibutsu_server",
        broker=_app.config.get("CELERY_BROKER_URL"),
        include=[
            "ibutsu_server.tasks.db",
            "ibutsu_server.tasks.importers",
            "ibutsu_server.tasks.reports",
            "ibutsu_server.tasks.results",
            "ibutsu_server.tasks.runs",
        ],
    )
    app.conf.result_backend = _app.config.get("CELERY_RESULT_BACKEND")
    app.Task = IbutsuTask
    # Shortcut for the decorator
    task = app.task
    # Add in any periodic tasks
    app.conf.beat_schedule = {
        "prune-old-artifact-files": {
            "task": "ibutsu_server.tasks.db.prune_old_files",
            "schedule": crontab(minute=0, hour=4, day_of_week=6),  # 4 am on Saturday, after DB dump
            "args": (3,),  # delete any artifact file older than 3 months
        },
        "prune-old-results": {
            "task": "ibutsu_server.tasks.db.prune_old_results",
            "schedule": crontab(minute=0, hour=5, day_of_week=6),  # 5 am on Saturday
            "args": (5,),  # delete any results older than 5 months
        },
        "prune-old-runs": {
            "task": "ibutsu_server.tasks.db.prune_old_runs",
            "schedule": crontab(minute=0, hour=6, day_of_week=6),  # 6 am on Saturday
            "args": (12,),  # delete any runs older than 12 months
        },
        "sync-aborted-runs": {
            "task": "ibutsu_server.tasks.runs.sync_aborted_runs",
            "schedule": SYNC_RUN_TIME,
        },
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

    return app


@contextmanager
def lock(name, timeout=LOCK_EXPIRE, app=None):
    if not app:
        app = current_app
    redis_client = Redis.from_url(app.config["CELERY_BROKER_URL"])
    try:
        # Get a lock so that we don't run this task concurrently
        with redis_client.lock(name, blocking_timeout=timeout):
            yield
    except LockError:
        # If this task is locked, discard it so that it doesn't clog up the system
        pass


__all__ = ["create_celery_app", "lock", "task"]
