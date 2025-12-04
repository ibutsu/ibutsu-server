"""Tests for ibutsu_server.util.keycloak module."""

from unittest.mock import MagicMock, patch

import pytest

from ibutsu_server.util.keycloak import get_keycloak_config, get_user_from_keycloak


@pytest.fixture
def keycloak_config(flask_app):
    """Configure Keycloak settings for testing."""
    client, _ = flask_app
    client.application.config["KEYCLOAK_CLIENT_ID"] = "test-client"
    client.application.config["KEYCLOAK_BASE_URL"] = "https://keycloak.example.com"
    client.application.config["KEYCLOAK_REALM"] = "test-realm"
    return client


class TestGetKeycloakConfig:
    """Tests for get_keycloak_config function."""

    def test_get_keycloak_config_not_configured(self, flask_app):
        """Test get_keycloak_config when Keycloak is not configured."""
        client, _ = flask_app
        with client.application.app_context():
            # Default flask_app has KEYCLOAK_CLIENT_ID=None
            config = get_keycloak_config()
            assert config == {}

    def test_get_keycloak_config_basic(self, keycloak_config):
        """Test get_keycloak_config with basic configuration."""
        client = keycloak_config
        with client.application.app_context():
            config = get_keycloak_config()

            assert config["client_id"] == "test-client"
            assert config["realm"] == "test-realm"
            assert "server_url" in config
            assert "authorization_url" in config
            assert "redirect_uri" in config
            assert "keycloak" in config["redirect_uri"]

    def test_get_keycloak_config_with_auth_path(self, keycloak_config):
        """Test get_keycloak_config with custom auth path."""
        client = keycloak_config
        with client.application.app_context():
            client.application.config["KEYCLOAK_AUTH_PATH"] = "custom-auth"

            config = get_keycloak_config()

            assert "custom-auth" in config["server_url"]

    def test_get_keycloak_config_with_custom_backend_url(self, keycloak_config):
        """Test get_keycloak_config with custom backend URL."""
        client = keycloak_config
        with client.application.app_context():
            client.application.config["BACKEND_URL"] = "https://api.example.com/api"

            config = get_keycloak_config()

            assert config["redirect_uri"] == "https://api.example.com/api/login/auth/keycloak"

    def test_get_keycloak_config_backend_url_without_api(self, keycloak_config):
        """Test get_keycloak_config with backend URL missing /api suffix."""
        client = keycloak_config
        with client.application.app_context():
            client.application.config["BACKEND_URL"] = "https://api.example.com"

            config = get_keycloak_config()

            # Should append /api if not present
            assert config["redirect_uri"].endswith("/api/login/auth/keycloak")

    def test_get_keycloak_config_with_icon(self, keycloak_config):
        """Test get_keycloak_config with custom icon."""
        client = keycloak_config
        with client.application.app_context():
            client.application.config["KEYCLOAK_ICON"] = "custom-icon.png"

            config = get_keycloak_config()

            assert config["icon"] == "custom-icon.png"

    def test_get_keycloak_config_with_display_name(self, keycloak_config):
        """Test get_keycloak_config with custom display name."""
        client = keycloak_config
        with client.application.app_context():
            client.application.config["KEYCLOAK_NAME"] = "My Keycloak"

            config = get_keycloak_config()

            assert config["display_name"] == "My Keycloak"

    @pytest.mark.parametrize(
        ("verify_ssl_value", "expected_result"),
        [
            ("yes", True),
            ("YES", True),
            ("Yes", True),
            ("true", True),
            ("True", True),
            ("TRUE", True),
            ("1", True),
            ("no", False),
            ("false", False),
            ("0", False),
            ("anything_else", False),
        ],
    )
    def test_get_keycloak_config_with_verify_ssl(
        self, keycloak_config, verify_ssl_value, expected_result
    ):
        """Test get_keycloak_config with various verify_ssl values."""
        client = keycloak_config
        with client.application.app_context():
            client.application.config["KEYCLOAK_VERIFY_SSL"] = verify_ssl_value

            config = get_keycloak_config()

            assert config["verify_ssl"] == expected_result

    def test_get_keycloak_config_private(self, keycloak_config):
        """Test get_keycloak_config with is_private=True."""
        client = keycloak_config
        with client.application.app_context():
            config = get_keycloak_config(is_private=True)

            assert "user_url" in config
            assert "token_url" in config
            assert "userinfo" in config["user_url"]
            assert "token" in config["token_url"]

    def test_get_keycloak_config_not_private(self, keycloak_config):
        """Test get_keycloak_config with is_private=False (default)."""
        client = keycloak_config
        with client.application.app_context():
            config = get_keycloak_config(is_private=False)

            assert "user_url" not in config
            assert "token_url" not in config


class TestGetUserFromKeycloak:
    """Tests for get_user_from_keycloak function."""

    @patch("ibutsu_server.util.keycloak.requests.get")
    def test_get_user_from_keycloak_new_user(self, mock_get, keycloak_config):
        """Test get_user_from_keycloak creating a new user."""
        client = keycloak_config
        with client.application.app_context():
            # Mock the HTTP response
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "email": "newuser@example.com",
                "name": "New User",
                "sub": "keycloak-user-id-123",
            }
            mock_get.return_value = mock_response

            auth_data = {"access_token": "test-token"}
            user = get_user_from_keycloak(auth_data)

            # Verify user was created
            assert user is not None
            assert user.email == "newuser@example.com"
            assert user.name == "New User"
            assert user.is_active is True
            assert user.is_superadmin is False

    @patch("ibutsu_server.util.keycloak.requests.get")
    def test_get_user_from_keycloak_existing_user(self, mock_get, keycloak_config, make_user):
        """Test get_user_from_keycloak with an existing user."""
        client = keycloak_config
        with client.application.app_context():
            # Create existing user
            existing_user = make_user(email="existing@example.com", name="Existing User")

            # Mock the HTTP response
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "email": "existing@example.com",
                "name": "Existing User",
                "sub": "keycloak-user-id-456",
            }
            mock_get.return_value = mock_response

            auth_data = {"access_token": "test-token"}
            user = get_user_from_keycloak(auth_data)

            # Should return existing user
            assert user is not None
            assert user.id == existing_user.id
            assert user.email == "existing@example.com"

    @patch("ibutsu_server.util.keycloak.requests.get")
    def test_get_user_from_keycloak_api_error(self, mock_get, keycloak_config):
        """Test get_user_from_keycloak when API returns an error."""
        client = keycloak_config
        with client.application.app_context():
            # Mock failed HTTP response
            mock_response = MagicMock()
            mock_response.status_code = 401
            mock_response.text = "Unauthorized"
            mock_get.return_value = mock_response

            auth_data = {"access_token": "invalid-token"}
            user = get_user_from_keycloak(auth_data)

            # Should return None
            assert user is None

    @patch("ibutsu_server.util.keycloak.requests.get")
    def test_get_user_from_keycloak_with_custom_verify_ssl(self, mock_get, keycloak_config):
        """Test get_user_from_keycloak respects verify_ssl config."""
        client = keycloak_config
        with client.application.app_context():
            # Configure Keycloak with SSL verification disabled
            client.application.config["KEYCLOAK_VERIFY_SSL"] = "no"

            # Mock the HTTP response
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "email": "testuser@example.com",
                "name": "Test User",
                "sub": "keycloak-user-id-789",
            }
            mock_get.return_value = mock_response

            auth_data = {"access_token": "test-token"}
            user = get_user_from_keycloak(auth_data)

            # Verify request was made with verify=False
            mock_get.assert_called_once()
            call_kwargs = mock_get.call_args[1]
            assert call_kwargs["verify"] is False
            assert user is not None

    @patch("ibutsu_server.util.keycloak.requests.get")
    def test_get_user_from_keycloak_default_verify_ssl(self, mock_get, keycloak_config):
        """Test get_user_from_keycloak uses verify=True by default."""
        client = keycloak_config
        with client.application.app_context():
            # Mock the HTTP response
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "email": "testuser@example.com",
                "name": "Test User",
                "sub": "keycloak-user-id-000",
            }
            mock_get.return_value = mock_response

            auth_data = {"access_token": "test-token"}
            user = get_user_from_keycloak(auth_data)

            # Verify request was made with verify=True (default)
            mock_get.assert_called_once()
            call_kwargs = mock_get.call_args[1]
            assert call_kwargs["verify"] is True
            assert user is not None
