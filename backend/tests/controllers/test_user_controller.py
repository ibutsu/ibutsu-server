from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest

from ibutsu_server.db import db
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Token, User


def test_get_current_user_success(flask_app, auth_headers):
    """Test case for get_current_user - successful retrieval"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/user",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    # Verify sensitive fields are hidden
    response_data = response.json()
    assert "password" not in response_data
    assert "_password" not in response_data
    assert "activation_code" not in response_data
    assert response_data["email"] == "test@example.com"


def test_get_current_user_unauthorized(flask_app):
    """Test case for get_current_user - no token"""
    client, _jwt_token = flask_app

    headers = {
        "Accept": "application/json",
        # No Authorization header
    }
    response = client.get(
        "/api/user",
        headers=headers,
    )
    # Should return 401 without valid token
    assert response.status_code in [401, 403]


@patch("ibutsu_server.controllers.user_controller.generate_token")
def test_create_token(mock_generate_token, flask_app, auth_headers):
    """Test case for create_token"""
    client, jwt_token = flask_app

    mock_generate_token.return_value = "generated_token_value"

    # Calculate expiry 30 days from now
    expiry = datetime.now(UTC) + timedelta(days=30)

    token_data = {
        "name": "test-token",
        "expires": expiry.isoformat(),
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/user/token",
        headers=headers,
        json=token_data,
    )
    assert response.status_code == 201, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["name"] == "test-token"
    assert "token" in response_data

    # Verify in database
    with client.application.app_context():
        token = Token.query.filter_by(name="test-token").first()
        assert token is not None


def test_get_token_list(flask_app, auth_headers):
    """Test case for get_token_list"""
    client, jwt_token = flask_app

    # Create some tokens
    with client.application.app_context():
        test_user = User.query.filter_by(email="test@example.com").first()

        for i in range(3):
            token = Token(
                name=f"token-{i}",
                user_id=test_user.id,
                token=f"token_value_{i}",
                expires=datetime.now(UTC) + timedelta(days=30),
            )
            session.add(token)
        session.commit()

    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/user/token",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert "tokens" in response_data
    assert len(response_data["tokens"]) >= 3


def test_delete_token(flask_app, auth_headers):
    """Test case for delete_token"""
    client, jwt_token = flask_app

    # Create a token to delete
    with client.application.app_context():
        test_user = User.query.filter_by(email="test@example.com").first()

        token = Token(
            name="token-to-delete",
            user_id=test_user.id,
            token="token_value_to_delete",
            expires=datetime.now(UTC) + timedelta(days=30),
        )
        session.add(token)
        session.commit()
        session.refresh(token)
        token_id = token.id

    headers = auth_headers(jwt_token)
    response = client.delete(
        f"/api/user/token/{token_id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    # Verify token was deleted
    with client.application.app_context():
        deleted_token = db.session.get(Token, str(token_id))
        assert deleted_token is None


def test_delete_token_not_found(flask_app, auth_headers):
    """Test case for delete_token - token not found"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.delete(
        "/api/user/token/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == 404


def test_update_current_user(flask_app, auth_headers):
    """Test case for update_current_user - update user details"""
    client, jwt_token = flask_app

    update_data = {"name": "Updated Name"}

    headers = auth_headers(jwt_token)
    response = client.put(
        "/api/user",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["name"] == "Updated Name"
    assert response_data["email"] == "test@example.com"


def test_update_current_user_cannot_change_superadmin_status(flask_app, auth_headers):
    """Test case for update_current_user - is_superadmin field is ignored via API"""
    client, jwt_token = flask_app

    # Attempt to change superadmin status (should be ignored)
    update_data = {"name": "Updated Name", "is_superadmin": False}

    headers = auth_headers(jwt_token)
    response = client.put(
        "/api/user",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    # Verify superadmin status wasn't changed (is_superadmin field was stripped)
    with client.application.app_context():
        test_user = User.query.filter_by(email="test@example.com").first()
        # Should still be superadmin (as set in fixture) - API ignores is_superadmin field
        assert test_user.is_superadmin is True


def test_update_current_user_invalid_json(flask_app, headers_without_json):
    """Test case for update_current_user - invalid content type"""
    client, jwt_token = flask_app

    headers = headers_without_json(jwt_token)
    response = client.put(
        "/api/user",
        headers=headers,
        data="not json",
    )
    # Should return error for non-JSON request
    assert response.status_code in [400, 415]


def test_get_token(flask_app, auth_headers):
    """Test case for get_token - retrieve specific token"""
    client, jwt_token = flask_app

    # Create a token
    with client.application.app_context():
        test_user = User.query.filter_by(email="test@example.com").first()

        token = Token(
            name="test-get-token",
            user_id=test_user.id,
            token="token_value_test",
            expires=datetime.now(UTC) + timedelta(days=30),
        )
        session.add(token)
        session.commit()
        session.refresh(token)
        token_id = token.id

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/user/token/{token_id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["name"] == "test-get-token"
    assert response_data["id"] == str(token_id)


def test_get_token_not_found(flask_app, auth_headers):
    """Test case for get_token - token not found"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/user/token/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == 404


def test_get_token_forbidden_other_user(flask_app, auth_headers, make_user):
    """Test case for get_token - cannot access another user's token"""
    client, jwt_token = flask_app

    # Create another user with a token
    with client.application.app_context():
        other_user = make_user(email="other@example.com")
        other_token = Token(
            name="other-user-token",
            user_id=other_user.id,
            token="other_token_value",
            expires=datetime.now(UTC) + timedelta(days=30),
        )
        session.add(other_token)
        session.commit()
        session.refresh(other_token)
        other_token_id = other_token.id

    # Try to access other user's token
    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/user/token/{other_token_id}",
        headers=headers,
    )
    assert response.status_code == 403


def test_delete_token_forbidden_other_user(flask_app, auth_headers, make_user):
    """Test case for delete_token - cannot delete another user's token"""
    client, jwt_token = flask_app

    # Create another user with a token
    with client.application.app_context():
        other_user = make_user(email="other@example.com")
        other_token = Token(
            name="other-user-token-delete",
            user_id=other_user.id,
            token="other_token_value_delete",
            expires=datetime.now(UTC) + timedelta(days=30),
        )
        session.add(other_token)
        session.commit()
        session.refresh(other_token)
        other_token_id = other_token.id

    # Try to delete other user's token
    headers = auth_headers(jwt_token)
    response = client.delete(
        f"/api/user/token/{other_token_id}",
        headers=headers,
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    ("page", "page_size"),
    [
        (1, 25),
        (2, 10),
        (1, 50),
    ],
)
def test_get_token_list_pagination(flask_app, auth_headers, page, page_size):
    """Test case for get_token_list with pagination"""
    client, jwt_token = flask_app

    # Create tokens for pagination testing
    with client.application.app_context():
        test_user = User.query.filter_by(email="test@example.com").first()

        for i in range(30):
            token = Token(
                name=f"pagination-token-{i}",
                user_id=test_user.id,
                token=f"token_value_pagination_{i}",
                expires=datetime.now(UTC) + timedelta(days=30),
            )
            session.add(token)
        session.commit()

    query_string = [("page", page), ("pageSize", page_size)]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/user/token",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert "tokens" in response_data
    assert "pagination" in response_data
    assert response_data["pagination"]["page"] == page
    assert response_data["pagination"]["pageSize"] == page_size
    assert len(response_data["tokens"]) <= page_size


def test_add_token_with_string_expires(flask_app, auth_headers):
    """Test case for add_token - handles expires as ISO string"""
    client, jwt_token = flask_app

    # Calculate expiry 30 days from now as ISO string
    expiry = datetime.now(UTC) + timedelta(days=30)
    expiry_str = expiry.isoformat()

    token_data = {
        "name": "test-token-string-expires",
        "expires": expiry_str,
    }

    with patch("ibutsu_server.controllers.user_controller.generate_token") as mock_generate:
        mock_generate.return_value = "generated_token_string"

        headers = auth_headers(jwt_token)
        response = client.post(
            "/api/user/token",
            headers=headers,
            json=token_data,
        )
        assert response.status_code == 201, f"Response body is : {response.text}"

        response_data = response.json()
        assert response_data["name"] == "test-token-string-expires"


def test_get_token_list_excludes_login_tokens(flask_app, auth_headers):
    """Test case for get_token_list - should not include login-token"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/user/token",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    # Verify no token has name "login-token"
    token_names = [token["name"] for token in response_data["tokens"]]
    assert "login-token" not in token_names


@pytest.mark.parametrize(
    ("token_id", "expected_status"),
    [
        ("not-a-uuid", 400),
        ("invalid-format", 400),
    ],
)
def test_token_operations_invalid_uuid(flask_app, auth_headers, token_id, expected_status):
    """Test token operations with invalid UUID formats"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)

    # Test get_token
    response = client.get(f"/api/user/token/{token_id}", headers=headers)
    assert response.status_code == expected_status

    # Test delete_token
    response = client.delete(f"/api/user/token/{token_id}", headers=headers)
    assert response.status_code == expected_status
