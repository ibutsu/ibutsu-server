from unittest.mock import MagicMock, patch

import pytest
from flask import json

from tests.conftest import MOCK_GROUP_ID
from tests.test_util import MockGroup

MOCK_GROUP = MockGroup(id=MOCK_GROUP_ID, name="Example group", data={})
MOCK_GROUP_DICT = MOCK_GROUP.to_dict()
MOCK_LIST_RESPONSE = {"pagination": {"page": 0}, "groups": [MOCK_GROUP]}


@pytest.fixture
def group_controller_mocks():
    """Set up mocks for group controller tests"""
    with (
        patch("ibutsu_server.controllers.group_controller.session") as mock_session,
        patch("ibutsu_server.controllers.group_controller.Group") as mock_group,
    ):
        mock_limit = MagicMock()
        mock_limit.return_value.offset.return_value.all.return_value = [MOCK_GROUP]
        # Configure default return values
        mock_group.from_dict.return_value = MOCK_GROUP
        mock_group.query.count.return_value = 1
        mock_group.query.get.return_value = MOCK_GROUP
        mock_group.query.limit = mock_limit
        yield {"session": mock_session, "group": mock_group, "limit": mock_limit}


def test_add_group(flask_app, group_controller_mocks):
    """Test case for add_group
    Create a new group
    """
    client, jwt_token = flask_app
    mocks = group_controller_mocks
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    mocks["group"].query.get.return_value = None
    response = client.open(
        "/api/group",
        method="POST",
        headers=headers,
        data=json.dumps({"name": "Example group"}),
        content_type="application/json",
    )
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"
    assert response.json == MOCK_GROUP_DICT


def test_get_group(flask_app, group_controller_mocks):
    """Test case for get_group
    Get a group
    """
    client, jwt_token = flask_app
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(f"/api/group/{MOCK_GROUP_ID}", method="GET", headers=headers)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    assert response.json == MOCK_GROUP_DICT


def test_get_group_list(flask_app, group_controller_mocks):
    """Test case for get_group_list
    Get a list of groups
    """
    client, jwt_token = flask_app
    query_string = [("page", 56), ("pageSize", 56)]
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open("/api/group", method="GET", headers=headers, query_string=query_string)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    assert response.json == {
        "groups": [MOCK_GROUP_DICT],
        "pagination": {
            "page": 56,
            "pageSize": 56,
            "totalItems": 1,
            "totalPages": 1,
        },
    }


def test_update_group(flask_app, group_controller_mocks):
    """Test case for update_group
    Update a group
    """
    client, jwt_token = flask_app
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/group/{MOCK_GROUP_ID}",
        method="PUT",
        headers=headers,
        data=json.dumps({"name": "Changed name"}),
        content_type="application/json",
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    MOCK_GROUP.update({"name": "Changed name"})
    assert response.json == MOCK_GROUP.to_dict()
