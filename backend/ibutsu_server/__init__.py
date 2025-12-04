import os
from http import HTTPStatus
from importlib import import_module
from pathlib import Path
from typing import Any

import connexion
import flask
from flask import redirect, request
from flask_mail import Mail
from sqlalchemy import create_engine
from sqlalchemy.engine.url import URL as SQLA_URL
from starlette.middleware.cors import CORSMiddleware
from yaml import full_load as yaml_load

from ibutsu_server.auth import bcrypt
from ibutsu_server.db import upgrades
from ibutsu_server.db.models import User, upgrade_db
from ibutsu_server.db.util import add_superadmin
from ibutsu_server.encoder import IbutsuJSONProvider
from ibutsu_server.tasks import create_celery_app
from ibutsu_server.util.jwt import decode_token

FRONTEND_PATH = Path("/app/frontend")


def maybe_sql_url(conf: dict[str, Any]) -> SQLA_URL | None:
    host = conf.get("host") or conf.get("hostname")
    database = conf.get("db") or conf.get("database")
    if host and database:
        # Build query parameters only if they exist
        query_params = {}
        if sslmode := conf.get("sslmode"):
            query_params["sslmode"] = sslmode

        return SQLA_URL.create(
            drivername="postgresql",
            host=host,
            database=database,
            port=conf.get("port"),
            username=conf.get("user"),
            password=conf.get("password"),
            query=query_params if query_params else None,
        )
    return None


def check_envvar(config: flask.Config, *, envvar: str) -> str:
    """
    Get Redis URL from environment variable.

    Args:
        config: Flask config object
        envvar: Environment variable name (e.g., "CELERY_BROKER_URL")

    Returns:
        Redis connection URL

    Raises:
        ValueError: If the environment variable is not set
    """
    if var := config.get(envvar):
        return var
    msg = f"Missing required environment variable: {envvar}"
    raise ValueError(msg)


def get_app(**extra_config):
    """Create the WSGI application for ASGI wrapper"""

    connexion_app = connexion.FlaskApp(
        __name__, specification_dir="./openapi/", jsonifier=IbutsuJSONProvider()
    )
    # Get the underlying Flask app
    # (connexion_app is the Connexion wrapper, flask_app is the actual Flask application)
    flask_app = connexion_app.app
    # Shortcut to the Flask app config
    config: flask.Config = flask_app.config
    config.setdefault("BCRYPT_LOG_ROUNDS", 12)
    config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)
    config.setdefault("SQLALCHEMY_ENGINE_OPTIONS", {})

    config.from_file(str(Path("./default.settings.yaml").resolve()), yaml_load, silent=True)
    config.from_file(str(Path("./settings.yaml").resolve()), yaml_load, silent=True)
    # Now load config from environment variables
    config.from_mapping(os.environ)
    # convert str to bool for USER_LOGIN_ENABLED
    if isinstance(config.get("USER_LOGIN_ENABLED", True), str):
        config["USER_LOGIN_ENABLED"] = config["USER_LOGIN_ENABLED"].lower()[0] in [
            "y",
            "t",
            "1",
        ]

    # If you have environment variables, like when running on OpenShift, create the db url
    if "SQLALCHEMY_DATABASE_URI" not in extra_config:
        maybe_db_uri = maybe_sql_url(config.get_namespace("POSTGRESQL_")) or maybe_sql_url(
            config.get_namespace("POSTGRES_")
        )

        if maybe_db_uri is None:
            # Flask-SQLAlchemy 3.0+ requires explicit database URI
            # Provide a default for development/testing
            default_db_uri = config.get("SQLALCHEMY_DATABASE_URI", "sqlite:///ibutsu.db")
            config.update(SQLALCHEMY_DATABASE_URI=default_db_uri)
            print(f"⚠️  No database configuration found. Using default: {default_db_uri}")
        else:
            # wait for db to appear in case of pod usage
            config.update(SQLALCHEMY_DATABASE_URI=maybe_db_uri)

            engine = create_engine(maybe_db_uri)
            for _ in range(10):
                try:
                    c = engine.connect()
                except ConnectionError:
                    pass
                else:
                    c.close()
                    break
            engine.dispose()

        # Set celery broker URL
        # hackishly indented to only be part of the setup where extra config won't pass the db
        config.update(
            CELERY_BROKER_URL=check_envvar(config, envvar="CELERY_BROKER_URL"),
            CELERY_RESULT_BACKEND=check_envvar(config, envvar="CELERY_RESULT_BACKEND"),
        )

    # Load any extra config
    config.update(extra_config)

    if "SQLALCHEMY_ENGINE_OPTIONS" not in config:
        db_uri = config.get("SQLALCHEMY_DATABASE_URI", "")
        is_sqlite = False
        if (isinstance(db_uri, str) and db_uri.startswith("sqlite")) or (
            isinstance(db_uri, SQLA_URL) and db_uri.drivername.startswith("sqlite")
        ):
            is_sqlite = True

        if not is_sqlite:
            config["SQLALCHEMY_ENGINE_OPTIONS"] = {
                "connect_args": {"options": "-c statement_timeout=25000"}
            }

    # Configure Celery in the Flask app config
    # Using Celery 6-compatible configuration keys
    config.from_mapping(
        CELERY={
            "broker_url": config.get("CELERY_BROKER_URL"),
            "result_backend": config.get("CELERY_RESULT_BACKEND"),
            "broker_connection_retry": True,
            "broker_connection_retry_on_startup": True,
            "worker_cancel_long_running_tasks_on_connection_loss": True,
            "include": [
                "ibutsu_server.tasks.db",
                "ibutsu_server.tasks.importers",
                "ibutsu_server.tasks.query",
                "ibutsu_server.tasks.results",
                "ibutsu_server.tasks.runs",
            ],
        }
    )
    flask_app.config.from_prefixed_env()

    # Configure CORS middleware for Connexion 3 - MUST be before routes are added
    from connexion.middleware import MiddlewarePosition  # noqa: PLC0415

    from ibutsu_server.db import db  # noqa: PLC0415

    create_celery_app(flask_app)

    # Apply the middleware first, before routes
    connexion_app.add_middleware(
        CORSMiddleware,
        position=MiddlewarePosition.BEFORE_ROUTING,
        allow_origins=["*"],  # Allow all origins
        allow_methods=["*"],  # Allow all HTTP methods
        allow_headers=["*"],  # Allow all headers
    )

    # Add API routes after middleware
    # Import Resolver for explicit operationId resolution
    from connexion.resolver import Resolver  # noqa: PLC0415

    connexion_app.add_api(
        "openapi.yaml",
        arguments={"title": "Ibutsu"},
        base_path="/api",
        pythonic_params=True,
        resolver=Resolver(),
    )

    # Initialize Flask extensions on the underlying Flask app
    db.init_app(flask_app)
    bcrypt.init_app(flask_app)
    Mail(flask_app)

    with flask_app.app_context():
        db.create_all()
        upgrade_db(db.session, upgrades)
        # add a superadmin user
        db.session.commit()
        if superadmin_data := config.get_namespace("IBUTSU_SUPERADMIN_"):
            add_superadmin(db.session, **superadmin_data)

    @flask_app.route("/")
    def index():
        return redirect("/api/ui/", code=HTTPStatus.FOUND)

    @flask_app.route("/admin/run-task", methods=["POST"])
    def run_task():  # noqa: PLR0911
        from ibutsu_server.db import db  # noqa: PLC0415

        # Get params
        params = request.get_json(force=True, silent=True)
        if not params:
            return HTTPStatus.BAD_REQUEST.phrase, HTTPStatus.BAD_REQUEST

        # Get user info
        token = params.get("token")
        if not token:
            return HTTPStatus.UNAUTHORIZED.phrase, HTTPStatus.UNAUTHORIZED

        # Decode token - Flask routes already have app_context
        user_id = decode_token(token).get("sub")
        if not user_id:
            return HTTPStatus.UNAUTHORIZED.phrase, HTTPStatus.UNAUTHORIZED

        # Validate user permissions
        user = db.session.get(User, user_id)
        if not user or not user.is_superadmin:
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN

        # Get task info
        task_path = params.get("task")
        if not task_path:
            return HTTPStatus.BAD_REQUEST.phrase, HTTPStatus.BAD_REQUEST
        task_params = params.get("params", {})
        task_module, task_name = task_path.split(".", 2)

        try:
            mod = import_module(f"ibutsu_server.tasks.{task_module}")
            if not hasattr(mod, task_name):
                return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND
            task = getattr(mod, task_name)
            task.delay(**task_params)
            return HTTPStatus.ACCEPTED.phrase, HTTPStatus.ACCEPTED
        except ImportError:
            return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND

    return connexion_app  # Return Connexion app, not Flask app


class _AppRegistry:
    """
    Registry for application instances to avoid using global statements.

    This pattern is preferred over module-level global variables as it:
    - Avoids PLW0603 linter warnings
    - Provides a clear namespace for app-related state
    - Makes testing easier by allowing state reset
    - Enables deferred app instantiation
    """

    connexion_app = None
    flask_app = None
    celery_app = None
    # Container-specific Celery apps with unique names
    flower_app = None
    worker_app = None
    scheduler_app = None

    @classmethod
    def initialize_apps(cls, **extra_config):
        """Initialize the app instances if not already done."""
        if cls.connexion_app is None:
            cls.connexion_app = get_app(**extra_config)
            cls.flask_app = cls.connexion_app.app
            cls.celery_app = cls.flask_app.extensions.get("celery")
        return cls.connexion_app

    @classmethod
    def reset(cls):
        """Reset the registry (useful for testing)."""
        cls.connexion_app = None
        cls.flask_app = None
        cls.celery_app = None
        cls.flower_app = None
        cls.worker_app = None
        cls.scheduler_app = None

    @classmethod
    def get_connexion_app(cls, **extra_config):
        """Get or create the Connexion app instance."""
        if cls.connexion_app is None:
            cls.initialize_apps(**extra_config)
        return cls.connexion_app

    @classmethod
    def get_flask_app(cls, **extra_config):
        """Get or create the Flask app instance."""
        if cls.flask_app is None:
            cls.initialize_apps(**extra_config)
        return cls.flask_app

    @classmethod
    def get_celery_app(cls, **extra_config):
        """Get or create the Celery app instance."""
        if cls.celery_app is None:
            cls.initialize_apps(**extra_config)
        return cls.celery_app

    @classmethod
    def get_flower_app(cls):
        """
        Get or create the Flower app (broker-only, no database).

        Flower only needs broker access to monitor tasks - no database required.
        Task discovery happens automatically from the workers.

        Returns:
            Celery: Broker-only Celery app instance with name 'ibutsu_server_flower'

        Raises:
            ValueError: If CELERY_BROKER_URL is not set in environment
        """
        if cls.flower_app is None:
            from celery import Celery  # noqa: PLC0415

            broker_url = os.environ.get("CELERY_BROKER_URL")
            if not broker_url:
                msg = "CELERY_BROKER_URL environment variable must be set"
                raise ValueError(msg)

            cls.flower_app = Celery("ibutsu_server_flower")
            cls.flower_app.conf.update(
                broker_url=broker_url,
                result_backend=broker_url,
                # Don't import task modules - would require database access
                # Flower discovers tasks from workers via broker introspection
            )
        return cls.flower_app

    @classmethod
    def get_worker_app(cls):
        """
        Get or create the Worker app (full Flask integration).

        Returns:
            Celery: Flask-integrated Celery app with name 'ibutsu_server_worker'
        """
        if cls.worker_app is None:
            flask_app = cls.get_flask_app()
            cls.worker_app = create_celery_app(flask_app, name="ibutsu_server_worker")
        return cls.worker_app

    @classmethod
    def get_scheduler_app(cls):
        """
        Get or create the Scheduler app (full Flask integration).

        Returns:
            Celery: Flask-integrated Celery app with name 'ibutsu_server_scheduler'
        """
        if cls.scheduler_app is None:
            flask_app = cls.get_flask_app()
            cls.scheduler_app = create_celery_app(flask_app, name="ibutsu_server_scheduler")
        return cls.scheduler_app


def __getattr__(name):
    """
    Lazy initialization of module-level app instances.

    This allows code to import connexion_app, flask_app, celery_app,
    or container-specific apps (flower_app, worker_app, scheduler_app)
    and have them initialized on first access.
    """
    if name == "connexion_app":
        return _AppRegistry.get_connexion_app()
    if name == "flask_app":
        return _AppRegistry.get_flask_app()
    if name == "celery_app":
        return _AppRegistry.get_celery_app()
    if name == "flower_app":
        return _AppRegistry.get_flower_app()
    if name == "worker_app":
        return _AppRegistry.get_worker_app()
    if name == "scheduler_app":
        return _AppRegistry.get_scheduler_app()
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


# Export the app instances and initialization function
__all__ = [
    "_AppRegistry",
    "celery_app",
    "connexion_app",
    "flask_app",
    "flower_app",
    "get_app",
    "scheduler_app",
    "worker_app",
]
