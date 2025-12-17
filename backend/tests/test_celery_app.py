"""Tests for unique Celery app names in ibutsu_server."""

from unittest.mock import patch

import pytest
from celery import Celery

from ibutsu_server import _AppRegistry
from ibutsu_server.constants import SOCKET_CONNECT_TIMEOUT, SOCKET_TIMEOUT
from ibutsu_server.tasks import create_celery_app


@pytest.fixture(autouse=True)
def setup_celery_env(monkeypatch):
    """Set up required Celery environment variables for all tests in this module.

    Note: This fixture includes _AppRegistry reset functionality. While a shared
    reset_app_registry fixture exists in conftest.py, this module-specific fixture
    is kept as autouse and includes additional environment setup specific to Celery tests.
    """
    # Reset the registry to ensure clean state for each test
    _AppRegistry.reset()

    # Set up environment variables
    monkeypatch.setenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

    yield

    # Clean up after test
    _AppRegistry.reset()


def test_flower_app_minimal_config():
    """Test that flower_app has minimal configuration (broker-only)."""
    from ibutsu_server import flower_app  # noqa: PLC0415 - Lazy import to avoid collection issues

    # Flower app should have broker_url configured
    assert flower_app.conf.broker_url is not None
    assert flower_app.conf.result_backend is not None
    # Flower app should have the unique name
    assert flower_app.main == "ibutsu_server_flower"
    # Flower app should have transport options configured for RPC with correct timeout values
    assert flower_app.conf.redis_socket_timeout == SOCKET_TIMEOUT
    assert flower_app.conf.redis_socket_connect_timeout == SOCKET_CONNECT_TIMEOUT
    assert flower_app.conf.broker_transport_options is not None
    assert flower_app.conf.broker_transport_options["socket_timeout"] == SOCKET_TIMEOUT
    assert (
        flower_app.conf.broker_transport_options["socket_connect_timeout"] == SOCKET_CONNECT_TIMEOUT
    )
    assert flower_app.conf.result_backend_transport_options is not None
    assert flower_app.conf.result_backend_transport_options["socket_timeout"] == SOCKET_TIMEOUT
    assert (
        flower_app.conf.result_backend_transport_options["socket_connect_timeout"]
        == SOCKET_CONNECT_TIMEOUT
    )


def test_celery_app_unique_names(flask_app):
    """Test that each Celery app has a unique name for log clarity."""
    from ibutsu_server import (  # noqa: PLC0415 - Lazy import to avoid collection issues
        flower_app,
        scheduler_app,
        worker_app,
    )

    # Each app should have a distinct name for clarity in logs and monitoring
    assert flower_app.main == "ibutsu_server_flower"
    assert worker_app.main == "ibutsu_server_worker"
    assert scheduler_app.main == "ibutsu_server_scheduler"


def test_celery_app_names_are_distinct(flask_app):
    """Test that all Celery app names are different from each other."""
    from ibutsu_server import (  # noqa: PLC0415 - Lazy import to avoid collection issues
        flower_app,
        scheduler_app,
        worker_app,
    )

    names = {flower_app.main, worker_app.main, scheduler_app.main}
    # All three names should be unique (set should have 3 elements)
    assert len(names) == 3, f"Expected 3 unique names, got: {names}"


def test_worker_and_scheduler_apps_have_flask_integration(flask_app):
    """Test that worker and scheduler apps have Flask integration."""
    from ibutsu_server import (  # noqa: PLC0415 - Lazy import to avoid collection issues
        scheduler_app,
        worker_app,
    )

    # Both should be configured with the IbutsuTask class for Flask context
    assert worker_app.Task is not None
    assert scheduler_app.Task is not None


def test_create_celery_app_with_custom_name(flask_app):
    """Test that create_celery_app accepts a custom name parameter."""
    client, _ = flask_app

    # Create a test app with Flask app and custom name
    test_app = create_celery_app(client.application, name="test_custom_name")
    assert test_app.main == "test_custom_name"


def test_create_celery_app_default_name(flask_app):
    """Test that create_celery_app uses default name when not specified."""
    client, _ = flask_app

    # Create a test app without specifying name (should use default)
    test_app = create_celery_app(client.application)
    assert test_app.main == "ibutsu_server"


def test_app_registry_delegates_to_celery_utils(flask_app):
    """Test that _AppRegistry methods delegate to celery_utils factories."""
    # Reset to ensure clean state
    _AppRegistry.reset()

    # Test that get_flower_app delegates to create_broker_celery_app
    with patch("ibutsu_server._AppRegistry.get_flower_app") as mock_get_flower:
        mock_celery_app = Celery("test_flower")
        mock_get_flower.return_value = mock_celery_app

        # Call the method
        result = _AppRegistry.get_flower_app()

        # Verify it was called
        mock_get_flower.assert_called_once()
        assert result is mock_celery_app

    # Reset for next test
    _AppRegistry.reset()

    # Test that get_worker_app delegates to create_flask_celery_app
    # We need to mock both get_flask_app and create_flask_celery_app
    with (
        patch("ibutsu_server._AppRegistry.get_flask_app") as mock_get_flask,
        patch("ibutsu_server.celery_utils.create_flask_celery_app") as mock_create,
    ):
        client, _ = flask_app
        mock_get_flask.return_value = client.application
        mock_celery_app = Celery("test_worker")
        mock_create.return_value = mock_celery_app

        # Call the method
        result = _AppRegistry.get_worker_app()

        # Verify create_flask_celery_app was called with correct args
        mock_create.assert_called_once()
        call_args = mock_create.call_args
        assert call_args[0][0] is client.application  # Flask app
        assert call_args[1]["name"] == "ibutsu_server_worker"

    # Reset for next test
    _AppRegistry.reset()

    # Test that get_scheduler_app delegates to create_flask_celery_app
    with (
        patch("ibutsu_server._AppRegistry.get_flask_app") as mock_get_flask,
        patch("ibutsu_server.celery_utils.create_flask_celery_app") as mock_create,
    ):
        client, _ = flask_app
        mock_get_flask.return_value = client.application
        mock_celery_app = Celery("test_scheduler")
        mock_create.return_value = mock_celery_app

        # Call the method
        result = _AppRegistry.get_scheduler_app()

        # Verify create_flask_celery_app was called with correct args
        mock_create.assert_called_once()
        call_args = mock_create.call_args
        assert call_args[0][0] is client.application  # Flask app
        assert call_args[1]["name"] == "ibutsu_server_scheduler"


def test_tasks_init_delegates_to_celery_utils(flask_app):
    """Test that tasks.__init__.create_celery_app delegates to celery_utils."""
    client, _ = flask_app

    with patch("ibutsu_server.celery_utils.create_flask_celery_app") as mock_flask:
        mock_flask.return_value = Celery("test_delegated")
        result = create_celery_app(client.application, name="test_name")

        # Should delegate to celery_utils.create_flask_celery_app
        mock_flask.assert_called_once_with(client.application, "test_name")
        assert result.main == "test_delegated"
