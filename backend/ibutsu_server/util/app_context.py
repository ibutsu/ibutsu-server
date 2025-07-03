"""Utilities for ensuring proper Flask application context.

This module provides a decorator to ensure functions run within a Flask application context,
which is crucial for Flask-SQLAlchemy 3.0+ where db.session access requires an app context.
"""

import functools

from flask import has_app_context


def with_app_context(func):
    """Decorator to ensure a function runs within a Flask application context.

    This is crucial for Flask-SQLAlchemy 3.0+ where db.session access
    must always be within an application context.

    Usage:
        from ibutsu_server.util.app_context import with_app_context

        @with_app_context
        def my_function(arg1, arg2):
            # Use db.session here safely
            ...
    """

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if has_app_context():
            # If we're already in an app context, just call the function
            return func(*args, **kwargs)
        # Otherwise, create an app context first
        from ibutsu_server import get_app  # noqa: PLC0415

        app = get_app().app
        with app.app_context():
            return func(*args, **kwargs)

    return wrapper
