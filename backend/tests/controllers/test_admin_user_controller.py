from http import HTTPStatus
from unittest.mock import MagicMock, patch

import pytest
from flask import json

from tests.conftest import MOCK_ADMIN_USER_ID, MOCK_PROJECT_ID, MOCK_USER_ID
from tests.test_util import MockProject, MockUser

MOCK_USER = MockUser(
    id=MOCK_USER_ID,
    name="Test User",
    email="test@example.com",
    password="hashed_password",
    is_superadmin=False,
)
MOCK_ADMIN_USER = MockUser(
    id=MOCK_ADMIN_USER_ID,
    name="Admin User",
    email="admin@example.com",
    password="hashed_password",
    is_superadmin=True,
)
MOCK_PROJECT = MockProject(
    id=MOCK_PROJECT_ID,
    name="test-project",
    title="Test Project",
)


@pytest.fixture
def admin_user_controller_mocks():
    """Set up mocks for admin user controller tests"""
    with (
        patch("ibutsu_server.controllers.admin.user_controller.session") as mock_session,
        patch("ibutsu_server.controllers.admin.user_controller.User") as mock_user_class,
        patch("ibutsu_server.controllers.admin.user_controller.Project") as mock_project_class,
        patch(
            "ibutsu_server.controllers.admin.user_controller.validate_admin"
        ) as mock_validate_admin,
        patch("ibutsu_server.controllers.admin.user_controller.abort") as mock_abort,
    ):
        # Configure default return values
        mock_user_class.query.get.return_value = MOCK_USER
        mock_user_class.from_dict.return_value = MOCK_USER
        mock_project_class.query.get.return_value = MOCK_PROJECT

        # Mock validate_admin decorator to pass through and set user
        def mock_validate_admin_decorator(func):
            def wrapper(**kwargs):
                kwargs["user"] = MOCK_ADMIN_USER.id  # Set the admin user ID for admin functions
                return func(**kwargs)

            return wrapper

        mock_validate_admin.side_effect = mock_validate_admin_decorator
        mock_abort.side_effect = Exception("Aborted")  # Simulate abort behavior
        yield {
            "session": mock_session,
            "user_class": mock_user_class,
            "project_class": mock_project_class,
            "validate_admin": mock_validate_admin,
            "abort": mock_abort,
        }


def test_admin_get_user_success(flask_app, admin_user_controller_mocks):
    """Test case for admin_get_user - successful retrieval"""
    client, jwt_token = flask_app
    mocks = admin_user_controller_mocks
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/admin/user/{MOCK_USER_ID}",
        method="GET",
        headers=headers,
    )
    mocks["user_class"].query.get.assert_called_once_with(MOCK_USER_ID)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    # Verify sensitive fields are hidden
    response_data = response.get_json()
    assert "password" not in response_data
    assert "_password" not in response_data
    assert "activation_code" not in response_data


def test_admin_get_user_not_found(flask_app, admin_user_controller_mocks):
    """Test case for admin_get_user - user not found"""
    client, jwt_token = flask_app
    mocks = admin_user_controller_mocks
    mocks["user_class"].query.get.return_value = None
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    with pytest.raises(Exception, match="Aborted"):
        client.open(
            f"/api/admin/user/{MOCK_USER_ID}",
            method="GET",
            headers=headers,
        )
    mocks["abort"].assert_called_once_with(HTTPStatus.NOT_FOUND)


@pytest.mark.parametrize(
    ("page", "page_size", "expected_offset"),
    [
        (1, 25, 0),
        (2, 10, 10),
        (3, 5, 10),
    ],
)
def test_admin_get_user_list_pagination(
    flask_app, admin_user_controller_mocks, page, page_size, expected_offset
):
    """Test case for admin_get_user_list with different pagination parameters"""
    client, jwt_token = flask_app
    mocks = admin_user_controller_mocks
    mock_query = MagicMock()
    mock_query.count.return_value = 100
    mock_query.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
        MOCK_USER
    ]
    mocks["user_class"].query = mock_query
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    query_string = [("page", page), ("pageSize", page_size)]
    response = client.open(
        "/api/admin/user",
        method="GET",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    # Verify pagination calculation
    mock_query.order_by.return_value.offset.assert_called_with(expected_offset)
    mock_query.order_by.return_value.offset.return_value.limit.assert_called_with(page_size)


def test_admin_get_user_list_with_filters(flask_app, admin_user_controller_mocks):
    """Test case for admin_get_user_list with filters"""
    client, jwt_token = flask_app
    mocks = admin_user_controller_mocks
    mock_query = MagicMock()
    mock_query.count.return_value = 1
    mock_query.filter.return_value = mock_query
    mock_query.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
        MOCK_USER
    ]
    mocks["user_class"].query = mock_query
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    query_string = [("filter", "email=test@example.com")]
    response = client.open(
        "/api/admin/user",
        method="GET",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_admin_add_user_success(flask_app, admin_user_controller_mocks):
    """Test case for admin_add_user - successful creation"""
    client, jwt_token = flask_app
    mocks = admin_user_controller_mocks
    # Mock that user doesn't exist
    mocks["user_class"].query.filter_by.return_value.first.return_value = None
    user_data = {
        "name": "New User",
        "email": "newuser@example.com",
        "password": "password123",
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/admin/user",
        method="POST",
        headers=headers,
        data=json.dumps(user_data),
        content_type="application/json",
    )
    mocks["user_class"].from_dict.assert_called_once()
    mocks["session"].add.assert_called_once()
    mocks["session"].commit.assert_called_once()
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"


def test_admin_add_user_already_exists(flask_app, admin_user_controller_mocks):
    """Test case for admin_add_user - user already exists"""
    client, jwt_token = flask_app
    mocks = admin_user_controller_mocks
    # Mock that user already exists
    mocks["user_class"].query.filter_by.return_value.first.return_value = MOCK_USER
    user_data = {
        "name": "New User",
        "email": "test@example.com",  # Same as existing user
        "password": "password123",
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/admin/user",
        method="POST",
        headers=headers,
        data=json.dumps(user_data),
        content_type="application/json",
    )
    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"
    assert "already exists" in response.data.decode("utf-8")


def test_admin_update_user_success(flask_app, admin_user_controller_mocks):
    """Test case for admin_update_user - successful update"""
    client, jwt_token = flask_app
    mocks = admin_user_controller_mocks
    update_data = {
        "name": "Updated User Name",
        "email": "updated@example.com",
        "projects": [{"id": MOCK_PROJECT_ID}],
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/admin/user/{MOCK_USER_ID}",
        method="PUT",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )
    mocks["user_class"].query.get.assert_called_with(MOCK_USER_ID)
    mocks["session"].add.assert_called_once()
    mocks["session"].commit.assert_called_once()
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_admin_update_user_not_found(flask_app, admin_user_controller_mocks):
    """Test case for admin_update_user - user not found"""
    client, jwt_token = flask_app
    mocks = admin_user_controller_mocks
    mocks["user_class"].query.get.return_value = None
    update_data = {"name": "Updated User Name", "email": "updated@example.com"}
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    with pytest.raises(Exception, match="Aborted"):
        client.open(
            f"/api/admin/user/{MOCK_USER_ID}",
            method="PUT",
            headers=headers,
            data=json.dumps(update_data),
            content_type="application/json",
        )
    mocks["abort"].assert_called_once_with(HTTPStatus.NOT_FOUND)


def test_admin_delete_user_success(flask_app, admin_user_controller_mocks):
    """Test case for admin_delete_user - successful deletion"""
    client, jwt_token = flask_app
    mocks = admin_user_controller_mocks
    # Mock multiple superadmins exist
    mock_superadmin_query = MagicMock()
    mock_superadmin_query.count.return_value = 2
    mocks["user_class"].query.filter_by.return_value = mock_superadmin_query
    # Mock current user (different from user being deleted)
    current_user = MockUser(id="current-user-id", is_superadmin=True)
    mocks["user_class"].query.get.side_effect = lambda user_id: (
        MOCK_USER if user_id == MOCK_USER_ID else current_user
    )
    # Mock user cleanup method
    MOCK_USER.user_cleanup = MagicMock()
    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/admin/user/{MOCK_USER_ID}",
        method="DELETE",
        headers=headers,
    )
    MOCK_USER.user_cleanup.assert_called_once()
    mocks["session"].delete.assert_called_once_with(MOCK_USER)
    mocks["session"].commit.assert_called_once()
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_admin_delete_user_not_found(flask_app, admin_user_controller_mocks):
    """Test case for admin_delete_user - user not found"""
    client, jwt_token = flask_app
    mocks = admin_user_controller_mocks
    mocks["user_class"].query.get.return_value = None
    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    with pytest.raises(Exception, match="Aborted"):
        client.open(
            f"/api/admin/user/{MOCK_USER_ID}",
            method="DELETE",
            headers=headers,
        )
    mocks["abort"].assert_called_once_with(HTTPStatus.NOT_FOUND)


def test_admin_delete_user_cannot_delete_self(flask_app, admin_user_controller_mocks):
    """Test case for admin_delete_user - cannot delete self"""
    client, jwt_token = flask_app
    mocks = admin_user_controller_mocks
    # Mock that the user being deleted is the same as current user
    current_user = MockUser(id=MOCK_USER_ID, is_superadmin=True)
    mocks["user_class"].query.get.return_value = current_user
    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    with pytest.raises(Exception, match="Aborted"):
        client.open(
            f"/api/admin/user/{MOCK_USER_ID}",
            method="DELETE",
            headers=headers,
        )
    # Should abort with BAD_REQUEST
    mocks["abort"].assert_called_with(HTTPStatus.BAD_REQUEST, description="Cannot delete yourself")


def test_admin_delete_user_last_superadmin(flask_app, admin_user_controller_mocks):
    """Test case for admin_delete_user - cannot delete last superadmin"""
    client, jwt_token = flask_app
    mocks = admin_user_controller_mocks
    # Mock that user is superadmin and only one exists
    superadmin_user = MockUser(id=MOCK_USER_ID, is_superadmin=True)
    current_user = MockUser(id="current-user-id", is_superadmin=True)
    mocks["user_class"].query.get.side_effect = lambda user_id: (
        superadmin_user if user_id == MOCK_USER_ID else current_user
    )
    mock_superadmin_query = MagicMock()
    mock_superadmin_query.count.return_value = 1  # Only one superadmin
    mocks["user_class"].query.filter_by.return_value = mock_superadmin_query
    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    with pytest.raises(Exception, match="Aborted"):
        client.open(
            f"/api/admin/user/{MOCK_USER_ID}",
            method="DELETE",
            headers=headers,
        )
    mocks["abort"].assert_called_with(
        HTTPStatus.BAD_REQUEST, description="Cannot delete the last superadmin user"
    )


def test_admin_delete_user_cleanup_exception(flask_app, admin_user_controller_mocks):
    """Test case for admin_delete_user - exception during cleanup"""
    client, jwt_token = flask_app
    mocks = admin_user_controller_mocks
    # Mock multiple superadmins exist
    mock_superadmin_query = MagicMock()
    mock_superadmin_query.count.return_value = 2
    mocks["user_class"].query.filter_by.return_value = mock_superadmin_query
    # Mock current user (different from user being deleted)
    current_user = MockUser(id="current-user-id", is_superadmin=True)
    mocks["user_class"].query.get.side_effect = lambda user_id: (
        MOCK_USER if user_id == MOCK_USER_ID else current_user
    )
    # Mock user cleanup method to raise exception
    MOCK_USER.user_cleanup = MagicMock(side_effect=Exception("Cleanup failed"))
    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    with pytest.raises(Exception, match="Aborted"):
        client.open(
            f"/api/admin/user/{MOCK_USER_ID}",
            method="DELETE",
            headers=headers,
        )
    mocks["session"].rollback.assert_called_once()
    mocks["abort"].assert_called_with(HTTPStatus.INTERNAL_SERVER_ERROR)
