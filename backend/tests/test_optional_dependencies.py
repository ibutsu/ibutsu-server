"""Light entry points must not import the web stack.

The Flower image installs only the ``flower`` dependency group. Importing
``ibutsu_server`` or ``ibutsu_server.celery_utils`` and building ``flower_app`` therefore
must not import Flask, Connexion, SQLAlchemy or Starlette.
Each check runs in a fresh interpreter so modules imported by other tests do not hide a regression.
"""

import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).parent.parent
HEAVY_MODULES = ("connexion", "flask", "flask_mail", "sqlalchemy", "starlette")


def _heavy_modules_loaded_after(statement):
    script = f"""
import json, os, sys
os.environ["CELERY_BROKER_URL"] = "redis://localhost:6379/0"
{statement}
print(json.dumps([m for m in {HEAVY_MODULES!r} if m in sys.modules]))
"""
    result = subprocess.run(  # noqa: S603 - intentionally launches the current interpreter
        [sys.executable, "-c", script],
        cwd=BACKEND_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def test_package_import_is_light():
    assert _heavy_modules_loaded_after("import ibutsu_server") == "[]"


def test_celery_utils_import_is_light():
    assert _heavy_modules_loaded_after("import ibutsu_server.celery_utils") == "[]"


def test_flower_app_is_built_without_web_stack():
    statement = (
        "from ibutsu_server import flower_app\nassert flower_app.main == 'ibutsu_server_flower'"
    )
    assert _heavy_modules_loaded_after(statement) == "[]"
    statement = (
        "from ibutsu_server.celery_utils import flower_app\n"
        "assert flower_app.main == 'ibutsu_server_flower'"
    )
    assert _heavy_modules_loaded_after(statement) == "[]"
