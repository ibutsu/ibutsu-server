"""
Celery task utilities for ASGI/Flask integration.

This module provides the base Celery task class (IbutsuTask) which properly handles
Flask application context in Celery workers.
"""

import logging

from celery import Task, shared_task as orig_shared_task

from ibutsu_server.db import db
from ibutsu_server.db.models import Report
from ibutsu_server.util.app_context import with_app_context

# Reference to the Flask app - will be set by the create_celery_app function
_flask_app = None


def set_flask_app(app):
    """Store a reference to the Flask app for use in Celery tasks"""
    global _flask_app  # noqa: PLW0603
    _flask_app = app


def get_flask_app():
    """Get the Flask app instance for use in tasks"""
    global _flask_app  # noqa: PLW0603
    if _flask_app is None:
        # Lazy import to avoid circular imports
        from ibutsu_server import flask_app  # noqa: PLC0415

        _flask_app = flask_app
    return _flask_app


def shared_task(*args, **kwargs):
    """
    A wrapper around Celery's shared_task that ensures all tasks run within
    a Flask application context and use the IbutsuTask.

    This function creates tasks that use the IbutsuTask base class, which
    automatically manages Flask application context. Tasks created with this
    decorator can directly access Flask extensions and SQLAlchemy sessions
    without manual context management.

    Usage:
        from ibutsu_server.tasks import shared_task

        @shared_task
        def my_task(arg1, arg2):
            # Can use db.session, current_app, and other Flask context-dependent
            # resources directly here without manual context management
            ...
    """
    # Use our custom task class by default
    kwargs.setdefault("base", IbutsuTask)
    return orig_shared_task(*args, **kwargs)


class IbutsuTask(Task):
    """
    Base Celery task class for Ibutsu that ensures Flask app context is available.

    This class uses the @with_app_context decorator from ibutsu_server.util.app_context
    to ensure that all task execution methods (run, after_return, on_failure) are
    executed within a Flask application context. This guarantees that:

    1. All Flask extensions are properly initialized
    2. SQLAlchemy sessions can be used directly
    3. No manual app context management is needed in task implementations

    Tasks that inherit from this class can directly access db.session, Flask extensions,
    and other Flask context-dependent resources without manual context management.
    """

    abstract = True

    @with_app_context
    def __call__(self, *args, **kwargs):
        """
        Run the task.

        We no longer need to manage app context here since the run method is decorated
        with @with_app_context. This maintains the standard Celery Task behavior while
        delegating app context management to the decorated run method.
        """
        return super().__call__(*args, **kwargs)

    @with_app_context
    def _set_report_error(self, report):
        """
        Set a report's status to error and save it.

        Uses @with_app_context to ensure SQLAlchemy session operations
        are performed within a Flask application context.
        """
        report.status = "error"
        db.session.add(report)
        db.session.commit()

    @with_app_context
    def after_return(self, _status, retval, _task_id, _args, _kwargs, _einfo):
        """
        Handle database session after task completion.

        This method is automatically called by Celery after a task returns.
        It commits successful transactions and cleans up the session.
        The @with_app_context decorator ensures this runs in a Flask app context.
        """
        # Commit only on successful completion (no exception)
        if not isinstance(retval, Exception):
            try:
                db.session.commit()
            except Exception as e:
                logging.error(f"Error committing session: {e}")
                db.session.rollback()
                raise
        db.session.remove()

    @with_app_context
    def on_failure(self, _exc, task_id, args, _kwargs, _einfo):
        """
        Handle task failure, particularly for reports.

        This method is automatically called by Celery when a task fails with an exception.
        It checks if the task is related to a report and marks the report as errored if so.
        The @with_app_context decorator ensures this runs in a Flask app context.
        """
        # If the task is related to a report, set that report to failed
        if args and isinstance(args[0], dict):
            try:
                report_id = args[0].get("id")  # get the report ID from the task
                if not report_id:
                    return
                report = db.session.get(Report, report_id)
                # if this is actually a report ID, set it as an error
                if report:
                    self._set_report_error(report)
            except AttributeError as e:
                logging.error(f"Attribute error in on_failure: {e}. Args are {args}")
            except (IndexError, TypeError) as e:
                logging.error(f"Error in on_failure: {e}")
        else:
            # the task is not related to a report
            logging.info(f"Task {task_id} with args {args} is not related to a report")
