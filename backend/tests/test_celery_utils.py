"""Tests for ibutsu_server.celery_utils module."""

import pytest
from celery import Celery

from ibutsu_server.celery_utils import create_broker_celery_app, create_flask_celery_app
from ibutsu_server.constants import SOCKET_CONNECT_TIMEOUT, SOCKET_TIMEOUT


@pytest.fixture(autouse=True)
def setup_celery_env(monkeypatch):
    """Set up required Celery environment variables for all tests in this module."""
    from ibutsu_server import _AppRegistry

    # Reset the registry to ensure clean state for each test
    _AppRegistry.reset()

    # Set up environment variables
    monkeypatch.setenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

    yield

    # Clean up after test
    _AppRegistry.reset()


class TestCreateBrokerCeleryApp:
    """Tests for create_broker_celery_app() function."""

    def test_create_broker_celery_app_basic(self):
        """Test that create_broker_celery_app creates a valid Celery app."""
        app = create_broker_celery_app()

        assert app is not None
        assert isinstance(app, Celery)
        assert app.main == "ibutsu_server_flower"

    def test_create_broker_celery_app_custom_name(self):
        """Test that create_broker_celery_app accepts a custom name."""
        app = create_broker_celery_app(name="custom_flower")

        assert app.main == "custom_flower"

    def test_create_broker_celery_app_broker_url_configured(self):
        """Test that broker URL is configured correctly."""
        app = create_broker_celery_app()

        assert app.conf.broker_url == "redis://localhost:6379/0"

    def test_create_broker_celery_app_result_backend_configured(self):
        """Test that result backend is configured correctly."""
        app = create_broker_celery_app()

        assert app.conf.result_backend == "redis://localhost:6379/0"

    def test_create_broker_celery_app_socket_timeouts(self):
        """Test that socket timeouts are configured correctly."""
        app = create_broker_celery_app()

        assert app.conf.redis_socket_timeout == SOCKET_TIMEOUT
        assert app.conf.redis_socket_connect_timeout == SOCKET_CONNECT_TIMEOUT
        assert app.conf.redis_retry_on_timeout is True

    def test_create_broker_celery_app_transport_options(self):
        """Test that transport options are configured correctly."""
        app = create_broker_celery_app()

        assert app.conf.broker_transport_options is not None
        assert app.conf.broker_transport_options["socket_timeout"] == SOCKET_TIMEOUT
        assert app.conf.broker_transport_options["socket_connect_timeout"] == SOCKET_CONNECT_TIMEOUT

        assert app.conf.result_backend_transport_options is not None
        assert app.conf.result_backend_transport_options["socket_timeout"] == SOCKET_TIMEOUT
        assert (
            app.conf.result_backend_transport_options["socket_connect_timeout"]
            == SOCKET_CONNECT_TIMEOUT
        )

    def test_create_broker_celery_app_without_broker_url(self, monkeypatch):
        """Test that create_broker_celery_app raises error without CELERY_BROKER_URL."""
        monkeypatch.delenv("CELERY_BROKER_URL", raising=False)

        with pytest.raises(ValueError, match="CELERY_BROKER_URL environment variable must be set"):
            create_broker_celery_app()

    def test_create_broker_celery_app_result_backend_defaults_to_broker(self, monkeypatch):
        """Test that result backend defaults to broker URL if not specified."""
        monkeypatch.delenv("CELERY_RESULT_BACKEND", raising=False)
        monkeypatch.setenv("CELERY_BROKER_URL", "redis://localhost:6379/1")

        app = create_broker_celery_app()

        assert app.conf.result_backend == "redis://localhost:6379/1"

    def test_create_broker_celery_app_alternative_result_backend_var(self, monkeypatch):
        """Test that CELERY_RESULT_BACKEND_URL is also recognized."""
        monkeypatch.delenv("CELERY_RESULT_BACKEND", raising=False)
        monkeypatch.setenv("CELERY_RESULT_BACKEND_URL", "redis://localhost:6379/2")

        app = create_broker_celery_app()

        assert app.conf.result_backend == "redis://localhost:6379/2"


class TestCreateFlaskCeleryApp:
    """Tests for create_flask_celery_app() function."""

    def test_create_flask_celery_app_basic(self, flask_app):
        """Test that create_flask_celery_app creates a valid Celery app."""
        client, _ = flask_app

        app = create_flask_celery_app(client.application, name="test_app")

        assert app is not None
        assert isinstance(app, Celery)
        assert app.main == "test_app"

    def test_create_flask_celery_app_default_name(self, flask_app):
        """Test that create_flask_celery_app uses default name when not specified."""
        client, _ = flask_app

        app = create_flask_celery_app(client.application)

        assert app.main == "ibutsu_server"

    def test_create_flask_celery_app_without_flask_app(self):
        """Test that create_flask_celery_app raises error without Flask app."""
        with pytest.raises(
            ValueError, match="Flask app instance is required for Flask-integrated Celery app"
        ):
            create_flask_celery_app(None)

    def test_create_flask_celery_app_stored_in_extensions(self, flask_app):
        """Test that Celery app is stored in Flask app extensions."""
        client, _ = flask_app

        app = create_flask_celery_app(client.application, name="test_app")

        assert "celery" in client.application.extensions
        assert client.application.extensions["celery"] is app

    def test_create_flask_celery_app_socket_timeouts(self, flask_app):
        """Test that socket timeouts are configured correctly."""
        client, _ = flask_app

        app = create_flask_celery_app(client.application)

        assert app.conf.redis_socket_timeout == SOCKET_TIMEOUT
        assert app.conf.redis_socket_connect_timeout == SOCKET_CONNECT_TIMEOUT
        assert app.conf.redis_retry_on_timeout is True

    def test_create_flask_celery_app_transport_options(self, flask_app):
        """Test that transport options are configured correctly."""
        client, _ = flask_app

        app = create_flask_celery_app(client.application)

        assert app.conf.broker_transport_options is not None
        assert app.conf.broker_transport_options["socket_timeout"] == SOCKET_TIMEOUT
        assert app.conf.broker_transport_options["socket_connect_timeout"] == SOCKET_CONNECT_TIMEOUT

        assert app.conf.result_backend_transport_options is not None
        assert app.conf.result_backend_transport_options["socket_timeout"] == SOCKET_TIMEOUT
        assert (
            app.conf.result_backend_transport_options["socket_connect_timeout"]
            == SOCKET_CONNECT_TIMEOUT
        )

    def test_create_flask_celery_app_beat_schedule_configured(self, flask_app):
        """Test that beat schedule is configured with periodic tasks."""
        client, _ = flask_app

        app = create_flask_celery_app(client.application)

        assert app.conf.beat_schedule is not None
        assert "prune-old-artifact-files" in app.conf.beat_schedule
        assert "prune-old-results" in app.conf.beat_schedule
        assert "prune-old-runs" in app.conf.beat_schedule
        assert "sync-aborted-runs" in app.conf.beat_schedule

    def test_create_flask_celery_app_task_class(self, flask_app):
        """Test that IbutsuTask is set as the Task class."""
        client, _ = flask_app
        from ibutsu_server.util.celery_task import IbutsuTask

        app = create_flask_celery_app(client.application)

        assert app.Task is IbutsuTask

    def test_create_flask_celery_app_tasks_imported(self, flask_app):
        """Test that task modules are imported and tasks are registered."""
        client, _ = flask_app

        app = create_flask_celery_app(client.application)

        # Check that tasks from various modules are registered
        # We can't check exact task names without importing them, but we can verify
        # the app has tasks registered
        assert len(app.tasks) > 0

        # Check for some known task prefixes
        task_names = list(app.tasks.keys())
        has_ibutsu_tasks = any("ibutsu_server.tasks" in name for name in task_names)
        assert has_ibutsu_tasks, f"Expected ibutsu_server tasks, got: {task_names}"


class TestFactoryComparison:
    """Tests comparing broker-only and Flask-integrated factories."""

    def test_unique_app_names(self, flask_app):
        """Test that different factory calls create apps with different names."""
        client, _ = flask_app

        broker_app = create_broker_celery_app(name="flower")
        flask_app1 = create_flask_celery_app(client.application, name="worker")
        flask_app2 = create_flask_celery_app(client.application, name="scheduler")

        names = {broker_app.main, flask_app1.main, flask_app2.main}
        assert len(names) == 3, f"Expected 3 unique names, got: {names}"

    def test_broker_app_has_no_beat_schedule(self):
        """Test that broker-only app does not have beat schedule configured."""
        app = create_broker_celery_app()

        # Broker-only app should not have beat_schedule configured
        # (or it should be empty/default)
        beat_schedule = getattr(app.conf, "beat_schedule", None)
        assert beat_schedule is None or len(beat_schedule) == 0

    def test_flask_app_has_beat_schedule(self, flask_app):
        """Test that Flask-integrated app has beat schedule configured."""
        client, _ = flask_app

        app = create_flask_celery_app(client.application)

        assert app.conf.beat_schedule is not None
        assert len(app.conf.beat_schedule) > 0

    def test_both_apps_have_socket_timeouts(self, flask_app):
        """Test that both factory types configure socket timeouts."""
        client, _ = flask_app

        broker_app = create_broker_celery_app()
        flask_app_instance = create_flask_celery_app(client.application)

        # Both should have the same timeout configuration
        assert broker_app.conf.redis_socket_timeout == SOCKET_TIMEOUT
        assert flask_app_instance.conf.redis_socket_timeout == SOCKET_TIMEOUT

        assert broker_app.conf.redis_socket_connect_timeout == SOCKET_CONNECT_TIMEOUT
        assert flask_app_instance.conf.redis_socket_connect_timeout == SOCKET_CONNECT_TIMEOUT
