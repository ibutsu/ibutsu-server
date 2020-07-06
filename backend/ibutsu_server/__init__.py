from importlib import import_module
from pathlib import Path

from connexion import App
from dynaconf import FlaskDynaconf
from flask import redirect
from flask import request
from flask_cors import CORS
from ibutsu_server.encoder import JSONEncoder

FRONTEND_PATH = Path("/app/frontend")


def get_app():
    app = App(__name__, specification_dir="./openapi/")
    app.app.json_encoder = JSONEncoder
    app.add_api(
        "openapi.yaml", arguments={"title": "Ibutsu"}, base_path="/api", pythonic_params=True
    )
    CORS(app.app)
    FlaskDynaconf(app.app)

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
