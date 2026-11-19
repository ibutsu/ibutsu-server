"""Ibutsu server package.

Importing the package (or a light submodule such as ``ibutsu_server.celery_utils``)
must not import the web stack, so containers that only need part of it, like the
Flower image, can install fewer dependencies. The heavy names are resolved lazily
(PEP 562) from ``ibutsu_server.app``; the broker-only ``flower_app`` comes from
``ibutsu_server.celery_utils``.

These names are used as entry points, e.g. ``ibutsu_server:connexion_app`` for
gunicorn and ``celery --app ibutsu_server:worker_app``.
"""

from importlib import import_module

_EXPORTS = {
    "_AppRegistry": "ibutsu_server.app",
    "alembic_flask_app": "ibutsu_server.app",
    "celery_app": "ibutsu_server.app",
    "check_envvar": "ibutsu_server.app",
    "connexion_app": "ibutsu_server.app",
    "flask_app": "ibutsu_server.app",
    "get_app": "ibutsu_server.app",
    "maybe_sql_url": "ibutsu_server.app",
    "scheduler_app": "ibutsu_server.app",
    "worker_app": "ibutsu_server.app",
    "flower_app": "ibutsu_server.celery_utils",
}


def __getattr__(name):
    if module_name := _EXPORTS.get(name):
        return getattr(import_module(module_name), name)
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")
