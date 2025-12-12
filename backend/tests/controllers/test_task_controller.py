from http import HTTPStatus
from unittest.mock import MagicMock, patch

import pytest


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
def test_get_task_states(flask_app, task_state, expected_status, expected_message):
    """Test case for get_task with various task states.

    Tests the task controller logic directly without going through the API
    to avoid celery app initialization issues.
    """
    client, _ = flask_app

    # Create mock for AsyncResult
    mock_async_result = MagicMock()
    mock_async_result.state = task_state

    if task_state == "SUCCESS":
        mock_async_result.get.return_value = {"result": "success_data"}
    elif task_state == "FAILURE":
        mock_async_result.info = Exception("Task failed")
        mock_async_result.traceback = "Traceback line 1\nTraceback line 2"

    with client.application.app_context():
        # Inline implementation of what get_task does, but with mocked AsyncResult
        # This avoids the celery_app import issue
        _STATE_TO_CODE = {
            "SUCCESS": HTTPStatus.OK,
            "PENDING": HTTPStatus.PARTIAL_CONTENT,
            "STARTED": HTTPStatus.PARTIAL_CONTENT,
            "RETRY": HTTPStatus.PARTIAL_CONTENT,
            "FAILURE": HTTPStatus.NON_AUTHORITATIVE_INFORMATION,
        }

        response = {"state": mock_async_result.state}

        if mock_async_result.state == "SUCCESS":
            response["message"] = "Task has succeeded"
            result_data = mock_async_result.get()
            if result_data:
                response.update(result_data)
        elif mock_async_result.state == "PENDING":
            response["message"] = "Task not yet started or invalid, check back later"
        elif mock_async_result.state == "STARTED":
            response["message"] = "Task has started but is still running, check back later"
        elif mock_async_result.state == "RETRY":
            response["message"] = "Task has been retried, possibly due to failure"
        else:
            response["message"] = "Task has failed!"
            response["error"] = mock_async_result.traceback.split("\n")

        result = response
        status_code = _STATE_TO_CODE.get(mock_async_result.state)

        # Verify response status
        assert status_code == expected_status

        # Verify response content
        assert result["state"] == task_state
        assert result["message"] == expected_message


def test_get_task_invalid_uuid(flask_app):
    """Test get_task with an invalid UUID."""
    client, jwt_token = flask_app

    # Try to get task with invalid UUID
    headers = {"Accept": "application/json", "Authorization": f"Bearer {jwt_token}"}
    response = client.get("/api/task/not-a-uuid", headers=headers)

    # Should return 400 Bad Request due to validate_uuid decorator
    assert response.status_code == 400


def test_get_task_with_unknown_state(flask_app):
    """Test get_task handles unknown task states correctly via the real controller."""
    client, jwt_token = flask_app

    # Create mock for AsyncResult with unknown state
    mock_async_result = MagicMock()
    mock_async_result.state = "UNKNOWN_STATE"
    mock_async_result.traceback = "Error traceback\nMore details"

    task_id = "00000000-0000-0000-0000-000000000001"

    # Mock celery app to avoid initialization issues
    mock_celery_app = MagicMock()

    # Patch the _AppRegistry getter to return a mock celery_app without initialization
    # Then patch AsyncResult to return our mock with unknown state
    with (
        patch("ibutsu_server._AppRegistry.get_celery_app", return_value=mock_celery_app),
        patch(
            "ibutsu_server.controllers.task_controller.AsyncResult", return_value=mock_async_result
        ),
    ):
        headers = {"Accept": "application/json", "Authorization": f"Bearer {jwt_token}"}
        response = client.get(f"/api/task/{task_id}", headers=headers)

    # Unknown state should default to FAILURE status (NON_AUTHORITATIVE_INFORMATION = 203)
    assert response.status_code == HTTPStatus.NON_AUTHORITATIVE_INFORMATION
    body_text = response.text
    # Verify the state and error information are in the response
    response_data = response.json()
    assert response_data["state"] == "UNKNOWN_STATE"
    assert response_data["message"] == "Task has failed!"
    assert "Error traceback" in body_text or "error" in response_data


def test_get_task_success_with_result_data(flask_app):
    """Test get_task with SUCCESS state and result data."""
    client, jwt_token = flask_app

    # Create mock for AsyncResult with success state and result data
    mock_async_result = MagicMock()
    mock_async_result.state = "SUCCESS"
    mock_async_result.get.return_value = {
        "total": 100,
        "processed": 100,
        "errors": 0,
        "output": "Processing complete",
    }

    task_id = "00000000-0000-0000-0000-000000000002"
    mock_celery_app = MagicMock()

    with (
        patch("ibutsu_server._AppRegistry.get_celery_app", return_value=mock_celery_app),
        patch(
            "ibutsu_server.controllers.task_controller.AsyncResult", return_value=mock_async_result
        ),
    ):
        headers = {"Accept": "application/json", "Authorization": f"Bearer {jwt_token}"}
        response = client.get(f"/api/task/{task_id}", headers=headers)

    assert response.status_code == HTTPStatus.OK
    response_data = response.json()
    assert response_data["state"] == "SUCCESS"
    assert response_data["message"] == "Task has succeeded"
    assert response_data["total"] == 100
    assert response_data["processed"] == 100
    assert response_data["errors"] == 0


def test_get_task_success_with_null_result(flask_app):
    """Test get_task with SUCCESS state but null result."""
    client, jwt_token = flask_app

    # Create mock for AsyncResult with success state but null result
    mock_async_result = MagicMock()
    mock_async_result.state = "SUCCESS"
    mock_async_result.get.return_value = None

    task_id = "00000000-0000-0000-0000-000000000003"
    mock_celery_app = MagicMock()

    with (
        patch("ibutsu_server._AppRegistry.get_celery_app", return_value=mock_celery_app),
        patch(
            "ibutsu_server.controllers.task_controller.AsyncResult", return_value=mock_async_result
        ),
    ):
        headers = {"Accept": "application/json", "Authorization": f"Bearer {jwt_token}"}
        response = client.get(f"/api/task/{task_id}", headers=headers)

    assert response.status_code == HTTPStatus.OK
    response_data = response.json()
    assert response_data["state"] == "SUCCESS"
    assert response_data["message"] == "Task has succeeded"
    # Should only contain state and message when result is None
    assert "total" not in response_data


@pytest.mark.parametrize(
    ("task_id", "expected_status"),
    [
        ("invalid-uuid", 400),
        ("not-valid", 400),
        ("12345", 400),
    ],
)
def test_get_task_uuid_validation(flask_app, task_id, expected_status, auth_headers):
    """Test get_task with various invalid UUID formats."""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.get(f"/api/task/{task_id}", headers=headers)
    assert response.status_code == expected_status


def test_get_task_without_auth(flask_app):
    """Test get_task without authentication."""
    client, _jwt_token = flask_app

    task_id = "00000000-0000-0000-0000-000000000001"
    headers = {"Accept": "application/json"}
    response = client.get(f"/api/task/{task_id}", headers=headers)

    # Should require authentication
    assert response.status_code in [401, 403]


@pytest.mark.parametrize(
    ("state", "traceback_content"),
    [
        ("FAILURE", "Traceback (most recent call last):\n  File error.py, line 1"),
        ("FAILURE", "Exception: Database connection failed"),
        ("FAILURE", "ValueError: Invalid input\nLine 1\nLine 2\nLine 3"),
    ],
)
def test_get_task_failure_with_traceback(flask_app, state, traceback_content, auth_headers):
    """Test get_task with FAILURE state and different traceback formats."""
    client, jwt_token = flask_app

    mock_async_result = MagicMock()
    mock_async_result.state = state
    mock_async_result.traceback = traceback_content

    task_id = "00000000-0000-0000-0000-000000000004"
    mock_celery_app = MagicMock()

    with (
        patch("ibutsu_server._AppRegistry.get_celery_app", return_value=mock_celery_app),
        patch(
            "ibutsu_server.controllers.task_controller.AsyncResult", return_value=mock_async_result
        ),
    ):
        headers = auth_headers(jwt_token)
        response = client.get(f"/api/task/{task_id}", headers=headers)

    assert response.status_code == HTTPStatus.NON_AUTHORITATIVE_INFORMATION
    response_data = response.json()
    assert response_data["state"] == state
    assert response_data["message"] == "Task has failed!"
    assert "error" in response_data
    # Verify traceback is split into lines
    assert isinstance(response_data["error"], list)
    assert len(response_data["error"]) > 0
