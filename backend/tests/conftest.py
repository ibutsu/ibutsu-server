"""
Fixtures are organized into separate modules in fixtures/:
- constants.py: Standard test IDs and values
- database.py: Flask app, database session, and data builders
- auth.py: User authentication and authorization
- utilities.py: HTTP headers, pagination, etc.

This file uses pytest_plugins to automatically load all fixtures from the fixtures module.

Note: The test suite uses integration testing with real database operations.
Use the flask_app fixture and builder fixtures (make_project, make_run, etc.) for tests.
"""

import os

import pytest

# Use pytest_plugins to load all fixtures from the fixtures module
pytest_plugins = ["tests.fixtures"]


def pytest_configure(config):
    """Configure pytest environment before test collection.

    Sets up required environment variables that are needed during module imports.
    This runs before test collection, allowing modules to import components that
    require environment variables (e.g., flower_app requires CELERY_BROKER_URL).

    Note: Only CELERY_BROKER_URL is set here. Individual tests can set
    CELERY_RESULT_BACKEND or CELERY_RESULT_BACKEND_URL as needed without conflicts.
    """
    # Set default Celery broker URL for tests if not already set
    if "CELERY_BROKER_URL" not in os.environ:
        os.environ["CELERY_BROKER_URL"] = "redis://localhost:6379/0"


@pytest.fixture
def reset_app_registry():
    """Fixture to reset the _AppRegistry before and after each test.

    This ensures a clean state for tests that access module-level app instances
    (connexion_app, flask_app, celery_app, worker_app, scheduler_app, flower_app).

    Usage:
        def test_my_app_feature(reset_app_registry):
            from ibutsu_server import flask_app
            # flask_app will be freshly initialized
            assert flask_app is not None

    Note: The flask_app fixture in fixtures/database.py already provides app
    registry reset as part of its setup/teardown. Use that fixture for integration
    tests that need a fully configured Flask application with database.

    Use this fixture for unit tests that need to test module-level app access
    in isolation without the full Flask app setup.
    """
    from ibutsu_server import _AppRegistry  # noqa: PLC0415 - Fixture pattern, avoid circular import

    _AppRegistry.reset()
    yield
    # Clean up after test
    _AppRegistry.reset()
