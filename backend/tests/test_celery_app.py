"""Tests for unique Celery app names in ibutsu_server."""

import pytest


@pytest.fixture(autouse=True)
def setup_celery_env(monkeypatch):
    """Set up required Celery environment variables for all tests in this module."""
    monkeypatch.setenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")


def test_flower_app_minimal_config():
    """Test that flower_app has minimal configuration (broker-only)."""
    from ibutsu_server import flower_app

    # Flower app should have broker_url configured
    assert flower_app.conf.broker_url is not None
    assert flower_app.conf.result_backend is not None
    # Flower app should have the unique name
    assert flower_app.main == "ibutsu_server_flower"


def test_celery_app_unique_names(flask_app):
    """Test that each Celery app has a unique name for log clarity."""
    from ibutsu_server import flower_app, scheduler_app, worker_app

    # Each app should have a distinct name for clarity in logs and monitoring
    assert flower_app.main == "ibutsu_server_flower"
    assert worker_app.main == "ibutsu_server_worker"
    assert scheduler_app.main == "ibutsu_server_scheduler"


def test_celery_app_names_are_distinct(flask_app):
    """Test that all Celery app names are different from each other."""
    from ibutsu_server import flower_app, scheduler_app, worker_app

    names = {flower_app.main, worker_app.main, scheduler_app.main}
    # All three names should be unique (set should have 3 elements)
    assert len(names) == 3, f"Expected 3 unique names, got: {names}"


def test_worker_and_scheduler_apps_have_flask_integration(flask_app):
    """Test that worker and scheduler apps have Flask integration."""
    from ibutsu_server import scheduler_app, worker_app

    # Both should be configured with the IbutsuTask class for Flask context
    assert worker_app.Task is not None
    assert scheduler_app.Task is not None


def test_create_celery_app_with_custom_name(flask_app):
    """Test that create_celery_app accepts a custom name parameter."""
    client, _ = flask_app
    from ibutsu_server.tasks import create_celery_app

    # Create a test app with Flask app and custom name
    test_app = create_celery_app(client.application, name="test_custom_name")
    assert test_app.main == "test_custom_name"


def test_create_celery_app_default_name(flask_app):
    """Test that create_celery_app uses default name when not specified."""
    client, _ = flask_app
    from ibutsu_server.tasks import create_celery_app

    # Create a test app without specifying name (should use default)
    test_app = create_celery_app(client.application)
    assert test_app.main == "ibutsu_server"
