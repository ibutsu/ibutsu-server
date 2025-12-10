"""Tests for ibutsu_server.__init__ module"""

import os
from http import HTTPStatus
from unittest.mock import MagicMock, patch

import pytest
from flask import json
from sqlalchemy.engine.url import URL as SQLA_URL

from ibutsu_server import check_envvar, get_app, maybe_sql_url


def test_maybe_sql_url_with_all_params():
    """Test creating SQL URL with all parameters"""
    config = {
        "host": "localhost",
        "database": "testdb",
        "port": 5432,
        "user": "testuser",
        "password": "testpass",
        "sslmode": "require",
    }
    result = maybe_sql_url(config)

    assert isinstance(result, SQLA_URL)
    assert result.drivername == "postgresql"
    assert result.host == "localhost"
    assert result.database == "testdb"
    assert result.port == 5432
    assert result.username == "testuser"
    assert result.password == "testpass"
    assert result.query["sslmode"] == "require"


def test_maybe_sql_url_with_hostname_and_db():
    """Test creating SQL URL with hostname and db aliases"""
    config = {"hostname": "db.example.com", "db": "mydb"}
    result = maybe_sql_url(config)

    assert isinstance(result, SQLA_URL)
    assert result.host == "db.example.com"
    assert result.database == "mydb"
    assert result.port is None
    assert result.username is None
    assert result.password is None


def test_maybe_sql_url_missing_host():
    """Test that None is returned when host is missing"""
    config = {"database": "testdb"}
    result = maybe_sql_url(config)
    assert result is None


def test_maybe_sql_url_missing_database():
    """Test that None is returned when database is missing"""
    config = {"host": "localhost"}
    result = maybe_sql_url(config)
    assert result is None


def test_maybe_sql_url_empty_config():
    """Test that None is returned with empty config"""
    result = maybe_sql_url({})
    assert result is None


def test_maybe_sql_url_without_sslmode():
    """Test creating SQL URL without SSL mode"""
    config = {"host": "localhost", "database": "testdb"}
    result = maybe_sql_url(config)

    assert isinstance(result, SQLA_URL)
    assert result.query == {}


def test_check_envvar_with_envvar():
    """Test when environment variable is already set"""
    config = MagicMock()
    config.get.return_value = "redis://custom:6379/0"

    result = check_envvar(config, envvar="CELERY_BROKER_URL")

    assert result == "redis://custom:6379/0"
    config.get.assert_called_once_with("CELERY_BROKER_URL")


def test_check_envvar_missing_envvar():
    """Test that ValueError is raised when environment variable is not set"""
    config = MagicMock()
    config.get.return_value = None

    with pytest.raises(
        ValueError, match="Missing required environment variable: CELERY_BROKER_URL"
    ):
        check_envvar(config, envvar="CELERY_BROKER_URL")


def test_get_app_basic():
    """Test basic app creation"""
    app = get_app(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")

    assert app is not None
    assert app.app.config["TESTING"] is True
    assert "BCRYPT_LOG_ROUNDS" in app.app.config
    assert app.app.config["BCRYPT_LOG_ROUNDS"] == 12


def test_get_app_with_extra_config():
    """Test app creation with extra configuration"""
    extra_config = {
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "CUSTOM_SETTING": "test_value",
    }
    app = get_app(**extra_config)

    assert app.app.config["CUSTOM_SETTING"] == "test_value"


@patch.dict(os.environ, {"TEST_ENV_VAR": "env_value"})
def test_get_app_loads_environment_variables():
    """Test that app loads configuration from environment variables"""
    app = get_app(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")

    assert app.app.config["TEST_ENV_VAR"] == "env_value"


@pytest.mark.parametrize("value", ["yes", "true", "1", "YES", "TRUE"])
def test_get_app_user_login_enabled_string_true(value):
    """Test USER_LOGIN_ENABLED conversion from string to boolean (true values)"""
    with patch.dict(os.environ, {"USER_LOGIN_ENABLED": value}):
        app = get_app(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")
        assert app.app.config["USER_LOGIN_ENABLED"] is True


@pytest.mark.parametrize("value", ["no", "false", "0", "NO", "FALSE"])
def test_get_app_user_login_enabled_string_false(value):
    """Test USER_LOGIN_ENABLED conversion from string to boolean (false values)"""
    with patch.dict(os.environ, {"USER_LOGIN_ENABLED": value}):
        app = get_app(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")
        assert app.app.config["USER_LOGIN_ENABLED"] is False


def test_get_app_user_login_enabled_boolean():
    """Test USER_LOGIN_ENABLED when already boolean"""
    app = get_app(
        TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:", USER_LOGIN_ENABLED=True
    )
    assert app.app.config["USER_LOGIN_ENABLED"] is True


@patch("ibutsu_server.add_superadmin")
def test_get_app_superadmin_creation(mock_add_superadmin):
    """Test superadmin user creation"""
    superadmin_config = {
        "IBUTSU_SUPERADMIN_EMAIL": "admin@example.com",
        "IBUTSU_SUPERADMIN_NAME": "Admin User",
    }

    app = get_app(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:", **superadmin_config)

    # Verify app was created and superadmin creation is called during app context
    assert app is not None
    mock_add_superadmin.assert_called()


def test_index_route_redirect(flask_app):
    """Test that index route is accessible"""
    client, _ = flask_app
    response = client.get("/")

    # The root route may return 200 (Connexion) or 302 (Flask redirect)
    # Both are acceptable as long as the route is accessible
    assert response.status_code in [HTTPStatus.OK, HTTPStatus.FOUND]


def test_run_task_route_no_params(flask_app):
    """Test run-task route with no parameters"""
    client, _ = flask_app
    response = client.post("/admin/run-task")

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_run_task_route_no_token(flask_app):
    """Test run-task route with no token"""
    client, _ = flask_app
    response = client.post(
        "/admin/run-task",
        data=json.dumps({"task": "test.task"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_run_task_route_invalid_token(flask_app):
    """Test run-task route with invalid token"""
    client, _ = flask_app
    response = client.post(
        "/admin/run-task",
        data=json.dumps({"token": "invalid_token", "task": "test.task"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_run_task_route_non_superadmin(flask_app):
    """Test run-task route with non-superadmin user"""
    client, _ = flask_app
    # Create a non-superadmin user for this test
    from ibutsu_server.db.base import session
    from ibutsu_server.db.models import Token, User
    from ibutsu_server.util.jwt import generate_token

    with client.application.app_context():
        non_superadmin_user = User(
            name="Non-Superadmin User",
            email="nonsuper@example.com",
            is_active=True,
            is_superadmin=False,
        )
        session.add(non_superadmin_user)
        session.commit()

        non_superadmin_token = generate_token(non_superadmin_user.id)
        token_obj = Token(
            name="non-superadmin-token", user=non_superadmin_user, token=non_superadmin_token
        )
        session.add(token_obj)
        session.commit()

    response = client.post(
        "/admin/run-task",
        data=json.dumps({"token": non_superadmin_token, "task": "test.task"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == HTTPStatus.FORBIDDEN


def test_run_task_route_no_task(flask_app):
    """Test run-task route with no task specified"""
    client, jwt_token = flask_app
    # The flask_app fixture creates a superadmin user, so use that token

    response = client.post(
        "/admin/run-task",
        data=json.dumps({"token": jwt_token}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


@patch("ibutsu_server.import_module")
def test_run_task_route_module_not_found(mock_import_module, flask_app):
    """Test run-task route with non-existent module"""
    client, jwt_token = flask_app
    mock_import_module.side_effect = ImportError("Module not found")

    response = client.post(
        "/admin/run-task",
        data=json.dumps({"token": jwt_token, "task": "nonexistent.task"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


@patch("ibutsu_server.import_module")
def test_run_task_route_task_not_found(mock_import_module, flask_app):
    """Test run-task route with non-existent task in module"""
    client, jwt_token = flask_app

    mock_module = MagicMock(spec=[])  # Empty spec means no attributes
    mock_import_module.return_value = mock_module

    response = client.post(
        "/admin/run-task",
        data=json.dumps({"token": jwt_token, "task": "test.nonexistent_task"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


@patch("ibutsu_server.import_module")
def test_run_task_route_success(mock_import_module, flask_app):
    """Test successful task execution"""
    client, jwt_token = flask_app

    mock_task = MagicMock()
    mock_module = MagicMock()
    mock_module.test_task = mock_task
    mock_import_module.return_value = mock_module

    response = client.post(
        "/admin/run-task",
        data=json.dumps(
            {"token": jwt_token, "task": "test.test_task", "params": {"param1": "value1"}}
        ),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == HTTPStatus.ACCEPTED
    mock_task.delay.assert_called_once_with(param1="value1")


@patch("ibutsu_server.import_module")
def test_run_task_route_success_no_params(mock_import_module, flask_app):
    """Test successful task execution without parameters"""
    client, jwt_token = flask_app

    mock_task = MagicMock()
    mock_module = MagicMock()
    mock_module.test_task = mock_task
    mock_import_module.return_value = mock_module

    response = client.post(
        "/admin/run-task",
        data=json.dumps({"token": jwt_token, "task": "test.test_task"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == HTTPStatus.ACCEPTED
    mock_task.delay.assert_called_once_with()


def test_run_task_route_invalid_json(flask_app):
    """Test run-task route with invalid JSON"""
    client, _ = flask_app
    response = client.post(
        "/admin/run-task", data="invalid json", headers={"Content-Type": "application/json"}
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


@patch("ibutsu_server.decode_token")
def test_run_task_route_user_not_found(mock_decode_token, flask_app):
    """Test run-task route when user is not found"""
    client, _ = flask_app
    # Return a user_id that doesn't exist in the database
    mock_decode_token.return_value = {"sub": "00000000-0000-0000-0000-000000000000"}

    response = client.post(
        "/admin/run-task",
        data=json.dumps({"token": "valid_token", "task": "test.task"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == HTTPStatus.FORBIDDEN


@patch("ibutsu_server.decode_token")
def test_run_task_route_token_decode_no_sub(mock_decode_token, flask_app):
    """Test run-task route when token has no sub field"""
    client, _ = flask_app
    mock_decode_token.return_value = {}

    response = client.post(
        "/admin/run-task",
        data=json.dumps({"token": "valid_token", "task": "test.task"}),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_app_registry_initialize_apps():
    """Test _AppRegistry.initialize_apps creates app instances"""
    from ibutsu_server import _AppRegistry

    # Reset registry first
    _AppRegistry.reset()

    # Initialize apps
    app = _AppRegistry.initialize_apps(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")

    assert app is not None
    assert _AppRegistry.connexion_app is not None
    assert _AppRegistry.flask_app is not None
    assert _AppRegistry.celery_app is not None


def test_app_registry_get_connexion_app():
    """Test _AppRegistry.get_connexion_app"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    app = _AppRegistry.get_connexion_app(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")

    assert app is not None
    assert _AppRegistry.connexion_app is not None


def test_app_registry_get_flask_app():
    """Test _AppRegistry.get_flask_app"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    app = _AppRegistry.get_flask_app(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")

    assert app is not None
    assert _AppRegistry.flask_app is not None


def test_app_registry_get_celery_app():
    """Test _AppRegistry.get_celery_app"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    app = _AppRegistry.get_celery_app(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")

    assert app is not None
    assert _AppRegistry.celery_app is not None


def test_app_registry_reset():
    """Test _AppRegistry.reset clears all app instances"""
    from ibutsu_server import _AppRegistry

    # Initialize apps
    _AppRegistry.initialize_apps(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")

    # Verify they exist
    assert _AppRegistry.connexion_app is not None

    # Reset
    _AppRegistry.reset()

    # Verify they're cleared
    assert _AppRegistry.connexion_app is None
    assert _AppRegistry.flask_app is None
    assert _AppRegistry.celery_app is None
    assert _AppRegistry.flower_app is None
    assert _AppRegistry.worker_app is None
    assert _AppRegistry.scheduler_app is None


@patch.dict("os.environ", {"CELERY_BROKER_URL": "redis://localhost:6379/0"})
def test_app_registry_get_flower_app():
    """Test _AppRegistry.get_flower_app"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    app = _AppRegistry.get_flower_app()

    assert app is not None
    assert _AppRegistry.flower_app is not None
    assert app.main == "ibutsu_server_flower"


def test_app_registry_get_flower_app_missing_broker_url():
    """Test _AppRegistry.get_flower_app raises error when CELERY_BROKER_URL not set"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    with (
        patch.dict("os.environ", {}, clear=True),
        pytest.raises(ValueError, match="CELERY_BROKER_URL environment variable must be set"),
    ):
        _AppRegistry.get_flower_app()


def test_app_registry_get_flower_app_with_result_backend():
    """Test _AppRegistry.get_flower_app properly reads CELERY_RESULT_BACKEND"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    broker = "redis://localhost:6379/0"
    result_backend = "redis://localhost:6379/1"

    with patch.dict(
        "os.environ", {"CELERY_BROKER_URL": broker, "CELERY_RESULT_BACKEND": result_backend}
    ):
        app = _AppRegistry.get_flower_app()

        assert app.conf.broker_url == broker
        assert app.conf.result_backend == result_backend
        assert app.conf.redis_socket_timeout is not None
        assert app.conf.broker_transport_options is not None


def test_app_registry_get_flower_app_with_result_backend_url():
    """Test _AppRegistry.get_flower_app properly reads CELERY_RESULT_BACKEND_URL as fallback"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    broker = "redis://localhost:6379/0"
    result_backend = "redis://localhost:6379/2"

    with patch.dict(
        "os.environ", {"CELERY_BROKER_URL": broker, "CELERY_RESULT_BACKEND_URL": result_backend}
    ):
        app = _AppRegistry.get_flower_app()

        assert app.conf.broker_url == broker
        assert app.conf.result_backend == result_backend


def test_app_registry_get_flower_app_defaults_result_backend():
    """Test _AppRegistry.get_flower_app uses broker as result_backend when not specified"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    broker = "redis://localhost:6379/0"

    with patch.dict("os.environ", {"CELERY_BROKER_URL": broker}, clear=True):
        app = _AppRegistry.get_flower_app()

        assert app.conf.broker_url == broker
        assert app.conf.result_backend == broker  # Should default to broker


def test_app_registry_get_worker_app():
    """Test _AppRegistry.get_worker_app"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    # Initialize apps first with config, then get worker app
    _AppRegistry.initialize_apps(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")
    app = _AppRegistry.get_worker_app()

    assert app is not None
    assert _AppRegistry.worker_app is not None
    assert app.main == "ibutsu_server_worker"


def test_app_registry_get_scheduler_app():
    """Test _AppRegistry.get_scheduler_app"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    # Initialize apps first with config, then get scheduler app
    _AppRegistry.initialize_apps(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")
    app = _AppRegistry.get_scheduler_app()

    assert app is not None
    assert _AppRegistry.scheduler_app is not None
    assert app.main == "ibutsu_server_scheduler"


def test_module_getattr_connexion_app():
    """Test __getattr__ for connexion_app"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    # Import should trigger lazy initialization
    from ibutsu_server import connexion_app

    assert connexion_app is not None


def test_module_getattr_flask_app():
    """Test __getattr__ for flask_app"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    from ibutsu_server import flask_app

    assert flask_app is not None


def test_module_getattr_celery_app():
    """Test __getattr__ for celery_app"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    from ibutsu_server import celery_app

    assert celery_app is not None


@patch.dict("os.environ", {"CELERY_BROKER_URL": "redis://localhost:6379/0"})
def test_module_getattr_flower_app():
    """Test __getattr__ for flower_app"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    from ibutsu_server import flower_app

    assert flower_app is not None


def test_module_getattr_worker_app():
    """Test __getattr__ for worker_app"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    from ibutsu_server import worker_app

    assert worker_app is not None


def test_module_getattr_scheduler_app():
    """Test __getattr__ for scheduler_app"""
    from ibutsu_server import _AppRegistry

    _AppRegistry.reset()

    from ibutsu_server import scheduler_app

    assert scheduler_app is not None


def test_module_getattr_invalid_attribute():
    """Test __getattr__ raises AttributeError for invalid attribute"""
    with pytest.raises(
        AttributeError, match="module 'ibutsu_server' has no attribute 'invalid_attr'"
    ):
        from ibutsu_server import invalid_attr  # noqa: F401


def test_get_app_with_postgresql_config():
    """Test get_app with PostgreSQL configuration"""
    extra_config = {
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "POSTGRESQL_HOST": "localhost",
        "POSTGRESQL_DATABASE": "testdb",
        "POSTGRESQL_USER": "testuser",
        "POSTGRESQL_PASSWORD": "testpass",
    }

    # This should not fail even with PostgreSQL config present
    app = get_app(**extra_config)
    assert app is not None


def test_get_app_with_postgres_config():
    """Test get_app with POSTGRES_ prefix configuration"""
    extra_config = {
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "POSTGRES_HOST": "localhost",
        "POSTGRES_DATABASE": "testdb",
    }

    app = get_app(**extra_config)
    assert app is not None


def test_get_app_sqlite_engine_options():
    """Test get_app sets correct engine options for SQLite"""
    app = get_app(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")

    # SQLite should not have statement_timeout
    assert (
        "SQLALCHEMY_ENGINE_OPTIONS" not in app.app.config
        or app.app.config.get("SQLALCHEMY_ENGINE_OPTIONS") == {}
    )


def test_get_app_postgresql_engine_options():
    """Test get_app sets statement_timeout for PostgreSQL"""
    from sqlalchemy.engine.url import URL as SQLA_URL

    db_url = SQLA_URL.create(
        drivername="postgresql",
        host="localhost",
        database="testdb",
        username="testuser",
        password="testpass",
    )

    app = get_app(TESTING=True, SQLALCHEMY_DATABASE_URI=db_url)

    # PostgreSQL should have statement_timeout
    assert "SQLALCHEMY_ENGINE_OPTIONS" in app.app.config
    assert "connect_args" in app.app.config["SQLALCHEMY_ENGINE_OPTIONS"]


def test_get_app_celery_config():
    """Test get_app configures Celery properly"""
    app = get_app(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
        CELERY_BROKER_URL="redis://localhost:6379/0",
        CELERY_RESULT_BACKEND="redis://localhost:6379/0",
    )

    assert "CELERY" in app.app.config
    assert app.app.config["CELERY"]["broker_url"] == "redis://localhost:6379/0"
    assert app.app.config["CELERY"]["result_backend"] == "redis://localhost:6379/0"
    assert app.app.config["CELERY"]["broker_connection_retry"] is True


def test_get_app_default_db_uri():
    """Test get_app uses default database URI when none provided"""
    with patch("builtins.print") as mock_print:
        get_app(TESTING=True)

        # Should print warning about default database
        mock_print.assert_called()
        assert "No database configuration found" in str(mock_print.call_args)


@patch("ibutsu_server.create_engine")
def test_get_app_with_postgresql_connection_retry(mock_create_engine):
    """Test get_app retries PostgreSQL connection"""
    extra_config = {
        "TESTING": True,
        "POSTGRESQL_HOST": "localhost",
        "POSTGRESQL_DATABASE": "testdb",
    }

    # Mock the engine and connection
    mock_engine = MagicMock()
    mock_connection = MagicMock()
    mock_engine.connect.return_value = mock_connection
    mock_create_engine.return_value = mock_engine

    app = get_app(**extra_config)

    assert app is not None
    # Verify engine was created and connection was attempted
    mock_create_engine.assert_called()
    mock_engine.connect.assert_called()
    mock_connection.close.assert_called()
    mock_engine.dispose.assert_called()


def test_get_app_with_sslmode():
    """Test get_app handles PostgreSQL sslmode parameter"""
    extra_config = {
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "POSTGRESQL_HOST": "localhost",
        "POSTGRESQL_DATABASE": "testdb",
        "POSTGRESQL_SSLMODE": "require",
    }

    app = get_app(**extra_config)
    assert app is not None
