"""Tests for ibutsu_server.__init__ module"""

import os
from http import HTTPStatus
from unittest.mock import MagicMock, patch

import pytest
from flask import json
from sqlalchemy.engine.url import URL as SQLA_URL

from ibutsu_server import get_app, make_celery_redis_url, maybe_sql_url


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


def test_make_celery_redis_url_with_envvar():
    """Test when environment variable is already set"""
    config = MagicMock()
    config.get.return_value = "redis://custom:6379/0"

    result = make_celery_redis_url(config, envvar="CELERY_BROKER_URL")

    assert result == "redis://custom:6379/0"
    config.get.assert_called_once_with("CELERY_BROKER_URL")


def test_make_celery_redis_url_with_password():
    """Test creating Redis URL with password"""
    config = MagicMock()
    config.get.return_value = None
    config.get_namespace.return_value = {
        "hostname": "redis.example.com",
        "port": 6379,
        "password": "secret",
    }

    result = make_celery_redis_url(config, envvar="CELERY_BROKER_URL")

    assert result == "redis://:secret@redis.example.com:6379"


def test_make_celery_redis_url_without_password():
    """Test creating Redis URL without password"""
    config = MagicMock()
    config.get.return_value = None
    config.get_namespace.return_value = {"hostname": "redis.example.com", "port": 6379}

    result = make_celery_redis_url(config, envvar="CELERY_BROKER_URL")

    assert result == "redis://redis.example.com:6379"


def test_make_celery_redis_url_missing_hostname():
    """Test that assertion error is raised when hostname is missing"""
    config = MagicMock()
    config.get.return_value = None
    config.get_namespace.return_value = {"port": 6379}

    with pytest.raises(AssertionError):
        make_celery_redis_url(config, envvar="CELERY_BROKER_URL")


def test_make_celery_redis_url_missing_port():
    """Test that assertion error is raised when port is missing"""
    config = MagicMock()
    config.get.return_value = None
    config.get_namespace.return_value = {"hostname": "redis.example.com"}

    with pytest.raises(AssertionError):
        make_celery_redis_url(config, envvar="CELERY_BROKER_URL")


def test_get_app_basic():
    """Test basic app creation"""
    app = get_app(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")

    assert app is not None
    assert app.config["TESTING"] is True
    assert "BCRYPT_LOG_ROUNDS" in app.config
    assert app.config["BCRYPT_LOG_ROUNDS"] == 12


def test_get_app_with_extra_config():
    """Test app creation with extra configuration"""
    extra_config = {
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "CUSTOM_SETTING": "test_value",
    }
    app = get_app(**extra_config)

    assert app.config["CUSTOM_SETTING"] == "test_value"


@patch.dict(os.environ, {"TEST_ENV_VAR": "env_value"})
def test_get_app_loads_environment_variables():
    """Test that app loads configuration from environment variables"""
    app = get_app(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")

    assert app.config["TEST_ENV_VAR"] == "env_value"


@pytest.mark.parametrize("value", ["yes", "true", "1", "YES", "TRUE"])
def test_get_app_user_login_enabled_string_true(value):
    """Test USER_LOGIN_ENABLED conversion from string to boolean (true values)"""
    with patch.dict(os.environ, {"USER_LOGIN_ENABLED": value}):
        app = get_app(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")
        assert app.config["USER_LOGIN_ENABLED"] is True


@pytest.mark.parametrize("value", ["no", "false", "0", "NO", "FALSE"])
def test_get_app_user_login_enabled_string_false(value):
    """Test USER_LOGIN_ENABLED conversion from string to boolean (false values)"""
    with patch.dict(os.environ, {"USER_LOGIN_ENABLED": value}):
        app = get_app(TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:")
        assert app.config["USER_LOGIN_ENABLED"] is False


def test_get_app_user_login_enabled_boolean():
    """Test USER_LOGIN_ENABLED when already boolean"""
    app = get_app(
        TESTING=True, SQLALCHEMY_DATABASE_URI="sqlite:///:memory:", USER_LOGIN_ENABLED=True
    )
    assert app.config["USER_LOGIN_ENABLED"] is True


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
    """Test that index route redirects to API UI"""
    client, _ = flask_app
    response = client.get("/")

    assert response.status_code == HTTPStatus.FOUND
    assert response.location == "/api/ui/"


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
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_run_task_route_invalid_token(flask_app):
    """Test run-task route with invalid token"""
    client, _ = flask_app
    response = client.post(
        "/admin/run-task",
        data=json.dumps({"token": "invalid_token", "task": "test.task"}),
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_run_task_route_non_superadmin(flask_app):
    """Test run-task route with non-superadmin user"""
    client, _ = flask_app
    # Create a non-superadmin user for this test
    from ibutsu_server.db.base import session
    from ibutsu_server.db.models import Token, User
    from ibutsu_server.util.jwt import generate_token

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
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.FORBIDDEN


@patch("ibutsu_server.User")
@patch("ibutsu_server.decode_token")
def test_run_task_route_no_task(mock_decode_token, mock_user, flask_app):
    """Test run-task route with no task specified"""
    client, _ = flask_app
    mock_decode_token.return_value = {"sub": "user_id"}
    mock_user_instance = MagicMock()
    mock_user_instance.is_superadmin = True
    mock_user.query.get.return_value = mock_user_instance

    response = client.post(
        "/admin/run-task",
        data=json.dumps({"token": "valid_token"}),
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


@patch("ibutsu_server.User")
@patch("ibutsu_server.decode_token")
@patch("ibutsu_server.import_module")
def test_run_task_route_module_not_found(
    mock_import_module, mock_decode_token, mock_user, flask_app
):
    """Test run-task route with non-existent module"""
    client, _ = flask_app
    mock_decode_token.return_value = {"sub": "user_id"}
    mock_user_instance = MagicMock()
    mock_user_instance.is_superadmin = True
    mock_user.query.get.return_value = mock_user_instance
    mock_import_module.side_effect = ImportError("Module not found")

    response = client.post(
        "/admin/run-task",
        data=json.dumps({"token": "valid_token", "task": "nonexistent.task"}),
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


@patch("ibutsu_server.User")
@patch("ibutsu_server.decode_token")
@patch("ibutsu_server.import_module")
def test_run_task_route_task_not_found(mock_import_module, mock_decode_token, mock_user, flask_app):
    """Test run-task route with non-existent task in module"""
    client, _ = flask_app
    mock_decode_token.return_value = {"sub": "user_id"}
    mock_user_instance = MagicMock()
    mock_user_instance.is_superadmin = True
    mock_user.query.get.return_value = mock_user_instance

    mock_module = MagicMock(spec=[])  # Empty spec means no attributes
    mock_import_module.return_value = mock_module

    response = client.post(
        "/admin/run-task",
        data=json.dumps({"token": "valid_token", "task": "test.nonexistent_task"}),
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


@patch("ibutsu_server.User")
@patch("ibutsu_server.decode_token")
@patch("ibutsu_server.import_module")
def test_run_task_route_success(mock_import_module, mock_decode_token, mock_user, flask_app):
    """Test successful task execution"""
    client, _ = flask_app
    mock_decode_token.return_value = {"sub": "user_id"}
    mock_user_instance = MagicMock()
    mock_user_instance.is_superadmin = True
    mock_user.query.get.return_value = mock_user_instance

    mock_task = MagicMock()
    mock_module = MagicMock()
    mock_module.test_task = mock_task
    mock_import_module.return_value = mock_module

    response = client.post(
        "/admin/run-task",
        data=json.dumps(
            {"token": "valid_token", "task": "test.test_task", "params": {"param1": "value1"}}
        ),
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.ACCEPTED
    mock_task.delay.assert_called_once_with(param1="value1")


@patch("ibutsu_server.User")
@patch("ibutsu_server.decode_token")
@patch("ibutsu_server.import_module")
def test_run_task_route_success_no_params(
    mock_import_module, mock_decode_token, mock_user, flask_app
):
    """Test successful task execution without parameters"""
    client, _ = flask_app
    mock_decode_token.return_value = {"sub": "user_id"}
    mock_user_instance = MagicMock()
    mock_user_instance.is_superadmin = True
    mock_user.query.get.return_value = mock_user_instance

    mock_task = MagicMock()
    mock_module = MagicMock()
    mock_module.test_task = mock_task
    mock_import_module.return_value = mock_module

    response = client.post(
        "/admin/run-task",
        data=json.dumps({"token": "valid_token", "task": "test.test_task"}),
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.ACCEPTED
    mock_task.delay.assert_called_once_with()


def test_run_task_route_invalid_json(flask_app):
    """Test run-task route with invalid JSON"""
    client, _ = flask_app
    response = client.post("/admin/run-task", data="invalid json", content_type="application/json")

    assert response.status_code == HTTPStatus.BAD_REQUEST


@patch("ibutsu_server.User")
@patch("ibutsu_server.decode_token")
def test_run_task_route_user_not_found(mock_decode_token, mock_user, flask_app):
    """Test run-task route when user is not found"""
    client, _ = flask_app
    mock_decode_token.return_value = {"sub": "user_id"}
    mock_user.query.get.return_value = None

    response = client.post(
        "/admin/run-task",
        data=json.dumps({"token": "valid_token", "task": "test.task"}),
        content_type="application/json",
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
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED
