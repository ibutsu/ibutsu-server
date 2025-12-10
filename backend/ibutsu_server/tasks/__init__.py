from ibutsu_server.util.celery_task import IbutsuTask, shared_task
from ibutsu_server.util.redis_lock import lock


def create_celery_app(app=None, name="ibutsu_server"):
    """
    Create the Celery app, using the Flask app.

    .. deprecated::
        This function is maintained for backward compatibility.
        New code should use :func:`ibutsu_server.celery_utils.create_flask_celery_app` directly.

    Args:
        app: Flask application instance
        name: Name for the Celery app (default: "ibutsu_server")

    Returns:
        Celery: Configured Flask-integrated Celery app instance

    Example:
        >>> from flask import Flask
        >>> flask_app = Flask(__name__)
        >>> celery_app = create_celery_app(flask_app, name="my_app")
    """
    from ibutsu_server.celery_utils import create_flask_celery_app  # noqa: PLC0415

    return create_flask_celery_app(app, name)


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
