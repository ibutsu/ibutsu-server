from http import HTTPStatus
from unittest.mock import patch

import pytest
from flask import json

from ibutsu_server.constants import LOCALHOST
from ibutsu_server.util.jwt import generate_token
from tests.conftest import MOCK_USER_ID
from tests.test_util import MockUser

MOCK_EMAIL = "test@example.com"
MOCK_PASSWORD = "my super secret password"
MOCK_USER = MockUser(
    id=MOCK_USER_ID,
    email=MOCK_EMAIL,
    password=MOCK_PASSWORD,
    name="Test User",
    is_superadmin=False,
)


@pytest.fixture
def login_controller_mocks():
    """Mocks for the login controller tests"""
    with patch("ibutsu_server.controllers.login_controller.User") as mock_user_class:
        mock_user_class.query.filter_by.return_value.first.return_value = MOCK_USER
        yield {"user_class": mock_user_class}


@patch("ibutsu_server.controllers.login_controller.generate_token")
def test_login(mocked_generate_token, flask_app, login_controller_mocks):
    """Test case for login"""
    client, _jwt_token = flask_app
    login_details = {"email": MOCK_EMAIL, "password": MOCK_PASSWORD}
    expected_token = generate_token(MOCK_USER_ID)
    mocked_generate_token.return_value = expected_token
    expected_response = {
        "name": "Test User",
        "email": MOCK_EMAIL,
        "token": expected_token,
    }
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.open(
        "/api/login",
        method="POST",
        headers=headers,
        data=json.dumps(login_details),
        content_type="application/json",
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    assert response.json == expected_response


def test_login_empty_request(flask_app, login_controller_mocks):
    """Test case for login with empty request"""
    client, _jwt_token = flask_app
    login_details = {"email": "", "password": ""}
    expected_response = {
        "detail": "'' is not a 'email' - 'email'",
        "status": HTTPStatus.BAD_REQUEST,
        "title": HTTPStatus.BAD_REQUEST.phrase,
        "type": "about:blank",
    }
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.open(
        "/api/login",
        method="POST",
        headers=headers,
        data=json.dumps(login_details),
        content_type="application/json",
    )
    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"
    assert response.json == expected_response


def test_login_no_user(flask_app, login_controller_mocks):
    """Test case for login with a user that doesn't exist"""
    client, _jwt_token = flask_app
    mocks = login_controller_mocks
    login_details = {"email": "bad@email.com", "password": MOCK_PASSWORD}
    expected_response = {
        "code": "INVALID",
        "message": "Username and/or password are invalid",
    }
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    mocks["user_class"].query.filter_by.return_value.first.return_value = None
    response = client.open(
        "/api/login",
        method="POST",
        headers=headers,
        data=json.dumps(login_details),
        content_type="application/json",
    )
    assert response.status_code == 401, f"Response body is : {response.data.decode('utf-8')}"
    assert response.json == expected_response


def test_login_bad_password(flask_app, login_controller_mocks):
    """Test case for login with a bad password"""
    client, _jwt_token = flask_app
    login_details = {"email": MOCK_EMAIL, "password": "bad password"}
    expected_response = {
        "code": "INVALID",
        "message": "Username and/or password are invalid",
    }
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.open(
        "/api/login",
        method="POST",
        headers=headers,
        data=json.dumps(login_details),
        content_type="application/json",
    )
    assert response.status_code == 401, f"Response body is : {response.data.decode('utf-8')}"
    assert response.json == expected_response


def test_support(flask_app, login_controller_mocks):
    """Test the support method"""
    client, _jwt_token = flask_app
    expected_response = {
        "user": True,
        "keycloak": False,
        "google": True,
        "github": False,
        "facebook": False,
        "gitlab": True,
    }
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.open(
        "/api/login/support",
        method="GET",
        headers=headers,
        content_type="application/json",
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    assert response.json == expected_response


def test_config_gitlab(flask_app, login_controller_mocks):
    """Test getting the "gitlab" provider config"""
    client, _jwt_token = flask_app
    expected_response = {
        "authorization_url": "https://gitlab.com/oauth/authorize",
        "client_id": "thisisafakegitlabclientid",
        "redirect_uri": f"http://{LOCALHOST}:8080/api/login/auth/gitlab",
        "scope": "read_user",
    }
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.open(
        "/api/login/config/gitlab",
        method="GET",
        headers=headers,
        content_type="application/json",
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    assert response.json == expected_response
