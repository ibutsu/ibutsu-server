from unittest.mock import patch

from flask import json


@patch("ibutsu_server.controllers.login_controller.generate_token")
def test_login(mocked_generate_token, flask_app, make_user):
    """Test case for login"""
    client, _jwt_token = flask_app

    # Create user with a password
    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import User

        # Create user directly to set password
        user = User(name="Test User", email="testlogin@example.com", is_active=True)
        user.password = "my super secret password"  # Use property setter
        session.add(user)
        session.commit()

    login_details = {"email": "testlogin@example.com", "password": "my super secret password"}
    expected_token = "mocked-jwt-token"
    mocked_generate_token.return_value = expected_token

    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login",
        headers=headers,
        data=json.dumps(login_details),
        content_type="application/json",
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["email"] == "testlogin@example.com"
    assert "token" in response_data


def test_login_empty_request(flask_app):
    """Test case for login with empty request"""
    client, _jwt_token = flask_app

    login_details = {"email": "", "password": ""}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login",
        headers=headers,
        data=json.dumps(login_details),
        content_type="application/json",
    )
    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"


def test_login_no_user(flask_app):
    """Test case for login with a user that doesn't exist"""
    client, _jwt_token = flask_app

    login_details = {"email": "bad@email.com", "password": "password"}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login",
        headers=headers,
        data=json.dumps(login_details),
        content_type="application/json",
    )
    assert response.status_code == 401, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["code"] == "INVALID"


def test_login_bad_password(flask_app):
    """Test case for login with a bad password"""
    client, _jwt_token = flask_app

    # Create user with password
    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import User

        user = User(name="Test User", email="badpass@example.com", is_active=True)
        user.password = "correct password"  # Use property setter
        session.add(user)
        session.commit()

    login_details = {"email": "badpass@example.com", "password": "wrong password"}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login",
        headers=headers,
        data=json.dumps(login_details),
        content_type="application/json",
    )
    assert response.status_code == 401, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["code"] == "INVALID"


def test_login_inactive_user(flask_app):
    """Test case for login with an inactive user"""
    client, _jwt_token = flask_app

    # Create inactive user
    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import User

        user = User(name="Inactive User", email="inactive@example.com", is_active=False)
        user.password = "password"  # Use property setter
        session.add(user)
        session.commit()

    login_details = {"email": "inactive@example.com", "password": "password"}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login",
        headers=headers,
        data=json.dumps(login_details),
        content_type="application/json",
    )
    assert response.status_code == 401, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["code"] == "INACTIVE"
