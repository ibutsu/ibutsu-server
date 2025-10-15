from unittest.mock import MagicMock, patch

import pytest
from flask import json

from tests.conftest import MOCK_PROJECT_ID, MOCK_USER_ID
from tests.test_util import MockProject, MockUser

MOCK_NAME = "my-project"
MOCK_DATA = {
    "id": MOCK_PROJECT_ID,
    "name": MOCK_NAME,
    "title": "My Project",
    "owner_id": MOCK_USER_ID,
    "group_id": "9af34437-047c-48a5-bd21-6430e4532414",
    "users": [],
}
MOCK_PROJECT = MockProject.from_dict(**MOCK_DATA)
MOCK_USER = MockUser.from_dict(**{"id": MOCK_DATA["owner_id"]})
MOCK_PROJECT_DICT = MOCK_PROJECT.to_dict()


@pytest.fixture
def project_controller_mocks():
    """Mocks for the project controller tests"""
    with (
        patch("ibutsu_server.controllers.project_controller.session") as mock_session,
        patch(
            "ibutsu_server.controllers.project_controller.project_has_user"
        ) as mock_project_has_user,
        patch(
            "ibutsu_server.controllers.project_controller.add_user_filter"
        ) as mock_add_user_filter,
        patch("ibutsu_server.controllers.project_controller.Project") as mock_project_class,
        patch("ibutsu_server.controllers.project_controller.User") as mock_user_class,
    ):
        MOCK_PROJECT.owner = MOCK_USER
        MOCK_PROJECT.users = [MOCK_USER]
        mock_project_has_user.return_value = True
        mock_offset = MagicMock()
        mock_offset.limit.return_value.all.return_value = [MOCK_PROJECT]
        mock_add_user_filter.return_value.get.return_value = MOCK_PROJECT
        mock_add_user_filter.return_value.offset.return_value = mock_offset
        mock_add_user_filter.return_value.count.return_value = 1
        mock_project_class.query.get.return_value = MOCK_PROJECT
        mock_project_class.from_dict.return_value = MOCK_PROJECT
        mock_user_class.query.get.return_value = MOCK_USER

        yield {
            "session": mock_session,
            "project_has_user": mock_project_has_user,
            "add_user_filter": mock_add_user_filter,
            "project_class": mock_project_class,
            "user_class": mock_user_class,
        }


def test_add_project(flask_app, project_controller_mocks):
    """Test case for add_project"""
    client, jwt_token = flask_app
    mocks = project_controller_mocks
    mocks["project_class"].query.get.return_value = None

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/project",
        method="POST",
        headers=headers,
        data=json.dumps(MOCK_DATA),
        content_type="application/json",
    )
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"
    # The response should include the requesting user in the users array
    expected_dict = MOCK_PROJECT_DICT.copy()
    expected_dict["users"] = [MOCK_USER.to_dict()]
    assert response.json is not None, (
        f"Response has no JSON content: {response.data.decode('utf-8')}"
    )
    assert response.json == expected_dict
    mocks["session"].add.assert_called_once_with(MOCK_PROJECT)
    mocks["session"].commit.assert_called_once()


def test_get_project_by_id(flask_app, project_controller_mocks):
    """Test case for get_project by ID"""
    client, jwt_token = flask_app
    mocks = project_controller_mocks
    mocks["project_class"].query.filter.return_value.first.return_value = None
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(f"/api/project/{MOCK_PROJECT_ID}", method="GET", headers=headers)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    # The response should include the owner in the users array
    expected_dict = MOCK_PROJECT_DICT.copy()
    expected_dict["users"] = [MOCK_USER.to_dict()]
    assert response.json is not None, (
        f"Response has no JSON content: {response.data.decode('utf-8')}"
    )
    assert response.json == expected_dict
    mocks["project_class"].query.get.assert_called_once_with(MOCK_PROJECT_ID)


def test_get_project_by_name(flask_app, project_controller_mocks):
    """Test case for get_project by name"""
    client, jwt_token = flask_app
    mocks = project_controller_mocks
    mocks["project_class"].query.filter.return_value.first.return_value = None
    mocks["project_class"].query.get.return_value = MOCK_PROJECT
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(f"/api/project/{MOCK_PROJECT_ID}", method="GET", headers=headers)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    # The response should include the owner in the users array
    expected_dict = MOCK_PROJECT_DICT.copy()
    expected_dict["users"] = [MOCK_USER.to_dict()]
    assert response.json is not None, (
        f"Response has no JSON content: {response.data.decode('utf-8')}"
    )
    assert response.json == expected_dict


def test_get_project_list(flask_app, project_controller_mocks):
    """Test case for get_project_list"""
    client, jwt_token = flask_app
    query_string = [
        ("page", 56),
        ("pageSize", 56),
    ]
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open("/api/project", method="GET", headers=headers, query_string=query_string)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    expected_project_dict = MOCK_PROJECT_DICT.copy()
    expected_project_dict["users"] = [MOCK_USER.to_dict()]
    expected_response = {
        "pagination": {
            "page": 56,
            "pageSize": 56,
            "totalItems": 1,
            "totalPages": 1,
        },
        "projects": [expected_project_dict],
    }
    assert response.json == expected_response


def test_update_project(flask_app, project_controller_mocks):
    """Test case for update_project"""
    client, jwt_token = flask_app
    updates = {
        "owner_id": "dd338937-95f0-4b4e-a7a4-0d02da9f56e6",
        "group_id": "99174ff1-bfd8-4727-89e4-2904c2644bfb",
    }
    updated_dict = MOCK_PROJECT_DICT.copy()
    updated_dict.update(updates)
    updated_dict["users"] = [MOCK_USER.to_dict()]
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/project/{MOCK_PROJECT_ID}",
        method="PUT",
        headers=headers,
        data=json.dumps(updates),
        content_type="application/json",
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    assert response.json == updated_dict
