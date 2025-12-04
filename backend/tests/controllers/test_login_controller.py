from unittest.mock import patch


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
        json=login_details,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
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
        json=login_details,
    )
    assert response.status_code == 400, f"Response body is : {response.text}"


def test_login_no_user(flask_app):
    """Test case for login with a user that doesn't exist"""
    client, _jwt_token = flask_app

    login_details = {"email": "bad@email.com", "password": "password"}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login",
        headers=headers,
        json=login_details,
    )
    assert response.status_code == 401, f"Response body is : {response.text}"

    response_data = response.json()
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
        json=login_details,
    )
    assert response.status_code == 401, f"Response body is : {response.text}"

    response_data = response.json()
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
        json=login_details,
    )
    assert response.status_code == 401, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["code"] == "INACTIVE"


def test_login_support(flask_app):
    """Test case for getting login support configuration"""
    client, _jwt_token = flask_app

    headers = {"Accept": "application/json"}
    response = client.get("/api/login/support", headers=headers)
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    # Should always return a dict with these keys
    assert "user" in response_data
    assert "keycloak" in response_data
    assert "google" in response_data
    assert "github" in response_data
    assert "facebook" in response_data
    assert "gitlab" in response_data
    # All values should be booleans
    assert isinstance(response_data["user"], bool)
    assert isinstance(response_data["keycloak"], bool)
    assert isinstance(response_data["google"], bool)
    assert isinstance(response_data["github"], bool)
    assert isinstance(response_data["facebook"], bool)
    assert isinstance(response_data["gitlab"], bool)
