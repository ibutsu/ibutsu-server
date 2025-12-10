"""Tests for ibutsu_server.util.oauth module"""

from unittest.mock import MagicMock, patch

import pytest

from ibutsu_server.util.oauth import get_provider_config, get_user_from_provider


def test_get_provider_config_basic(flask_app):
    """Test get_provider_config with basic configuration"""
    client, _ = flask_app

    with (
        client.application.app_context(),
        patch("ibutsu_server.util.oauth.current_app") as mock_app,
    ):
        mock_app.config.get.side_effect = lambda key, default=None: {
            "BACKEND_URL": "http://localhost:8080/api",
            "GITHUB_BASE_URL": "https://github.com",
            "GITHUB_CLIENT_ID": "test-client-id",
        }.get(key, default)

        config = get_provider_config("github", is_private=False)

        assert config["client_id"] == "test-client-id"
        assert config["redirect_uri"] == "http://localhost:8080/api/login/auth/github"
        assert "scope" in config


def test_get_provider_config_facebook(flask_app):
    """Test get_provider_config for Facebook provider"""
    client, _ = flask_app

    with (
        client.application.app_context(),
        patch("ibutsu_server.util.oauth.current_app") as mock_app,
    ):
        mock_app.config.get.side_effect = lambda key, default=None: {
            "BACKEND_URL": "http://localhost:8080/api",
            "FACEBOOK_BASE_URL": "https://facebook.com",
            "FACEBOOK_APP_ID": "test-app-id",
        }.get(key, default)

        config = get_provider_config("facebook", is_private=False)

        assert config["app_id"] == "test-app-id"
        assert "client_id" not in config


def test_get_provider_config_with_custom_auth_url(flask_app):
    """Test get_provider_config with custom authorization URL"""
    client, _ = flask_app

    with (
        client.application.app_context(),
        patch("ibutsu_server.util.oauth.current_app") as mock_app,
    ):
        mock_app.config.get.side_effect = lambda key, default=None: {
            "BACKEND_URL": "http://localhost:8080/api",
            "GITHUB_BASE_URL": "https://github.com",
            "GITHUB_CLIENT_ID": "test-client-id",
            "GITHUB_AUTH_URL": "/custom/auth",
        }.get(key, default)

        config = get_provider_config("github", is_private=False)

        assert config["authorization_url"] == "https://github.com/custom/auth"


def test_get_provider_config_private(flask_app):
    """Test get_provider_config with is_private=True"""
    client, _ = flask_app

    with (
        client.application.app_context(),
        patch("ibutsu_server.util.oauth.current_app") as mock_app,
    ):
        mock_app.config.get.side_effect = lambda key, default=None: {
            "BACKEND_URL": "http://localhost:8080/api",
            "GITHUB_BASE_URL": "https://github.com",
            "GITHUB_CLIENT_ID": "test-client-id",
            "GITHUB_CLIENT_SECRET": "test-secret",
            "GITHUB_TOKEN_URL": "/oauth/token",
        }.get(key, default)

        config = get_provider_config("github", is_private=True)

        assert config["client_secret"] == "test-secret"
        assert config["token_url"] == "https://github.com/oauth/token"
        assert "user_url" in config


def test_get_provider_config_with_custom_token_url(flask_app):
    """Test get_provider_config with custom token URL"""
    client, _ = flask_app

    with (
        client.application.app_context(),
        patch("ibutsu_server.util.oauth.current_app") as mock_app,
    ):
        mock_app.config.get.side_effect = lambda key, default=None: {
            "BACKEND_URL": "http://localhost:8080/api",
            "GITHUB_BASE_URL": "https://github.com",
            "GITHUB_CLIENT_ID": "test-client-id",
            "GITHUB_CLIENT_SECRET": "test-secret",
            "GITHUB_TOKEN_URL": "/custom/token",
        }.get(key, default)

        config = get_provider_config("github", is_private=True)

        assert config["token_url"] == "https://github.com/custom/token"


@pytest.mark.parametrize(
    "provider",
    ["github", "gitlab", "google"],
)
def test_get_provider_config_various_providers(flask_app, provider):
    """Test get_provider_config with various OAuth providers"""
    client, _ = flask_app

    with client.application.app_context():
        provider_upper = provider.upper()
        with patch("ibutsu_server.util.oauth.current_app") as mock_app:
            mock_app.config.get.side_effect = lambda key, default=None: {
                "BACKEND_URL": "http://localhost:8080/api",
                f"{provider_upper}_BASE_URL": f"https://{provider}.com",
                f"{provider_upper}_CLIENT_ID": f"test-{provider}-id",
            }.get(key, default)

            config = get_provider_config(provider, is_private=False)

            assert config["client_id"] == f"test-{provider}-id"
            assert config["redirect_uri"] == f"http://localhost:8080/api/login/auth/{provider}"


def test_get_user_from_provider_google(flask_app, make_user):
    """Test get_user_from_provider for Google OAuth"""
    client, _ = flask_app

    with client.application.app_context():
        auth_data = {
            "iat": "google-user-id",
            "email": "test@example.com",
            "name": "Test User",
        }

        with patch("ibutsu_server.util.oauth.get_provider_config"):
            user = get_user_from_provider("google", auth_data)

            assert user is not None
            assert user.email == "test@example.com"
            assert user.name == "Test User"


def test_get_user_from_provider_github_success(flask_app):
    """Test get_user_from_provider for GitHub OAuth with successful API call"""
    client, _ = flask_app

    with client.application.app_context():
        auth_data = {
            "access_token": "test-access-token",
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "github-user-id",
            "email": "github@example.com",
            "name": "GitHub User",
        }

        with (
            patch("ibutsu_server.util.oauth.get_provider_config") as mock_config,
            patch("ibutsu_server.util.oauth.requests.get", return_value=mock_response),
        ):
            mock_config.return_value = {
                "user_url": "https://api.github.com/user",
            }

            user = get_user_from_provider("github", auth_data)

            assert user is not None
            assert user.email == "github@example.com"
            assert user.name == "GitHub User"


def test_get_user_from_provider_github_failed_api_call(flask_app):
    """Test get_user_from_provider when GitHub API call fails"""
    client, _ = flask_app

    with client.application.app_context():
        auth_data = {
            "access_token": "test-access-token",
        }

        mock_response = MagicMock()
        mock_response.status_code = 401

        with (
            patch("ibutsu_server.util.oauth.get_provider_config") as mock_config,
            patch("ibutsu_server.util.oauth.requests.get", return_value=mock_response),
        ):
            mock_config.return_value = {
                "user_url": "https://api.github.com/user",
            }

            user = get_user_from_provider("github", auth_data)

            assert user is None


def test_get_user_from_provider_with_email_url(flask_app):
    """Test get_user_from_provider when email needs separate API call"""
    client, _ = flask_app

    with client.application.app_context():
        auth_data = {
            "access_token": "test-access-token",
        }

        # First response without email
        mock_user_response = MagicMock()
        mock_user_response.status_code = 200
        mock_user_response.json.return_value = {
            "id": "github-user-id",
            "name": "GitHub User",
            # No email
        }

        # Second response with email
        mock_email_response = MagicMock()
        mock_email_response.status_code = 200
        mock_email_response.json.return_value = [
            {"email": "primary@example.com", "primary": True},
            {"email": "secondary@example.com", "primary": False},
        ]

        with (
            patch("ibutsu_server.util.oauth.get_provider_config") as mock_config,
            patch(
                "ibutsu_server.util.oauth.requests.get",
                side_effect=[mock_user_response, mock_email_response],
            ),
        ):
            mock_config.return_value = {
                "user_url": "https://api.github.com/user",
                "email_url": "https://api.github.com/user/emails",
            }

            user = get_user_from_provider("github", auth_data)

            assert user is not None
            assert user.email == "primary@example.com"
            assert user.name == "GitHub User"


def test_get_user_from_provider_email_url_no_primary(flask_app):
    """Test get_user_from_provider when no primary email is set"""
    client, _ = flask_app

    with client.application.app_context():
        auth_data = {
            "access_token": "test-access-token",
        }

        mock_user_response = MagicMock()
        mock_user_response.status_code = 200
        mock_user_response.json.return_value = {
            "id": "github-user-id",
            "name": "GitHub User",
        }

        mock_email_response = MagicMock()
        mock_email_response.status_code = 200
        mock_email_response.json.return_value = [
            {"email": "first@example.com", "primary": False},
            {"email": "second@example.com", "primary": False},
        ]

        with (
            patch("ibutsu_server.util.oauth.get_provider_config") as mock_config,
            patch(
                "ibutsu_server.util.oauth.requests.get",
                side_effect=[mock_user_response, mock_email_response],
            ),
        ):
            mock_config.return_value = {
                "user_url": "https://api.github.com/user",
                "email_url": "https://api.github.com/user/emails",
            }

            user = get_user_from_provider("github", auth_data)

            assert user is not None
            # Should use first email when no primary
            assert user.email == "first@example.com"


def test_get_user_from_provider_email_url_failed(flask_app):
    """Test get_user_from_provider when email API call fails"""
    client, _ = flask_app

    with client.application.app_context():
        auth_data = {
            "access_token": "test-access-token",
        }

        mock_user_response = MagicMock()
        mock_user_response.status_code = 200
        mock_user_response.json.return_value = {
            "id": "github-user-id",
            "name": "GitHub User",
        }

        mock_email_response = MagicMock()
        mock_email_response.status_code = 401

        with (
            patch("ibutsu_server.util.oauth.get_provider_config") as mock_config,
            patch(
                "ibutsu_server.util.oauth.requests.get",
                side_effect=[mock_user_response, mock_email_response],
            ),
        ):
            mock_config.return_value = {
                "user_url": "https://api.github.com/user",
                "email_url": "https://api.github.com/user/emails",
            }

            user = get_user_from_provider("github", auth_data)

            assert user is None


def test_get_user_from_provider_no_email_url_no_email(flask_app):
    """Test get_user_from_provider when no email is available and no email_url"""
    client, _ = flask_app

    with client.application.app_context():
        auth_data = {
            "access_token": "test-access-token",
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "user-id",
            "name": "Test User",
            # No email
        }

        with (
            patch("ibutsu_server.util.oauth.get_provider_config") as mock_config,
            patch("ibutsu_server.util.oauth.requests.get", return_value=mock_response),
        ):
            mock_config.return_value = {
                "user_url": "https://api.example.com/user",
                # No email_url
            }

            user = get_user_from_provider("example", auth_data)

            assert user is None


def test_get_user_from_provider_existing_user(flask_app, make_user):
    """Test get_user_from_provider returns existing user if email matches"""
    client, _ = flask_app

    with client.application.app_context():
        # Create existing user
        existing_user = make_user(email="existing@example.com", name="Existing User")

        auth_data = {
            "iat": "google-user-id",
            "email": "existing@example.com",
            "name": "Google User",
        }

        with patch("ibutsu_server.util.oauth.get_provider_config"):
            user = get_user_from_provider("google", auth_data)

            assert user is not None
            assert user.id == existing_user.id
            assert user.email == "existing@example.com"
            # Name should be from existing user, not auth_data
            assert user.name == "Existing User"


def test_get_user_from_provider_with_access_token_key(flask_app):
    """Test get_user_from_provider with accessToken (camelCase) key"""
    client, _ = flask_app

    with client.application.app_context():
        auth_data = {
            "accessToken": "test-access-token",  # camelCase
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "user-id",
            "email": "test@example.com",
            "name": "Test User",
        }

        with (
            patch("ibutsu_server.util.oauth.get_provider_config") as mock_config,
            patch("ibutsu_server.util.oauth.requests.get", return_value=mock_response),
        ):
            mock_config.return_value = {
                "user_url": "https://api.example.com/user",
            }

            user = get_user_from_provider("example", auth_data)

            assert user is not None
            assert user.email == "test@example.com"
