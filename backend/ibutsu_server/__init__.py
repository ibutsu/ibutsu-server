import os
from importlib import import_module
from pathlib import Path

from connexion import App
from flask import redirect
from flask import request
from flask_cors import CORS
from ibutsu_server.db.base import db
from ibutsu_server.encoder import JSONEncoder
from ibutsu_server.tasks import create_celery_app
from yaml import load as yaml_load

FRONTEND_PATH = Path("/app/frontend")


def _make_sql_url(hostname, database, **kwargs):
    """Build a URL for SQLAlchemy"""
    url = hostname
    if kwargs.get("port"):
        url = "{}:{}".format(url, kwargs["port"])
    if kwargs.get("user"):
        credentials = kwargs["user"]
        if kwargs.get("password"):
            credentials = "{}:{}".format(credentials, kwargs["password"])
        url = "{}@{}".format(credentials, url)
    return "postgresql://{}/{}".format(url, database)


def get_app(**extra_config):
    """Create the WSGI application"""

    app = App(__name__, specification_dir="./openapi/")
    app.app.json_encoder = JSONEncoder

    # Shortcut
    config = app.app.config
    config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", True)
    if Path("./settings.yaml").exists():
        # If there's a config file, load it
        config.from_file("./settings.yaml", load=yaml_load)
    # Now load config from environment variables
    config.from_mapping(os.environ)
    if config.get("POSTGRESQL_HOST") and config.get("POSTGRESQL_DATABASE"):
        # If you have environment variables, like when running on OpenShift, create the db url
        config.update(
            {
                "SQLALCHEMY_DATABASE_URI": _make_sql_url(
                    config["POSTGRESQL_HOST"],
                    config["POSTGRESQL_DATABASE"],
                    port=config.get("POSTGRESQL_PORT"),
                    user=config.get("POSTGRESQL_USER"),
                    password=config.get("POSTGRESQL_PASSWORD"),
                )
            }
        )
    # Load any extra config
    config.update(extra_config)

    create_celery_app(app.app)
    app.add_api(
        "openapi.yaml", arguments={"title": "Ibutsu"}, base_path="/api", pythonic_params=True
    )

    CORS(app.app)
    db.init_app(app.app)

    with app.app.app_context():
        db.create_all()

    @app.route("/")
    def index():
        return redirect("/api/ui/", code=302)

    @app.route("/admin/run-task", methods=["POST"])
    def run_task():
        params = request.get_json(force=True, silent=True)
        if not params:
            return "Bad request", 400
        task_path = params.get("task")
        task_params = params.get("params", {})
        if not task_path:
            return "Bad request", 400
        task_module, task_name = task_path.split(".", 2)
        try:
            mod = import_module(f"ibutsu_server.tasks.{task_module}")
        except ImportError:
            return "Not found", 404
        if not hasattr(mod, task_name):
            return "Not found", 404
        task = getattr(mod, task_name)
        task.delay(**task_params)
        return "Accepted", 202

    return app
