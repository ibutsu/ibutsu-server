"""Tests for dependencies that are intentionally loaded only when needed."""

import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).parent.parent


def _run_import_without(module_name, import_statement):
    """Run an import while making one optional dependency unavailable."""
    script = f"""
import builtins

original_import = builtins.__import__

def blocking_import(name, *args, **kwargs):
    if name == {module_name!r} or name.startswith({module_name + "."!r}):
        raise ImportError({module_name!r})
    return original_import(name, *args, **kwargs)

builtins.__import__ = blocking_import
{import_statement}
"""
    subprocess.run(  # noqa: S603 - the test intentionally launches the current interpreter
        [sys.executable, "-c", script],
        cwd=BACKEND_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )


def test_package_import_defers_server_dependencies():
    """Importing the package does not require Connexion or Starlette."""
    _run_import_without("connexion", "import ibutsu_server")
    _run_import_without("starlette", "import ibutsu_server")


def test_importers_import_defers_lxml():
    """Importing importer tasks does not require lxml until parsing starts."""
    _run_import_without("lxml", "import ibutsu_server.tasks.importers")
