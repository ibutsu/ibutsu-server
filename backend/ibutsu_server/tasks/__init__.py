import logging
from contextlib import contextmanager

from celery import Celery, Task, signals
from celery.schedules import crontab
from flask import current_app
from redis import Redis
from redis.exceptions import LockError

from ibutsu_server.db.base import session
from ibutsu_server.db.models import Report

LOCK_EXPIRE = 1
task = None
_celery_app = None


SOCKET_TIMEOUT = 5
SOCKET_CONNECT_TIMEOUT = 5


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

        def _set_report_error(self, report):
            report.status = "error"
            session.add(report)
            session.commit()

        def after_return(self, status, retval, task_id, args, kwargs, einfo):
            """
            After each Celery task, teardown our db session.
            FMI: https://gist.github.com/twolfson/a1b329e9353f9b575131
            Flask-SQLAlchemy uses create_scoped_session at startup which avoids any setup on a
            per-request basis. This means Celery can piggyback off of this initialization.
            """
            if _app.config["SQLALCHEMY_COMMIT_ON_TEARDOWN"] and not isinstance(retval, Exception):
                session.commit()
            session.remove()

        def on_failure(self, exc, task_id, args, kwargs, einfo):
            # if the task is related to a report, set that report to failed
            if isinstance(args[0], dict):
                try:
                    with _app.app_context():
                        report_id = args[0].get("id")  # get the report ID from the task
                        report = Report.query.get(report_id)
                        # if this is actually a report ID, set it as an error
                        if report:
                            self._set_report_error(report)
                except AttributeError as e:
                    logging.error(f"Attribute error: {e}. Args are {args}")
                except (IndexError, TypeError):
                    pass
            else:
                # the task is not related to a report
                logging.info(f"Task {task_id} with args {args} is not related to a report")

    app = Celery(
        "ibutsu_server",
        broker=_app.config.get("CELERY_BROKER_URL"),
        broker_connection_retry=True,
        broker_connection_retry_on_startup=True,
        worker_cancel_long_running_tasks_on_connection_loss=True,
        include=[
            "ibutsu_server.tasks.db",
            "ibutsu_server.tasks.importers",
            "ibutsu_server.tasks.query",
            "ibutsu_server.tasks.reports",
            "ibutsu_server.tasks.results",
            "ibutsu_server.tasks.runs",
        ],
    )
    app.conf.redis_socket_timeout = SOCKET_TIMEOUT
    app.conf.redis_socket_connect_timeout = SOCKET_CONNECT_TIMEOUT
    app.conf.redis_retry_on_timeout = True
    app.conf.broker_transport_options = app.conf.result_backend_transport_options = {
        "socket_timeout": SOCKET_TIMEOUT,
        "socket_connect_timeout": SOCKET_CONNECT_TIMEOUT,
    }
    app.conf.result_backend = _app.config.get("CELERY_RESULT_BACKEND")
    app.Task = IbutsuTask
    # Shortcut for the decorator
    task = app.task
    # Add in any periodic tasks
    app.conf.beat_schedule = {
        "prune-old-imports": {
            "task": "ibutsu_server.tasks.db.prune_old_imports",
            "schedule": crontab(minute=0, hour=3, day_of_week=6),  # 3 am on Saturday
            "args": (1,),  # delete any import older than 1 months
        },
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
            "schedule": 0.5 * 60 * 60,  # this will run every 30 minutes, schedule is in [s]
        },
    }

    @signals.task_failure.connect
    def retry_task_on_exception(*args, **kwargs):
        """Retry a task automatically when it fails"""
        task = kwargs.get("sender")
        einfo = kwargs.get("einfo")
        logging.warning("Uncaught exception: %r for task %s", einfo, task)
        # Incremental backoff, starts at a minute and maxes out at 1 hour.
        backoff = min(2**task.request.retries, 3600)
        task.retry(countdown=backoff)

    return app


def get_redis_client(app=None):
    if not app:
        app = current_app

    redis_client = Redis.from_url(
        app.config["CELERY_BROKER_URL"],
        socket_timeout=SOCKET_TIMEOUT,
        socket_connect_timeout=SOCKET_CONNECT_TIMEOUT,
    )
    return redis_client


def is_locked(name, app=None):
    radis_client = get_redis_client(app=app)
    return radis_client.exists(name)


@contextmanager
def lock(name, timeout=LOCK_EXPIRE, app=None):
    redis_client = get_redis_client(app=app)

    try:
        # Get a lock so that we don't run this task concurrently
        logging.info(f"Trying to get a lock for {name}")
        with redis_client.lock(name, blocking_timeout=timeout):
            yield
    except LockError:
        # If this task is locked, discard it so that it doesn't clog up the system
        logging.info(f"Task {name} is already locked, discarding")


__all__ = ["create_celery_app", "lock", "task"]
