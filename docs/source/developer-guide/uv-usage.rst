UV Usage Guide
==============

This document explains how to use `uv` for development, dependency management, building, and testing of the ibutsu-server backend.

Prerequisites
-------------

* Python 3.14+ installed (or let `uv` download and manage Python versions automatically)
* `uv` installed (`curl -LsSf https://astral.sh/uv/install.sh | sh` or via system package manager)

Managing Environments and Dependencies
--------------------------------------

`uv` is used to manage the virtual environment and synchronize dependencies according to ``pyproject.toml`` and ``uv.lock``.

Synchronizing Dependencies
~~~~~~~~~~~~~~~~~~~~~~~~~~

To create or synchronize the virtual environment with all default dependency groups (``server``, ``worker``, ``test``, ``dev``):

.. code-block:: bash

   cd backend
   uv sync

In CI or production environments where the lockfile must not be modified:

.. code-block:: bash

   uv sync --frozen

Targeted Dependency Groups
~~~~~~~~~~~~~~~~~~~~~~~~~~

The project defines several dependency groups in ``pyproject.toml`` for container images and targeted installations:

* ``server``: API server dependencies (Connexion, Uvicorn, Gunicorn, Starlette, etc.)
* ``worker``: Celery worker dependencies (Gevent, lxml)
* ``flower``: Flower monitoring dependencies
* ``test``: Testing dependencies (pytest, pytest-cov, pytest-xdist, etc.)
* ``dev``: Development dependencies (pre-commit)

To sync only specific groups (e.g. for container builds):

.. code-block:: bash

   # Server only (with core dependencies)
   uv sync --frozen --no-dev --no-default-groups --group server

   # Worker only (with core dependencies)
   uv sync --frozen --no-dev --no-default-groups --group worker

   # Flower only
   uv sync --frozen --no-dev --no-default-groups --only-group flower

Updating Dependencies
~~~~~~~~~~~~~~~~~~~~~

To lock dependencies and update ``uv.lock``:

.. code-block:: bash

   uv lock

To upgrade a specific package:

.. code-block:: bash

   uv lock --upgrade-package <package-name>

Running Tests
-------------

Unit and integration tests are executed using ``pytest`` via ``uv run``:

.. code-block:: bash

   cd backend

   # Run all tests (configured in pyproject.toml with parallel execution)
   uv run pytest

   # Run tests with coverage
   uv run pytest --cov=ibutsu_server --cov-report=xml --cov-report=term --cov-report=html

   # Run specific test file
   uv run pytest tests/controllers/test_health_controller.py

   # Run specific test function
   uv run pytest tests/controllers/test_health_controller.py::test_health_check

   # Run without parallel execution
   uv run pytest -n 0

   # Run with verbose output and stop on first failure
   uv run pytest -v -x

Running Tests by Marker
~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

   # Run integration tests
   uv run pytest -m integration

   # Run validation tests
   uv run pytest -m validation

   # Deselect slow tests
   uv run pytest -m "not slow"

Database Migrations with Alembic
--------------------------------

Alembic commands can be run directly using ``uv run``:

.. code-block:: bash

   cd backend

   # Create a new migration revision
   uv run alembic revision -m "description of migration"

   # Upgrade database to head
   uv run alembic upgrade head

   # Downgrade by one revision
   uv run alembic downgrade -1

   # View current revision history
   uv run alembic history

Linting and Code Quality
------------------------

Run pre-commit hooks using ``uv run`` or ``uvx``:

.. code-block:: bash

   # Run all pre-commit hooks via uv run
   uv run pre-commit run --all-files

   # Alternatively, using uvx (ephemeral tool runner)
   uvx pre-commit run --all-files

Building Packages
-----------------

The project uses ``hatchling`` as the PEP 517 build-backend configured in ``[build-system]``.
Packages (wheels and source distributions) are built using ``uv build``:

.. code-block:: bash

   cd backend

   # Build wheel and sdist into dist/
   uv build

   # Build wheel only
   uv build --wheel

   # Build source distribution only
   uv build --sdist

Managing Project Version
------------------------

Version numbers in ``backend/pyproject.toml`` and ``uv.lock`` can be inspected and updated with ``uv version``:

.. code-block:: bash

   # Show current backend version
   uv version --short --project backend

   # Bump version and update uv.lock
   uv version 3.2.0 --project backend

Release Automation
------------------

The release script located at ``scripts/make-release.sh`` uses ``uv version`` to bump the backend version, update ``uv.lock``, synchronize version numbers across ``backend/ibutsu_server/openapi/openapi.yaml`` and ``frontend/package.json``, and stage changes:

.. code-block:: bash

   # Run interactive release script
   ./scripts/make-release.sh

   # Or provide version explicitly
   ./scripts/make-release.sh 3.2.0
