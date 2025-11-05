from http import HTTPStatus
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture(autouse=False)
def task_controller_mocks():
    """Mocks for Celery external service only"""
    with (
        patch("ibutsu_server.controllers.task_controller._get_celery_app") as mock_get_celery_app,
        patch("ibutsu_server.controllers.task_controller.AsyncResult") as mock_async_result_class,
    ):
        mock_celery_app = MagicMock()
        mock_async_result = MagicMock()
        mock_async_result.state = "PENDING"
        mock_async_result.info = {}
        mock_async_result_class.return_value = mock_async_result
        mock_get_celery_app.return_value = mock_celery_app

        # Reset mock call counts before each test
        mock_get_celery_app.reset_mock()
        mock_async_result_class.reset_mock()

        yield {
            "get_celery_app": mock_get_celery_app,
            "async_result": mock_async_result,
            "async_result_class": mock_async_result_class,
        }


@pytest.mark.parametrize(
    ("task_state", "expected_status", "expected_message"),
    [
        ("SUCCESS", HTTPStatus.OK, "Task has succeeded"),
        (
            "PENDING",
            HTTPStatus.PARTIAL_CONTENT,
            "Task not yet started or invalid, check back later",
        ),
        (
            "STARTED",
            HTTPStatus.PARTIAL_CONTENT,
            "Task has started but is still running, check back later",
        ),
        ("RETRY", HTTPStatus.PARTIAL_CONTENT, "Task has been retried, possibly due to failure"),
        ("FAILURE", HTTPStatus.NON_AUTHORITATIVE_INFORMATION, "Task has failed!"),
    ],
)
def test_get_task_states(
    flask_app, task_controller_mocks, task_state, expected_status, expected_message
):
    """Test case for get_task with various task states"""
    client, jwt_token = flask_app
    mocks = task_controller_mocks

    task_id = "12345678-1234-1234-1234-123456789abc"
    mocks["async_result"].state = task_state

    if task_state == "SUCCESS":
        mocks["async_result"].get.return_value = {"result": "success_data"}
    elif task_state == "FAILURE":
        mocks["async_result"].info = Exception("Task failed")
        mocks["async_result"].traceback = "Traceback line 1\nTraceback line 2"

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        f"/api/task/{task_id}",
        headers=headers,
    )

    # Verify AsyncResult was called with correct parameters
    mocks["async_result_class"].assert_called_once_with(
        task_id, app=mocks["get_celery_app"].return_value
    )

    # Verify response status
    assert response.status_code == expected_status

    # Verify response content
    response_data = response.get_json()
    assert response_data["state"] == task_state
    assert response_data["message"] == expected_message


def test_get_task_success_with_no_result(flask_app, task_controller_mocks):
    """Test case for get_task - SUCCESS state with no result data"""
    client, jwt_token = flask_app
    mocks = task_controller_mocks

    task_id = "12345678-1234-1234-1234-456456456456"
    mocks["async_result"].state = "SUCCESS"
    mocks["async_result"].get.return_value = None

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        f"/api/task/{task_id}",
        headers=headers,
    )
    assert response.status_code == HTTPStatus.OK

    response_data = response.get_json()
    assert response_data["state"] == "SUCCESS"
    # Should have message but no result data
    assert "message" in response_data


def test_get_task_pending(flask_app, task_controller_mocks):
    """Test case for get_task - PENDING state"""
    client, jwt_token = flask_app
    mocks = task_controller_mocks

    task_id = "12345678-1234-1234-1234-789789789789"
    mocks["async_result"].state = "PENDING"

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        f"/api/task/{task_id}",
        headers=headers,
    )
    assert response.status_code == HTTPStatus.PARTIAL_CONTENT

    response_data = response.get_json()
    assert response_data["state"] == "PENDING"


def test_get_task_failure(flask_app, task_controller_mocks):
    """Test case for get_task - FAILURE state"""
    client, jwt_token = flask_app
    mocks = task_controller_mocks

    task_id = "12345678-1234-1234-1234-eeee00011122"
    mocks["async_result"].state = "FAILURE"
    mocks["async_result"].info = Exception("Something went wrong")
    mocks["async_result"].traceback = "Error traceback\nMore error details"

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        f"/api/task/{task_id}",
        headers=headers,
    )
    assert response.status_code == HTTPStatus.NON_AUTHORITATIVE_INFORMATION

    response_data = response.get_json()
    assert response_data["state"] == "FAILURE"
    assert response_data["message"] == "Task has failed!"
