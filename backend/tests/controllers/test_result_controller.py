from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from flask import json

from tests.conftest import MOCK_RESULT_ID
from tests.test_util import MockProject, MockResult

START_TIME = datetime.utcnow()
MOCK_RESULT = MockResult(
    id=MOCK_RESULT_ID,
    duration=6.027456183070403,
    result="passed",
    component="fake-component",
    data={
        "jenkins_build": 145,
        "commit_hash": "F4BA3E12",
        "assignee": "jdoe",
        "component": "fake-component",
        "project": "test-project",
    },
    start_time=str(START_TIME),
    source="source",
    params={"provider": "vmware", "ip_stack": "ipv4"},
    test_id="test_id",
    project=MockProject(),
)
MOCK_RESULT_DICT = MOCK_RESULT.to_dict()
# the result to be POST'ed to Ibutsu, we expect it to transformed into MOCK_RESULT
ADDED_RESULT = MockResult(
    id=MOCK_RESULT_ID,
    duration=6.027456183070403,
    result="passed",
    data={
        "jenkins_build": 145,
        "commit_hash": "F4BA3E12",
        "user_properties": {"assignee": "jdoe", "component": "fake-component"},
        "project": "test-project",
    },
    start_time=str(START_TIME),
    source="source",
    params={"provider": "vmware", "ip_stack": "ipv4"},
    test_id="test_id",
    project=MockProject(),
)
UPDATED_RESULT = MockResult(
    id=MOCK_RESULT_ID,
    duration=6.027456183070403,
    result="failed",
    component="blah",
    data={
        "jenkins_build": 146,
        "commit_hash": "F4BA3E12",
        "assignee": "new_assignee",
        "component": "blah",
        "project": "test-project",
    },
    start_time=str(START_TIME),
    source="source_updated",
    params={"provider": "vmware", "ip_stack": "ipv4"},
    test_id="test_id_updated",
    project=MockProject(),
)


@pytest.fixture
def result_controller_mocks():
    """Mocks for the result controller tests"""
    with (
        patch("ibutsu_server.controllers.result_controller.session") as mock_session,
        patch(
            "ibutsu_server.controllers.result_controller.project_has_user"
        ) as mock_project_has_user,
        patch("ibutsu_server.controllers.result_controller.Result") as mock_result_class,
        patch(
            "ibutsu_server.controllers.result_controller.add_user_filter"
        ) as mock_add_user_filter,
    ):
        mock_project_has_user.return_value = True
        mock_result_class.return_value = MOCK_RESULT
        mock_result_class.query.get.return_value = MOCK_RESULT
        mock_result_class.from_dict.return_value = ADDED_RESULT
        mock_add_user_filter.return_value.count.return_value = 1
        mock_add_user_filter.return_value.get.return_value = MOCK_RESULT

        yield {
            "session": mock_session,
            "project_has_user": mock_project_has_user,
            "result_class": mock_result_class,
            "add_user_filter": mock_add_user_filter,
        }


def test_add_result(flask_app, result_controller_mocks):
    """Test case for add_result"""
    client, jwt_token = flask_app
    mocks = result_controller_mocks
    result = ADDED_RESULT.to_dict()
    mocks["result_class"].query.get.return_value = None
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/result",
        method="POST",
        headers=headers,
        data=json.dumps(result),
        content_type="application/json",
    )
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"
    assert response.json == MOCK_RESULT_DICT


def test_get_result(flask_app, result_controller_mocks):
    """Test case for get_result"""
    client, jwt_token = flask_app
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(f"/api/result/{MOCK_RESULT_ID}", method="GET", headers=headers)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    assert response.json == MOCK_RESULT_DICT


def test_get_result_list(flask_app, result_controller_mocks):
    """Test case for get_result_list"""
    client, jwt_token = flask_app
    mocks = result_controller_mocks
    mock_all = MagicMock(return_value=[MOCK_RESULT])
    mock_filter = MagicMock()
    mock_filter.order_by.return_value.offset.return_value.limit.return_value.all = mock_all
    mock_filter.count.return_value = 1
    mocks["add_user_filter"].return_value.filter.return_value = mock_filter
    query_string = [
        ("filter", "metadata.component=frontend"),
        ("page", 56),
        ("pageSize", 56),
    ]
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open("/api/result", method="GET", headers=headers, query_string=query_string)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    expected_response = {
        "pagination": {
            "page": 56,
            "pageSize": 56,
            "totalItems": 1,
            "totalPages": 1,
        },
        "results": [MOCK_RESULT_DICT],
    }
    assert response.json == expected_response


def test_update_result(flask_app, result_controller_mocks):
    """Test case for update_result"""
    client, jwt_token = flask_app
    result = {
        "result": "failed",
        "metadata": {
            "jenkins_build": 146,
            "commit_hash": "F4BA3E12",
            "user_properties": {"assignee": "new_assignee", "component": "blah"},
        },
        "source": "source_updated",
        "test_id": "test_id_updated",
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/result/{MOCK_RESULT_ID}",
        method="PUT",
        headers=headers,
        data=json.dumps(result),
        content_type="application/json",
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    assert response.json == UPDATED_RESULT.to_dict()
