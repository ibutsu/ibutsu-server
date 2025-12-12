"""
Celery application factory functions for Ibutsu.

This module provides two distinct factory functions for creating Celery applications:

1. create_broker_celery_app() - Minimal broker-only configuration (for Flower monitoring)
2. create_flask_celery_app() - Full Flask integration (for workers and scheduler)

Configuration Modes
-------------------

Broker-Only Mode (Flower):
    Environment Variables Required:
        - CELERY_BROKER_URL
        - CELERY_RESULT_BACKEND (optional, defaults to broker URL)

    Features:
        ✅ Task monitoring via broker introspection
        ✅ Result inspection
        ✅ Transport options configured (timeouts, retries)
        ❌ No database access
        ❌ No task module imports
        ❌ No Flask context

Flask-Integrated Mode (Worker/Scheduler):
    Environment Variables Required:
        - CELERY_BROKER_URL
        - CELERY_RESULT_BACKEND
        - SQLALCHEMY_DATABASE_URI (or POSTGRESQL_*/POSTGRES_*)
        - All Flask app configuration

    Features:
        ✅ Full database access
        ✅ All task modules imported and registered
        ✅ Beat schedule configured (periodic tasks)
        ✅ Flask app context in all tasks via IbutsuTask
        ✅ Automatic session management
        ✅ Signal handlers for task failure retry

Usage Examples
--------------

Broker-only app for Flower monitoring::

    from ibutsu_server.celery_utils import create_broker_celery_app
    flower_app = create_broker_celery_app(name="ibutsu_server_flower")

Flask-integrated app for workers::

    from ibutsu_server.celery_utils import create_flask_celery_app
    worker_app = create_flask_celery_app(flask_app, name="ibutsu_server_worker")

Flask-integrated app for scheduler::

    from ibutsu_server.celery_utils import create_flask_celery_app
    scheduler_app = create_flask_celery_app(flask_app, name="ibutsu_server_scheduler")
"""

import logging
import os

from celery import Celery, signals
from celery.schedules import crontab

from ibutsu_server.constants import SOCKET_CONNECT_TIMEOUT, SOCKET_TIMEOUT
from ibutsu_server.util.celery_task import IbutsuTask, set_flask_app


def create_broker_celery_app(name="ibutsu_server_flower"):
    """
    Create a minimal broker-only Celery app (for Flower monitoring).

    This function creates a lightweight Celery application that only requires
    broker access. It's designed for Flower monitoring which doesn't need
    database access or Flask integration. Tasks are discovered from workers
    via broker introspection.

    Args:
        name: Name for the Celery app (default: "ibutsu_server_flower")

    Returns:
        Celery: Configured broker-only Celery app instance

    Raises:
        ValueError: If CELERY_BROKER_URL environment variable is not set

    Environment Variables:
        CELERY_BROKER_URL: Required. Redis broker URL
        CELERY_RESULT_BACKEND: Optional. Result backend URL (defaults to broker URL)

    Example:
        >>> flower_app = create_broker_celery_app()
        >>> # Use with: celery --app=ibutsu_server:flower_app flower
    """
    broker_url = os.environ.get("CELERY_BROKER_URL")
    if not broker_url:
        msg = "CELERY_BROKER_URL environment variable must be set"
        raise ValueError(msg)

    # Read result backend from environment - check multiple possible variable names
    result_backend = (
        os.environ.get("CELERY_RESULT_BACKEND")
        or os.environ.get("CELERY_RESULT_BACKEND_URL")
        or broker_url
    )

    celery_app = Celery(name)
    celery_app.conf.update(
        broker_url=broker_url,
        result_backend=result_backend,
        # Configure Redis transport options for proper RPC communication
        redis_socket_timeout=SOCKET_TIMEOUT,
        redis_socket_connect_timeout=SOCKET_CONNECT_TIMEOUT,
        redis_retry_on_timeout=True,
        broker_transport_options={
            "socket_timeout": SOCKET_TIMEOUT,
            "socket_connect_timeout": SOCKET_CONNECT_TIMEOUT,
        },
        result_backend_transport_options={
            "socket_timeout": SOCKET_TIMEOUT,
            "socket_connect_timeout": SOCKET_CONNECT_TIMEOUT,
        },
        # Don't import task modules - would require database access
        # Flower discovers tasks from workers via broker introspection
    )

    return celery_app


def create_flask_celery_app(app=None, name="ibutsu_server"):
    """
    Create a Flask-integrated Celery app (for workers and scheduler).

    This function creates a fully-featured Celery application with Flask integration,
    database access, task module imports, beat schedule, and signal handlers. It's
    designed for worker and scheduler containers that execute tasks and need full
    application context.

    The created Celery app uses IbutsuTask as the base task class, which automatically
    provides Flask application context for all task executions, enabling direct access
    to db.session, current_app, and other Flask context-dependent resources.

    Args:
        app: Flask application instance (optional if called from within app context)
        name: Name for the Celery app (default: "ibutsu_server")

    Returns:
        Celery: Configured Flask-integrated Celery app instance

    Raises:
        ValueError: If Flask app is None and no app context is available

    Flask Config Requirements:
        The Flask app must have the following configuration:
        - CELERY['broker_url']: Redis broker URL
        - CELERY['result_backend']: Result backend URL
        - SQLALCHEMY_DATABASE_URI: Database connection string

    Example:
        >>> from flask import Flask
        >>> flask_app = Flask(__name__)
        >>> # ... configure flask_app ...
        >>> worker_app = create_flask_celery_app(flask_app, name="ibutsu_server_worker")
        >>> # Use with: celery --app=ibutsu_server:worker_app worker
    """
    if app is None:
        msg = "Flask app instance is required for Flask-integrated Celery app"
        raise ValueError(msg)

    # Store the Flask app globally so it's available to our custom IbutsuTask class
    set_flask_app(app)

    celery_app = Celery(
        name,
        task_cls=IbutsuTask,
    )

    # Configure from Flask app config using CELERY namespace
    celery_app.config_from_object(app.config, namespace="CELERY")
    celery_app.set_default()

    # Store in Flask app extensions for easy retrieval
    app.extensions["celery"] = celery_app

    # Configure Redis transport options
    celery_app.conf.redis_socket_timeout = SOCKET_TIMEOUT
    celery_app.conf.redis_socket_connect_timeout = SOCKET_CONNECT_TIMEOUT
    celery_app.conf.redis_retry_on_timeout = True
    celery_app.conf.broker_transport_options = celery_app.conf.result_backend_transport_options = {
        "socket_timeout": SOCKET_TIMEOUT,
        "socket_connect_timeout": SOCKET_CONNECT_TIMEOUT,
    }

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
        "prune-old-import-files": {
            "task": "ibutsu_server.tasks.db.prune_old_import_files",
            "schedule": crontab(minute=0, hour=2),  # 2 am daily
            "args": (7,),  # delete any import files older than 7 days
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
    def retry_task_on_exception(*_args, **kwargs):
        """Retry a task automatically when it fails"""
        task = kwargs.get("sender")
        einfo = kwargs.get("einfo")
        logging.warning("Uncaught exception: %r for task %s", einfo, task)
        # Incremental backoff, starts at a minute and maxes out at 1 hour.
        backoff = min(2**task.request.retries, 3600)
        task.retry(countdown=backoff)

    return celery_app


__all__ = ["create_broker_celery_app", "create_flask_celery_app"]
