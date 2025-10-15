from http import HTTPStatus
from unittest.mock import MagicMock, patch

import pytest
from flask import json

from tests.conftest import MOCK_GROUP_ID, MOCK_PROJECT_ID, MOCK_USER_ID
from tests.test_util import MockGroup, MockProject, MockUser

MOCK_PROJECT = MockProject(
    id=MOCK_PROJECT_ID,
    name="test-project",
    title="Test Project",
    owner_id=MOCK_USER_ID,
    group_id=MOCK_GROUP_ID,
)

MOCK_USER = MockUser(
    id=MOCK_USER_ID,
    name="Test User",
    email="test@example.com",
    is_superadmin=True,
)

MOCK_GROUP = MockGroup(
    id=MOCK_GROUP_ID,
    name="test-group",
)


@pytest.fixture
def admin_project_controller_mocks():
    """Mocks for the admin project controller tests"""
    with (
        patch("ibutsu_server.controllers.admin.project_controller.session") as mock_session,
        patch("ibutsu_server.controllers.admin.project_controller.Project") as mock_project_class,
        patch("ibutsu_server.controllers.admin.project_controller.User") as mock_user_class,
        patch("ibutsu_server.controllers.admin.project_controller.Group") as mock_group_class,
        patch(
            "ibutsu_server.controllers.admin.project_controller.validate_admin"
        ) as mock_validate_admin,
        patch("ibutsu_server.controllers.admin.project_controller.abort") as mock_abort,
        patch("ibutsu_server.controllers.admin.project_controller.is_uuid") as mock_is_uuid,
        patch(
            "ibutsu_server.controllers.admin.project_controller.convert_objectid_to_uuid"
        ) as mock_convert_objectid,
    ):
        mock_project_class.query.get.return_value = MOCK_PROJECT
        mock_project_class.from_dict.return_value = MOCK_PROJECT
        mock_user_class.query.get.return_value = MOCK_USER
        mock_group_class.query.get.return_value = MOCK_GROUP
        mock_is_uuid.return_value = True
        mock_convert_objectid.return_value = MOCK_PROJECT_ID

        def mock_validate_admin_decorator(func):
            def wrapper(**kwargs):
                kwargs["user"] = MOCK_USER.id  # Set the user ID for admin functions
                return func(**kwargs)

            return wrapper

        mock_validate_admin.side_effect = mock_validate_admin_decorator
        mock_abort.side_effect = Exception("Aborted")  # Simulate abort behavior

        yield {
            "session": mock_session,
            "project_class": mock_project_class,
            "user_class": mock_user_class,
            "group_class": mock_group_class,
            "validate_admin": mock_validate_admin,
            "abort": mock_abort,
            "is_uuid": mock_is_uuid,
            "convert_objectid": mock_convert_objectid,
        }


def test_admin_add_project_success(flask_app, admin_project_controller_mocks):
    """Test case for admin_add_project - successful creation"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    # Mock that project doesn't exist
    mocks["project_class"].query.get.return_value = None

    # Mock project has users list
    MOCK_PROJECT.users = []

    project_data = {
        "name": "new-project",
        "title": "New Project",
        "group_id": MOCK_GROUP_ID,
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/admin/project",
        method="POST",
        headers=headers,
        data=json.dumps(project_data),
        content_type="application/json",
    )
    mocks["project_class"].from_dict.assert_called_once()
    mocks["session"].add.assert_called_once()
    mocks["session"].commit.assert_called_once()
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"


def test_admin_add_project_already_exists(flask_app, admin_project_controller_mocks):
    """Test case for admin_add_project - project already exists"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    # Mock project with ID that already exists
    existing_project = MockProject(id=MOCK_PROJECT_ID, name="existing")
    mocks["project_class"].from_dict.return_value = existing_project
    mocks["project_class"].query.get.return_value = existing_project

    project_data = {
        "id": MOCK_PROJECT_ID,
        "name": "new-project",
        "title": "New Project",
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/admin/project",
        method="POST",
        headers=headers,
        data=json.dumps(project_data),
        content_type="application/json",
    )
    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"
    assert "already exist" in response.data.decode("utf-8")


def test_admin_add_project_group_not_found(flask_app, admin_project_controller_mocks):
    """Test case for admin_add_project - group not found"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    # Mock that project doesn't exist but group doesn't exist
    mocks["project_class"].query.get.return_value = None
    mocks["group_class"].query.get.return_value = None

    project_data = {
        "name": "new-project",
        "title": "New Project",
        "group_id": "nonexistent-group-id",
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/admin/project",
        method="POST",
        headers=headers,
        data=json.dumps(project_data),
        content_type="application/json",
    )
    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"
    assert "doesn't exist" in response.data.decode("utf-8")


def test_admin_add_project_with_user_as_owner(flask_app, admin_project_controller_mocks):
    """Test case for admin_add_project - user becomes owner and is added to users list"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    # Mock that project doesn't exist
    mocks["project_class"].query.get.return_value = None

    # Mock project has users list
    MOCK_PROJECT.users = []
    MOCK_PROJECT.owner = None

    project_data = {
        "name": "new-project",
        "title": "New Project",
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/admin/project",
        method="POST",
        headers=headers,
        data=json.dumps(project_data),
        content_type="application/json",
    )

    # Verify user was set as owner and added to users
    assert MOCK_PROJECT.owner == MOCK_USER
    assert MOCK_USER in MOCK_PROJECT.users
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"


def test_admin_get_project_success(flask_app, admin_project_controller_mocks):
    """Test case for admin_get_project - successful retrieval by ID"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/admin/project/{MOCK_PROJECT_ID}",
        method="GET",
        headers=headers,
    )
    mocks["project_class"].query.get.assert_called_once_with(MOCK_PROJECT_ID)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_admin_get_project_by_name(flask_app, admin_project_controller_mocks):
    """Test case for admin_get_project - successful retrieval by name"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    # Mock that get by ID returns the project
    mocks["project_class"].query.get.return_value = MOCK_PROJECT

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/admin/project/{MOCK_PROJECT_ID}",
        method="GET",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_admin_get_project_not_found(flask_app, admin_project_controller_mocks):
    """Test case for admin_get_project - project not found"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    mocks["project_class"].query.get.return_value = None
    mocks["project_class"].query.filter.return_value.first.return_value = None

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }

    with pytest.raises(Exception, match="Aborted"):
        client.open(
            f"/api/admin/project/{MOCK_PROJECT_ID}",
            method="GET",
            headers=headers,
        )

    mocks["abort"].assert_called_once_with(HTTPStatus.NOT_FOUND)


def test_admin_get_project_list_pagination(flask_app, admin_project_controller_mocks):
    """Test case for admin_get_project_list with pagination parameters"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    page, page_size = 2, 10
    mock_query = MagicMock()
    mock_query.count.return_value = 100
    mock_query.offset.return_value.limit.return_value.all.return_value = [MOCK_PROJECT]
    mocks["project_class"].query = mock_query

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    query_string = [("page", page), ("pageSize", page_size)]
    response = client.open(
        "/api/admin/project",
        method="GET",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    # Verify pagination calculation
    expected_offset = (page - 1) * page_size
    mock_query.offset.assert_called_with(expected_offset)
    mock_query.offset.return_value.limit.assert_called_with(page_size)


def test_admin_get_project_list_with_filters(flask_app, admin_project_controller_mocks):
    """Test case for admin_get_project_list with owner and group filters"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    mock_query = MagicMock()
    mock_query.count.return_value = 1
    mock_query.filter.return_value = mock_query
    mock_query.offset.return_value.limit.return_value.all.return_value = [MOCK_PROJECT]
    mocks["project_class"].query = mock_query

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    query_string = [
        ("owner_id", MOCK_USER_ID),
        ("group_id", MOCK_GROUP_ID),
    ]
    response = client.open(
        "/api/admin/project",
        method="GET",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_admin_get_project_list_page_too_big(flask_app, admin_project_controller_mocks):
    """Test case for admin_get_project_list - page number too big"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    mock_query = MagicMock()
    mock_query.count.return_value = 1
    mocks["project_class"].query = mock_query

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    # Use a very large page number that would cause overflow
    query_string = [("page", 999999999999999999), ("pageSize", 25)]
    response = client.open(
        "/api/admin/project",
        method="GET",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"
    assert "too big" in response.data.decode("utf-8")


def test_admin_update_project_success(flask_app, admin_project_controller_mocks):
    """Test case for admin_update_project - successful update"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    # Mock project has users list
    MOCK_PROJECT.users = []

    update_data = {
        "title": "Updated Project Title",
        "users": ["newuser@example.com"],
        "owner_id": MOCK_USER_ID,
    }

    # Mock user lookup for email
    new_user = MockUser(id="new-user-id", email="newuser@example.com")
    mocks["user_class"].query.filter_by.return_value.first.return_value = new_user

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/admin/project/{MOCK_PROJECT_ID}",
        method="PUT",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )

    mocks["session"].add.assert_called_once()
    mocks["session"].commit.assert_called_once()
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_admin_update_project_not_found(flask_app, admin_project_controller_mocks):
    """Test case for admin_update_project - project not found"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    mocks["project_class"].query.get.return_value = None

    update_data = {"title": "Updated Project Title"}
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }

    with pytest.raises(Exception, match="Aborted"):
        client.open(
            f"/api/admin/project/{MOCK_PROJECT_ID}",
            method="PUT",
            headers=headers,
            data=json.dumps(update_data),
            content_type="application/json",
        )

    mocks["abort"].assert_called_once_with(HTTPStatus.NOT_FOUND)


def test_admin_update_project_converts_objectid(flask_app, admin_project_controller_mocks):
    """Test case for admin_update_project - converts ObjectId to UUID"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    mocks["is_uuid"].return_value = False
    object_id = "507f1f77bcf86cd799439011"

    # Mock project has users list
    MOCK_PROJECT.users = []

    update_data = {"title": "Updated Project Title"}
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/admin/project/{object_id}",
        method="PUT",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )

    mocks["convert_objectid"].assert_called_once_with(object_id)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_admin_delete_project_success(flask_app, admin_project_controller_mocks):
    """Test case for admin_delete_project - successful deletion"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/admin/project/{MOCK_PROJECT_ID}",
        method="DELETE",
        headers=headers,
    )

    mocks["session"].delete.assert_called_once_with(MOCK_PROJECT)
    mocks["session"].commit.assert_called_once()
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_admin_delete_project_not_found(flask_app, admin_project_controller_mocks):
    """Test case for admin_delete_project - project not found"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    mocks["project_class"].query.get.return_value = None

    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }

    with pytest.raises(Exception, match="Aborted"):
        client.open(
            f"/api/admin/project/{MOCK_PROJECT_ID}",
            method="DELETE",
            headers=headers,
        )

    mocks["abort"].assert_called_once_with(HTTPStatus.NOT_FOUND)


def test_admin_delete_project_invalid_uuid(flask_app, admin_project_controller_mocks):
    """Test case for admin_delete_project - invalid UUID format"""
    client, jwt_token = flask_app
    mocks = admin_project_controller_mocks
    mocks["is_uuid"].return_value = False
    invalid_id = "not-a-valid-uuid"

    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/admin/project/{invalid_id}",
        method="DELETE",
        headers=headers,
    )

    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"
    assert "is not a valid UUID" in response.data.decode("utf-8")
