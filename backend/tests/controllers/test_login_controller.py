from base64 import urlsafe_b64encode
from unittest.mock import patch

import pytest

from ibutsu_server.controllers.login_controller import (
    _find_or_create_token,
    _get_provider_config,
    _get_user_from_provider,
    activate,
)
from ibutsu_server.db import db
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Token, User


@patch("ibutsu_server.controllers.login_controller.generate_token")
def test_login(mocked_generate_token, flask_app, make_user):
    """Test case for login"""
    client, _jwt_token = flask_app

    # Create user with a password
    with client.application.app_context():
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


# Note: test_login_empty_request and test_login_no_user are now covered by
# test_login_validation_parametrized below


def test_login_bad_password(flask_app):
    """Test case for login with a bad password"""
    client, _jwt_token = flask_app

    # Create user with password
    with client.application.app_context():
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


def test_register_success(flask_app):
    """Test successful user registration"""
    client, _jwt_token = flask_app

    registration_data = {"email": "newuser@example.com", "password": "securepassword123"}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login/register",
        headers=headers,
        json=registration_data,
    )
    assert response.status_code == 201, f"Response body is : {response.text}"

    # Verify user was created in database
    with client.application.app_context():
        user = db.session.execute(
            db.select(User).filter_by(email="newuser@example.com")
        ).scalar_one_or_none()
        assert user is not None
        assert user.is_active is False  # Should be inactive until activated
        assert user.activation_code is not None


def test_register_empty_fields(flask_app):
    """Test registration with empty email/password"""
    client, _jwt_token = flask_app

    registration_data = {"email": "", "password": ""}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login/register",
        headers=headers,
        json=registration_data,
    )
    # Connexion validates email format before controller, returns 400 for invalid format
    assert response.status_code == 400, f"Response body is : {response.text}"


def test_register_duplicate_email(flask_app):
    """Test registration with already existing email"""
    client, _jwt_token = flask_app

    # Create existing user
    with client.application.app_context():
        user = User(name="Existing User", email="existing@example.com", is_active=True)
        user.password = "password"
        session.add(user)
        session.commit()

    registration_data = {"email": "existing@example.com", "password": "newpassword"}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login/register",
        headers=headers,
        json=registration_data,
    )
    assert response.status_code == 400, f"Response body is : {response.text}"
    assert "already exists" in response.text


def test_activate_success(flask_app):
    """Test successful account activation"""
    client, _jwt_token = flask_app

    # Create inactive user with activation code (base64-encoded)

    with client.application.app_context():
        # Create a valid base64-encoded activation code (keep padding)
        activation_code = urlsafe_b64encode(b"test_activation_code_123").decode()
        user = User(
            name="Inactive User",
            email="inactive@example.com",
            is_active=False,
            activation_code=activation_code,
        )
        user.password = "password"
        session.add(user)
        session.commit()
        user_id = user.id

    # Activate the user via direct controller call
    with client.application.app_context():
        result = activate(activation_code)
        # Returns a redirect Response object
        assert result.status_code == 302

    # Verify user is now active
    with client.application.app_context():
        user = db.session.get(User, user_id)
        assert user.is_active is True
        assert user.activation_code is None


def test_activate_invalid_code(flask_app):
    """Test activation with invalid activation code"""
    client, _jwt_token = flask_app

    with client.application.app_context():
        result = activate("invalid_code_xyz")
        # Returns a redirect Response object with error
        assert result.status_code == 302


def test_recover_success(flask_app):
    """Test successful account recovery"""
    client, _jwt_token = flask_app

    # Create user
    with client.application.app_context():
        user = User(name="Test User", email="recover@example.com", is_active=True)
        user.password = "password"
        session.add(user)
        session.commit()
        user_id = user.id

    recovery_data = {"email": "recover@example.com"}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login/recover",
        headers=headers,
        json=recovery_data,
    )
    assert response.status_code == 201, f"Response body is : {response.text}"

    # Verify activation code was set
    with client.application.app_context():
        user = db.session.get(User, user_id)
        assert user.activation_code is not None


def test_recover_nonexistent_user(flask_app):
    """Test recovery for non-existent user"""
    client, _jwt_token = flask_app

    recovery_data = {"email": "nonexistent@example.com"}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login/recover",
        headers=headers,
        json=recovery_data,
    )
    assert response.status_code == 400


def test_recover_missing_email(flask_app):
    """Test recovery without email"""
    client, _jwt_token = flask_app

    recovery_data = {}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login/recover",
        headers=headers,
        json=recovery_data,
    )
    assert response.status_code == 400


def test_reset_password_success(flask_app):
    """Test successful password reset"""
    client, _jwt_token = flask_app

    # Create user with base64-encoded activation code (like the register function creates)

    with client.application.app_context():
        # Keep padding for valid base64
        activation_code = urlsafe_b64encode(b"reset_code_123").decode()
        user = User(
            name="Test User",
            email="reset@example.com",
            is_active=True,
            activation_code=activation_code,
        )
        user.password = "oldpassword"
        session.add(user)
        session.commit()
        user_id = user.id

    reset_data = {"activation_code": activation_code, "password": "newpassword123"}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login/reset-password",
        headers=headers,
        json=reset_data,
    )
    assert response.status_code == 201, f"Response body is : {response.text}"

    # Verify password was changed and activation code cleared
    with client.application.app_context():
        user = db.session.get(User, user_id)
        assert user.activation_code is None
        # Verify new password works
        assert user.check_password("newpassword123")


def test_reset_password_invalid_code(flask_app):
    """Test password reset with invalid activation code"""
    client, _jwt_token = flask_app

    reset_data = {"activation_code": "invalid_code", "password": "newpassword"}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login/reset-password",
        headers=headers,
        json=reset_data,
    )
    assert response.status_code == 400


def test_reset_password_missing_fields(flask_app):
    """Test password reset with missing fields"""
    client, _jwt_token = flask_app

    reset_data = {"activation_code": "code123"}  # Missing password
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login/reset-password",
        headers=headers,
        json=reset_data,
    )
    assert response.status_code == 400


def test_config_google(flask_app):
    """Test getting login config for Google provider"""
    client, _jwt_token = flask_app

    headers = {"Accept": "application/json"}
    response = client.get("/api/login/config/google", headers=headers)
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    # Should return configuration object (may be empty if not configured)
    assert isinstance(response_data, dict)


def test_config_gitlab(flask_app):
    """Test getting login config for GitLab provider"""
    client, _jwt_token = flask_app

    headers = {"Accept": "application/json"}
    response = client.get("/api/login/config/gitlab", headers=headers)
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    # Should return configuration object
    assert isinstance(response_data, dict)


def test_login_disabled_for_non_superadmin(flask_app, temp_config):
    """Test that non-superadmin users can't login when USER_LOGIN_ENABLED is False"""
    client, _jwt_token = flask_app

    # Create non-superadmin user
    with client.application.app_context():
        user = User(
            name="Regular User", email="regular@example.com", is_active=True, is_superadmin=False
        )
        user.password = "password"
        session.add(user)
        session.commit()

    # Temporarily disable user login using temp_config fixture
    temp_config("USER_LOGIN_ENABLED", False)

    login_details = {"email": "regular@example.com", "password": "password"}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login",
        headers=headers,
        json=login_details,
    )
    assert response.status_code == 401
    response_data = response.json()
    assert "disabled" in response_data["message"].lower()


@pytest.mark.parametrize(
    ("email", "password", "expected_status", "description"),
    [
        ("valid@test.com", "", 401, "Empty password returns 401"),
        ("", "password", 400, "Empty email fails Connexion validation"),
        ("notanemail", "password", 400, "Invalid email format"),
        ("bad@email.com", "password", 401, "Non-existent user"),
    ],
)
def test_login_validation_parametrized(flask_app, email, password, expected_status, description):
    """Test login validation with various invalid inputs"""
    client, _jwt_token = flask_app

    login_details = {"email": email, "password": password}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login",
        headers=headers,
        json=login_details,
    )
    assert response.status_code == expected_status, description


@patch("ibutsu_server.controllers.login_controller.generate_token")
def test_login_superadmin_when_disabled(mocked_generate_token, flask_app, temp_config):
    """Test that superadmin can still login when USER_LOGIN_ENABLED is False"""
    client, _jwt_token = flask_app

    # Test user in fixture is superadmin
    with client.application.app_context():
        superadmin = User.query.filter_by(email="test@example.com").first()
        superadmin.password = "adminpassword"
        session.commit()

    # Disable user login
    temp_config("USER_LOGIN_ENABLED", False)

    mocked_generate_token.return_value = "superadmin-token"

    login_details = {"email": "test@example.com", "password": "adminpassword"}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login",
        headers=headers,
        json=login_details,
    )
    # Superadmin should still be able to login
    assert response.status_code == 200, f"Response body is : {response.text}"


def test_login_creates_or_updates_token(flask_app):
    """Test that login creates or updates the login-token"""
    client, _jwt_token = flask_app

    # Create user
    with client.application.app_context():
        user = User(name="Token Test User", email="tokentest@example.com", is_active=True)
        user.password = "testpassword"
        session.add(user)
        session.commit()
        user_id = user.id

    with patch("ibutsu_server.controllers.login_controller.generate_token") as mock_gen:
        mock_gen.return_value = "first-token"

        login_details = {"email": "tokentest@example.com", "password": "testpassword"}
        headers = {"Accept": "application/json", "Content-Type": "application/json"}

        # First login
        response = client.post("/api/login", headers=headers, json=login_details)
        assert response.status_code == 200
        response_data = response.json()
        assert response_data["token"] == "first-token"

        # Login again with different token
        mock_gen.return_value = "second-token"
        response = client.post("/api/login", headers=headers, json=login_details)
        assert response.status_code == 200
        response_data = response.json()
        assert response_data["token"] == "second-token"

    # Verify only one login-token exists
    with client.application.app_context():
        tokens = (
            db.session.execute(
                db.select(Token).where(Token.user_id == user_id, Token.name == "login-token")
            )
            .scalars()
            .all()
        )
        assert len(tokens) == 1
        assert tokens[0].token == "second-token"


@pytest.mark.parametrize(
    "provider",
    [
        "google",
        "github",
        "facebook",
        "gitlab",
        "keycloak",
    ],
)
def test_config_all_providers(flask_app, provider):
    """Test getting login config for all supported providers"""
    client, _jwt_token = flask_app

    headers = {"Accept": "application/json"}
    response = client.get(f"/api/login/config/{provider}", headers=headers)
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert isinstance(response_data, dict)


def test_auth_missing_code(flask_app):
    """Test auth endpoint without code parameter"""
    client, _jwt_token = flask_app

    # Try to call auth without code
    response = client.get("/api/login/auth/google")
    assert response.status_code == 400


def test_register_non_json(flask_app, http_headers):
    """Test registration with non-JSON content type"""
    client, _jwt_token = flask_app

    # Remove Content-Type to test non-JSON handling
    headers = {k: v for k, v in http_headers.items() if k != "Content-Type"}
    response = client.post(
        "/api/login/register",
        headers=headers,
        data="not json",
    )
    assert response.status_code in [400, 415]


def test_recover_non_json(flask_app, http_headers):
    """Test recover with non-JSON content type"""
    client, _jwt_token = flask_app

    # Remove Content-Type to test non-JSON handling
    headers = {k: v for k, v in http_headers.items() if k != "Content-Type"}
    response = client.post(
        "/api/login/recover",
        headers=headers,
        data="not json",
    )
    assert response.status_code in [400, 415]


def test_reset_password_non_json(flask_app, http_headers):
    """Test reset password with non-JSON content type"""
    client, _jwt_token = flask_app

    # Remove Content-Type to test non-JSON handling
    headers = {k: v for k, v in http_headers.items() if k != "Content-Type"}
    response = client.post(
        "/api/login/reset-password",
        headers=headers,
        data="not json",
    )
    assert response.status_code in [400, 415]


def test_login_support_with_exception(flask_app):
    """Test login support endpoint handles exceptions gracefully"""
    client, _jwt_token = flask_app

    # Mock to raise exception in support()
    with patch("ibutsu_server.controllers.login_controller.get_keycloak_config") as mock_kc:
        mock_kc.side_effect = Exception("Configuration error")

        headers = {"Accept": "application/json"}
        response = client.get("/api/login/support", headers=headers)
        # Should still return 200 with default config
        assert response.status_code == 200
        response_data = response.json()
        assert "user" in response_data
        assert isinstance(response_data["user"], bool)


def test_login_non_json(flask_app):
    """Test login with non-JSON content type returns error"""
    client, _jwt_token = flask_app

    # Set content-type to form data, not JSON
    headers = {"Accept": "application/json", "Content-Type": "text/plain"}
    response = client.post(
        "/api/login",
        headers=headers,
        data="not json",
    )
    # Should return 400 or 415 due to non-JSON content
    assert response.status_code in [400, 415]


def test_login_disabled_bad_password(flask_app, temp_config):
    """Test login with bad password when login disabled shows disabled message"""
    client, _jwt_token = flask_app

    # Disable user login
    temp_config("USER_LOGIN_ENABLED", False)

    # Try to login with wrong credentials - should show disabled message
    login_details = {"email": "nonexistent@example.com", "password": "badpassword"}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login",
        headers=headers,
        json=login_details,
    )
    assert response.status_code == 401
    response_data = response.json()
    assert "disabled" in response_data["message"].lower()


def test_get_provider_config_keycloak(flask_app):
    """Test _get_provider_config returns keycloak config"""
    client, _jwt_token = flask_app

    with (
        client.application.app_context(),
        patch("ibutsu_server.controllers.login_controller.get_keycloak_config") as mock_kc_config,
    ):
        mock_kc_config.return_value = {"client_id": "test-keycloak-client"}
        config = _get_provider_config("keycloak")
        mock_kc_config.assert_called_once_with(is_private=True)
        assert config["client_id"] == "test-keycloak-client"


def test_get_provider_config_other_provider(flask_app):
    """Test _get_provider_config returns provider config for non-keycloak"""
    client, _jwt_token = flask_app

    with (
        client.application.app_context(),
        patch(
            "ibutsu_server.controllers.login_controller.get_provider_config"
        ) as mock_provider_config,
    ):
        mock_provider_config.return_value = {"client_id": "test-google-client"}
        config = _get_provider_config("google")
        mock_provider_config.assert_called_once_with("google", is_private=True)
        assert config["client_id"] == "test-google-client"


def test_get_user_from_provider_google_invalid_token(flask_app):
    """Test _get_user_from_provider handles invalid Google token"""
    client, _jwt_token = flask_app

    with (
        client.application.app_context(),
        patch(
            "ibutsu_server.controllers.login_controller.id_token.verify_oauth2_token"
        ) as mock_verify,
    ):
        mock_verify.side_effect = ValueError("Invalid token")
        provider_config = {"client_id": "test-client-id"}

        result = _get_user_from_provider("google", provider_config, "invalid-code")
        assert result == ("Unauthorized", 401)


def test_get_user_from_provider_google_success(flask_app, make_user):
    """Test _get_user_from_provider handles valid Google token"""
    client, _jwt_token = flask_app

    with client.application.app_context():
        # Create a user that would be returned
        user = make_user(email="googleuser@example.com", name="Google User")

        with (
            patch(
                "ibutsu_server.controllers.login_controller.id_token.verify_oauth2_token"
            ) as mock_verify,
            patch(
                "ibutsu_server.controllers.login_controller.get_user_from_provider"
            ) as mock_get_user,
        ):
            mock_verify.return_value = {"sub": "google-123", "email": user.email}
            mock_get_user.return_value = user
            provider_config = {"client_id": "test-client-id"}

            result = _get_user_from_provider("google", provider_config, "valid-code")
            assert result == user


def test_get_user_from_provider_keycloak_success(flask_app, make_user):
    """Test _get_user_from_provider handles Keycloak token exchange"""
    client, _jwt_token = flask_app

    with client.application.app_context():
        user = make_user(email="keycloakuser@example.com", name="Keycloak User")
        provider_config = {
            "client_id": "test-client",
            "client_secret": "secret",
            "redirect_uri": "http://localhost/callback",
            "token_url": "http://keycloak/token",
        }

        with (
            patch("ibutsu_server.controllers.login_controller.requests.post") as mock_post,
            patch(
                "ibutsu_server.controllers.login_controller.get_user_from_keycloak"
            ) as mock_get_user,
        ):
            mock_response = mock_post.return_value
            mock_response.status_code = 200
            mock_response.json.return_value = {"access_token": "token123"}
            mock_get_user.return_value = user

            result = _get_user_from_provider("keycloak", provider_config, "auth-code")
            assert result == user
            mock_get_user.assert_called_once()


def test_get_user_from_provider_github_success(flask_app, make_user):
    """Test _get_user_from_provider handles GitHub token exchange"""
    client, _jwt_token = flask_app

    with client.application.app_context():
        user = make_user(email="githubuser@example.com", name="GitHub User")
        provider_config = {
            "client_id": "test-client",
            "redirect_uri": "http://localhost/callback",
            "token_url": "http://github/token",
        }

        with (
            patch("ibutsu_server.controllers.login_controller.requests.post") as mock_post,
            patch(
                "ibutsu_server.controllers.login_controller.get_user_from_provider"
            ) as mock_get_user,
        ):
            mock_response = mock_post.return_value
            mock_response.status_code = 200
            mock_response.json.return_value = {"access_token": "token123"}
            mock_get_user.return_value = user

            result = _get_user_from_provider("github", provider_config, "auth-code")
            assert result == user


def test_get_user_from_provider_token_error(flask_app):
    """Test _get_user_from_provider handles token exchange failure"""
    client, _jwt_token = flask_app

    with client.application.app_context():
        provider_config = {
            "client_id": "test-client",
            "redirect_uri": "http://localhost/callback",
            "token_url": "http://github/token",
        }

        with patch("ibutsu_server.controllers.login_controller.requests.post") as mock_post:
            mock_response = mock_post.return_value
            mock_response.status_code = 401
            mock_response.text = "Invalid client credentials"

            result = _get_user_from_provider("github", provider_config, "auth-code")
            # Returns None when token exchange fails
            assert result is None


def test_find_or_create_token_existing(flask_app, make_user):
    """Test _find_or_create_token finds existing token"""
    client, _jwt_token = flask_app

    with client.application.app_context():
        user = make_user(email="findtoken@example.com")

        # Create existing token
        existing_token = Token(name="login-token", user_id=user.id, token="old-token")
        session.add(existing_token)
        session.commit()
        token_id = existing_token.id

        # Should find and return existing token
        found_token = _find_or_create_token("login-token", user)
        assert found_token.id == token_id


def test_find_or_create_token_new(flask_app, make_user):
    """Test _find_or_create_token creates new token when not found"""
    client, _jwt_token = flask_app

    with client.application.app_context():
        user = make_user(email="newtoken@example.com")

        # Should create new token
        token = _find_or_create_token("new-token", user)
        assert token.name == "new-token"
        assert token.user_id == user.id


def test_auth_returns_unauthorized_when_no_user(flask_app):
    """Test auth endpoint returns 401 when user lookup fails"""
    client, _jwt_token = flask_app

    with (
        patch("ibutsu_server.controllers.login_controller._get_provider_config") as mock_config,
        patch(
            "ibutsu_server.controllers.login_controller._get_user_from_provider"
        ) as mock_get_user,
    ):
        mock_config.return_value = {"client_id": "test"}
        mock_get_user.return_value = None

        response = client.get("/api/login/auth/google?code=test-auth-code")
        assert response.status_code == 401


def test_reset_password_with_base64_code(flask_app):
    """Test reset_password with properly encoded base64 activation code"""

    client, _jwt_token = flask_app

    # Create user with properly encoded activation code
    with client.application.app_context():
        activation_code = urlsafe_b64encode(b"valid_test_code").decode()
        user = User(
            name="Reset User",
            email="resettest@example.com",
            is_active=True,
            activation_code=activation_code,
        )
        user.password = "oldpassword"
        session.add(user)
        session.commit()

    reset_data = {"activation_code": activation_code, "password": "newpassword123"}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    response = client.post(
        "/api/login/reset-password",
        headers=headers,
        json=reset_data,
    )
    assert response.status_code == 201
