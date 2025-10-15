from unittest.mock import MagicMock, patch

import pytest
from flask import json

from tests.conftest import MOCK_TOKEN_ID, MOCK_USER_ID
from tests.test_util import MockToken, MockUser

MOCK_USER = MockUser(id=MOCK_USER_ID, name="John Doe", email="jdoe@example.com")
MOCK_TOKEN = MockToken(id=MOCK_TOKEN_ID, name="test-token", user_id=MOCK_USER.id)
MOCK_USER_DICT = MOCK_USER.to_dict()
MOCK_TOKEN_DICT = MOCK_TOKEN.to_dict()
MOCK_USER_DICT["tokens"] = [MOCK_TOKEN_DICT]


@pytest.fixture
def user_controller_mocks():
    """Mocks for the user controller tests"""
    with (
        patch("ibutsu_server.controllers.user_controller.session") as mock_session,
        patch("ibutsu_server.controllers.user_controller.User") as mock_user_class,
        patch("ibutsu_server.controllers.user_controller.Token") as mock_token_class,
        patch("ibutsu_server.controllers.user_controller.generate_token") as mock_generate_token,
    ):
        mock_user_class.query.get.return_value = MOCK_USER
        mock_token_class.from_dict.return_value = MOCK_TOKEN
        mock_token_class.query.get.return_value = MOCK_TOKEN
        mock_token_query = MagicMock()
        mock_token_query.count.return_value = 1
        mock_token_query.offset.return_value.limit.return_value.all.return_value = [MOCK_TOKEN]
        mock_token_class.query.filter.return_value = mock_token_query
        mock_generate_token.return_value = "generated_token"

        yield {
            "session": mock_session,
            "user_class": mock_user_class,
            "token_class": mock_token_class,
            "generate_token": mock_generate_token,
        }


def test_get_current_user_success(flask_app, user_controller_mocks):
    """Test case for get_current_user - successful retrieval"""
    client, jwt_token = flask_app
    mocks = user_controller_mocks
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/user",
        method="GET",
        headers=headers,
    )
    mocks["user_class"].query.get.assert_called_once()
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    # Verify sensitive fields are hidden
    response_data = response.get_json()
    assert "password" not in response_data
    assert "_password" not in response_data
    assert "activation_code" not in response_data


def test_get_current_user_unauthorized(flask_app, user_controller_mocks):
    """Test case for get_current_user - user not found"""
    client, jwt_token = flask_app
    mocks = user_controller_mocks
    mocks["user_class"].query.get.return_value = None
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/user",
        method="GET",
        headers=headers,
    )
    assert response.status_code == 401, f"Response body is : {response.data.decode('utf-8')}"


def test_update_current_user_success(flask_app, user_controller_mocks):
    """Test case for update_current_user - successful update"""
    client, jwt_token = flask_app
    mocks = user_controller_mocks
    update_data = {
        "name": "Updated User Name",
        "email": "updated@example.com",
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/user",
        method="PUT",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )
    mocks["session"].add.assert_called_once()
    mocks["session"].commit.assert_called_once()
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_update_current_user_removes_superadmin_flag(flask_app, user_controller_mocks):
    """Test case for update_current_user - superadmin flag is removed"""
    client, jwt_token = flask_app
    update_data = {
        "name": "Updated User Name",
        "is_superadmin": True,  # This should be removed
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/user",
        method="PUT",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_update_current_user_unauthorized(flask_app, user_controller_mocks):
    """Test case for update_current_user - user not found"""
    client, jwt_token = flask_app
    mocks = user_controller_mocks
    mocks["user_class"].query.get.return_value = None
    update_data = {"name": "Updated User Name"}
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/user",
        method="PUT",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )
    assert response.status_code == 401, f"Response body is : {response.data.decode('utf-8')}"


def test_get_token_list_pagination(flask_app, user_controller_mocks):
    """Test case for get_token_list with pagination parameters"""
    client, jwt_token = flask_app
    page, page_size = 1, 25
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    query_string = [("page", page), ("pageSize", page_size)]
    response = client.open(
        "/api/user/token",
        method="GET",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    # Verify response structure
    response_data = response.get_json()
    assert "tokens" in response_data
    assert "pagination" in response_data
    assert response_data["pagination"]["page"] == page
    assert response_data["pagination"]["pageSize"] == page_size


def test_get_token_list_unauthorized(flask_app, user_controller_mocks):
    """Test case for get_token_list - user not found"""
    client, jwt_token = flask_app
    mocks = user_controller_mocks
    mocks["user_class"].query.get.return_value = None
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/user/token",
        method="GET",
        headers=headers,
    )
    assert response.status_code == 401, f"Response body is : {response.data.decode('utf-8')}"


def test_get_token_success(flask_app, user_controller_mocks):
    """Test case for get_token - successful retrieval"""
    client, jwt_token = flask_app
    mocks = user_controller_mocks
    MOCK_TOKEN.user = MOCK_USER
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/user/token/{MOCK_TOKEN_ID}",
        method="GET",
        headers=headers,
    )
    mocks["token_class"].query.get.assert_called_once_with(MOCK_TOKEN_ID)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_get_token_forbidden(flask_app, user_controller_mocks):
    """Test case for get_token - token belongs to different user"""
    client, jwt_token = flask_app
    different_user = MockUser(id="different-user-id", name="Different User")
    MOCK_TOKEN.user = different_user
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/user/token/{MOCK_TOKEN_ID}",
        method="GET",
        headers=headers,
    )
    assert response.status_code == 403, f"Response body is : {response.data.decode('utf-8')}"


def test_get_token_not_found(flask_app, user_controller_mocks):
    """Test case for get_token - token not found"""
    client, jwt_token = flask_app
    mocks = user_controller_mocks
    mocks["token_class"].query.get.return_value = None
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/user/token/{MOCK_TOKEN_ID}",
        method="GET",
        headers=headers,
    )
    # The controller should handle None token and return 404
    assert response.status_code == 404, f"Response body is : {response.data.decode('utf-8')}"


def test_delete_token_success(flask_app, user_controller_mocks):
    """Test case for delete_token - successful deletion"""
    client, jwt_token = flask_app
    mocks = user_controller_mocks
    MOCK_TOKEN.user = MOCK_USER
    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/user/token/{MOCK_TOKEN_ID}",
        method="DELETE",
        headers=headers,
    )
    mocks["session"].delete.assert_called_once_with(MOCK_TOKEN)
    mocks["session"].commit.assert_called_once()
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_delete_token_forbidden(flask_app, user_controller_mocks):
    """Test case for delete_token - token belongs to different user"""
    client, jwt_token = flask_app
    different_user = MockUser(id="different-user-id", name="Different User")
    MOCK_TOKEN.user = different_user
    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/user/token/{MOCK_TOKEN_ID}",
        method="DELETE",
        headers=headers,
    )
    assert response.status_code == 403, f"Response body is : {response.data.decode('utf-8')}"


def test_add_token_success(flask_app, user_controller_mocks):
    """Test case for add_token - successful creation"""
    client, jwt_token = flask_app
    mocks = user_controller_mocks
    token_data = {
        "name": "new-test-token",
        "expires": "2024-12-31T23:59:59Z",
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/user/token",
        method="POST",
        headers=headers,
        data=json.dumps(token_data),
        content_type="application/json",
    )
    mocks["token_class"].from_dict.assert_called_once()
    mocks["session"].add.assert_called_once()
    mocks["session"].commit.assert_called_once()
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"


def test_add_token_unauthorized(flask_app, user_controller_mocks):
    """Test case for add_token - user not found"""
    client, jwt_token = flask_app
    mocks = user_controller_mocks
    mocks["user_class"].query.get.return_value = None
    token_data = {
        "name": "new-test-token",
        "expires": "2024-12-31T23:59:59Z",
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/user/token",
        method="POST",
        headers=headers,
        data=json.dumps(token_data),
        content_type="application/json",
    )
    assert response.status_code == 401, f"Response body is : {response.data.decode('utf-8')}"
