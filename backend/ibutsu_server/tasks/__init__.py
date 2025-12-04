import logging

from celery import Celery, signals
from celery.schedules import crontab

from ibutsu_server.constants import SOCKET_CONNECT_TIMEOUT, SOCKET_TIMEOUT
from ibutsu_server.util.celery_task import IbutsuTask, set_flask_app, shared_task
from ibutsu_server.util.redis_lock import lock


def create_celery_app(app=None):
    """Create the Celery app, using the Flask app in app"""
    # Store the Flask app globally so it's available to our custom IbutsuTask class
    if app is not None:
        set_flask_app(app)
    celery_app = Celery(
        "ibutsu_server",
        task_cls=IbutsuTask,
    )
    celery_app.config_from_object(app.config, namespace="CELERY")
    celery_app.set_default()
    app.extensions["celery"] = celery_app
    celery_app.conf.redis_socket_timeout = SOCKET_TIMEOUT
    celery_app.conf.redis_socket_connect_timeout = SOCKET_CONNECT_TIMEOUT
    celery_app.conf.redis_retry_on_timeout = True
    celery_app.conf.broker_transport_options = celery_app.conf.result_backend_transport_options = {
        "socket_timeout": SOCKET_TIMEOUT,
        "socket_connect_timeout": SOCKET_CONNECT_TIMEOUT,
    }
    # Result backend is already set from CELERY config namespace above

    # Make sure all task modules are imported so tasks are registered
    # This is crucial for Celery task discovery
    import ibutsu_server.tasks.db  # noqa: PLC0415
    import ibutsu_server.tasks.importers  # noqa: PLC0415
    import ibutsu_server.tasks.query  # noqa: PLC0415
    import ibutsu_server.tasks.results  # noqa: PLC0415
    import ibutsu_server.tasks.runs  # noqa: F401, PLC0415

    celery_app.Task = IbutsuTask

    # Add in any periodic tasks
    celery_app.conf.beat_schedule = {
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
    def retry_task_on_exception(*_args, **kwargs):
        """Retry a task automatically when it fails"""
        task = kwargs.get("sender")
        einfo = kwargs.get("einfo")
        logging.warning("Uncaught exception: %r for task %s", einfo, task)
        # Incremental backoff, starts at a minute and maxes out at 1 hour.
        backoff = min(2**task.request.retries, 3600)
        task.retry(countdown=backoff)

    return celery_app


def get_celery_app():
    """
    Get the Celery app instance.

    This function retrieves the Celery app from the Flask app extensions.
    If the app hasn't been initialized yet, it will be initialized.

    Returns:
        Celery: The Celery app instance
    """
    import ibutsu_server  # noqa: PLC0415

    celery_app = ibutsu_server._AppRegistry.get_celery_app()
    if celery_app is None:
        raise RuntimeError("Celery app not initialized. Call create_celery_app() first.")

    return celery_app


# Alias for shared_task decorator - commonly used in tests
task = shared_task

# Export shared_task is already imported from ibutsu_server.util.celery_task at the top

__all__ = ["IbutsuTask", "create_celery_app", "get_celery_app", "lock", "shared_task", "task"]
