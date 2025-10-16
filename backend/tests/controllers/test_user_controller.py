from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from flask import json


def test_get_current_user_success(flask_app):
    """Test case for get_current_user - successful retrieval"""
    client, jwt_token = flask_app

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        "/api/user",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    # Verify sensitive fields are hidden
    response_data = response.get_json()
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
def test_create_token(mock_generate_token, flask_app):
    """Test case for create_token"""
    client, jwt_token = flask_app

    mock_generate_token.return_value = "generated_token_value"

    # Calculate expiry 30 days from now
    expiry = datetime.now(timezone.utc) + timedelta(days=30)

    token_data = {
        "name": "test-token",
        "expires": expiry.isoformat(),
    }

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.post(
        "/api/user/token",
        headers=headers,
        data=json.dumps(token_data),
        content_type="application/json",
    )
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["name"] == "test-token"
    assert "token" in response_data

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db.models import Token

        token = Token.query.filter_by(name="test-token").first()
        assert token is not None


def test_get_token_list(flask_app):
    """Test case for get_token_list"""
    client, jwt_token = flask_app

    # Create some tokens
    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Token, User

        test_user = User.query.filter_by(email="test@example.com").first()

        for i in range(3):
            token = Token(
                name=f"token-{i}",
                user_id=test_user.id,
                token=f"token_value_{i}",
                expires=datetime.now(timezone.utc) + timedelta(days=30),
            )
            session.add(token)
        session.commit()

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        "/api/user/token",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert "tokens" in response_data
    assert len(response_data["tokens"]) >= 3


def test_delete_token(flask_app):
    """Test case for delete_token"""
    client, jwt_token = flask_app

    # Create a token to delete
    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Token, User

        test_user = User.query.filter_by(email="test@example.com").first()

        token = Token(
            name="token-to-delete",
            user_id=test_user.id,
            token="token_value_to_delete",
            expires=datetime.now(timezone.utc) + timedelta(days=30),
        )
        session.add(token)
        session.commit()
        session.refresh(token)
        token_id = token.id

    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.delete(
        f"/api/user/token/{token_id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    # Verify token was deleted
    with client.application.app_context():
        from ibutsu_server.db.models import Token

        deleted_token = Token.query.get(str(token_id))
        assert deleted_token is None


def test_delete_token_not_found(flask_app):
    """Test case for delete_token - token not found"""
    client, jwt_token = flask_app

    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.delete(
        "/api/user/token/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == 404
