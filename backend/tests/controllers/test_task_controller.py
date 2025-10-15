from http import HTTPStatus
from unittest.mock import MagicMock, patch

import pytest

from tests.conftest import MOCK_TASK_ID


@pytest.fixture
def task_controller_mocks():
    """Mocks for the task controller tests"""
    with patch("ibutsu_server.controllers.task_controller.get_celery_app") as mock_get_celery_app:
        mock_celery_app = MagicMock()
        mock_async_result = MagicMock()
        mock_async_result.state = "PENDING"
        mock_async_result.info = {}
        mock_celery_app.AsyncResult.return_value = mock_async_result
        mock_get_celery_app.return_value = mock_celery_app
        yield {"get_celery_app": mock_get_celery_app, "async_result": mock_async_result}


def test_get_task_states(flask_app, task_controller_mocks):
    """Test case for get_task with SUCCESS state"""
    client, jwt_token = flask_app
    mocks = task_controller_mocks
    task_state = "SUCCESS"
    expected_status = HTTPStatus.OK
    expected_message = "Task has succeeded"

    mocks["async_result"].state = task_state
    mocks["async_result"].get.return_value = {"result": "success_data"}

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/task/{MOCK_TASK_ID}",
        method="GET",
        headers=headers,
    )

    # Verify AsyncResult was called with correct parameters
    args, kwargs = mocks["async_result_class"].call_args
    assert args[0] == MOCK_TASK_ID
    assert kwargs["app"] == mocks["celery_app"]

    # Verify response status
    assert response.status_code == expected_status

    # Verify response content
    response_data = response.get_json()
    assert response_data["state"] == task_state
    assert response_data["message"] == expected_message
    assert "result" in response_data
    assert response_data["result"] == "success_data"


def test_get_task_success_with_no_result(flask_app, task_controller_mocks):
    """Test case for get_task - SUCCESS state with no result data"""
    client, jwt_token = flask_app
    mocks = task_controller_mocks
    mocks["async_result"].state = "SUCCESS"
    mocks["async_result"].get.return_value = None

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/task/{MOCK_TASK_ID}",
        method="GET",
        headers=headers,
    )

    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["state"] == "SUCCESS"
    assert response_data["message"] == "Task has succeeded"
    # Should not have result key when get() returns None
    assert "result" not in response_data


def test_get_task_success_with_complex_result(flask_app, task_controller_mocks):
    """Test case for get_task - SUCCESS state with complex result data"""
    client, jwt_token = flask_app
    mocks = task_controller_mocks
    complex_result = {
        "processed_items": 100,
        "errors": [],
        "summary": {"total": 100, "success": 95, "failed": 5},
    }
    mocks["async_result"].state = "SUCCESS"
    mocks["async_result"].get.return_value = complex_result

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/task/{MOCK_TASK_ID}",
        method="GET",
        headers=headers,
    )

    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["state"] == "SUCCESS"
    assert response_data["processed_items"] == 100
    assert response_data["summary"]["total"] == 100


def test_get_task_unknown_state(flask_app, task_controller_mocks):
    """Test case for get_task - unknown/unmapped task state"""
    client, jwt_token = flask_app
    mocks = task_controller_mocks
    mocks["async_result"].state = "UNKNOWN_STATE"
    mocks["async_result"].traceback = "Unknown error occurred"

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/task/{MOCK_TASK_ID}",
        method="GET",
        headers=headers,
    )

    # Unknown states should default to None in the mapping,
    # which should still return a response
    response_data = response.get_json()
    assert response_data["state"] == "UNKNOWN_STATE"
    assert response_data["message"] == "Task has failed!"
    assert "error" in response_data


def test_get_task_invalid_uuid(flask_app, task_controller_mocks):
    """Test case for get_task - invalid UUID format"""
    client, jwt_token = flask_app
    invalid_id = "not-a-valid-uuid"
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/task/{invalid_id}",
        method="GET",
        headers=headers,
    )

    # The @validate_uuid decorator should handle this
    # Expecting a 400 Bad Request for invalid UUID
    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"


@patch("ibutsu_server.get_app")
def test_get_task_started_state(mock_get_app, flask_app, task_controller_mocks):
    """Test case for get_task - STARTED state"""
    client, jwt_token = flask_app
    mocks = task_controller_mocks
    mock_app = MagicMock()
    mock_get_app.return_value = mock_app
    mocks["async_result"].state = "STARTED"

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }

    response = client.open(
        f"/api/task/{MOCK_TASK_ID}",
        method="GET",
        headers=headers,
    )

    assert response.status_code == HTTPStatus.PARTIAL_CONTENT.value
    response_data = response.get_json()
    assert response_data["state"] == "STARTED"
    assert response_data["message"] == "Task has started but is still running, check back later"


def test_get_task_multiple_calls_same_id(flask_app, task_controller_mocks):
    """Test case for get_task - multiple calls with same task ID"""
    client, jwt_token = flask_app
    mocks = task_controller_mocks
    mocks["async_result"].state = "STARTED"

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }

    # Make multiple calls
    for _ in range(3):
        response = client.open(
            f"/api/task/{MOCK_TASK_ID}",
            method="GET",
            headers=headers,
        )
        assert response.status_code == HTTPStatus.PARTIAL_CONTENT.value

    # Verify AsyncResult was created each time
    assert mocks["async_result_class"].call_count == 3
