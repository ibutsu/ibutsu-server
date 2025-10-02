from http import HTTPStatus
from unittest.mock import MagicMock, patch

from ibutsu_server.test import BaseTestCase

MOCK_TASK_ID = "70202589-4781-4eb9-bcfc-685b1d2c583a"


class TestTaskController(BaseTestCase):
    """TaskController integration test stubs"""

    def setUp(self):
        """Set up mocks for task controller tests"""
        # Mock the _get_celery_app function to return a mock app
        self.celery_app_patcher = patch("ibutsu_server.controllers.task_controller._get_celery_app")
        self.mock_get_celery_app = self.celery_app_patcher.start()
        self.mock_celery_app = MagicMock()
        self.mock_get_celery_app.return_value = self.mock_celery_app

        self.async_result_patcher = patch("ibutsu_server.controllers.task_controller.AsyncResult")
        self.mock_async_result_class = self.async_result_patcher.start()

        # Create a mock AsyncResult instance
        self.mock_async_result = MagicMock()
        self.mock_async_result_class.return_value = self.mock_async_result

    def tearDown(self):
        """Teardown the mocks"""
        self.async_result_patcher.stop()
        self.celery_app_patcher.stop()

    def test_get_task_states(self):
        """Test case for get_task with SUCCESS state"""
        task_state = "SUCCESS"
        expected_status = HTTPStatus.OK
        expected_message = "Task has succeeded"

        self.mock_async_result.state = task_state
        self.mock_async_result.get.return_value = {"result": "success_data"}

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/task/{MOCK_TASK_ID}",
            method="GET",
            headers=headers,
        )

        # Verify AsyncResult was called with correct parameters
        args, kwargs = self.mock_async_result_class.call_args
        assert args[0] == MOCK_TASK_ID
        assert kwargs["app"] == self.mock_celery_app

        # Verify response status
        assert response.status_code == expected_status

        # Verify response content
        response_data = response.get_json()
        assert response_data["state"] == task_state
        assert response_data["message"] == expected_message
        assert "result" in response_data
        assert response_data["result"] == "success_data"

    def test_get_task_success_with_no_result(self):
        """Test case for get_task - SUCCESS state with no result data"""
        self.mock_async_result.state = "SUCCESS"
        self.mock_async_result.get.return_value = None

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/task/{MOCK_TASK_ID}",
            method="GET",
            headers=headers,
        )

        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

        response_data = response.get_json()
        assert response_data["state"] == "SUCCESS"
        assert response_data["message"] == "Task has succeeded"
        # Should not have result key when get() returns None
        assert "result" not in response_data

    def test_get_task_success_with_complex_result(self):
        """Test case for get_task - SUCCESS state with complex result data"""
        complex_result = {
            "processed_items": 100,
            "errors": [],
            "summary": {"total": 100, "success": 95, "failed": 5},
        }
        self.mock_async_result.state = "SUCCESS"
        self.mock_async_result.get.return_value = complex_result

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/task/{MOCK_TASK_ID}",
            method="GET",
            headers=headers,
        )

        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

        response_data = response.get_json()
        assert response_data["state"] == "SUCCESS"
        assert response_data["processed_items"] == 100
        assert response_data["summary"]["total"] == 100

    def test_get_task_unknown_state(self):
        """Test case for get_task - unknown/unmapped task state"""
        self.mock_async_result.state = "UNKNOWN_STATE"
        self.mock_async_result.traceback = "Unknown error occurred"

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
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

    def test_get_task_invalid_uuid(self):
        """Test case for get_task - invalid UUID format"""
        invalid_id = "not-a-valid-uuid"
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/task/{invalid_id}",
            method="GET",
            headers=headers,
        )

        # The @validate_uuid decorator should handle this
        # Expecting a 400 Bad Request for invalid UUID
        self.assert_400(response, "Response body is : " + response.data.decode("utf-8"))

    @patch("ibutsu_server.get_app")
    def test_get_task_started_state(self, mock_get_app):
        """Test case for get_task - STARTED state"""
        mock_app = MagicMock()
        mock_get_app.return_value = mock_app
        self.mock_async_result.state = "STARTED"

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }

        response = self.client.open(
            f"/api/task/{MOCK_TASK_ID}",
            method="GET",
            headers=headers,
        )

        assert response.status_code == HTTPStatus.PARTIAL_CONTENT.value
        response_data = response.get_json()
        assert response_data["state"] == "STARTED"
        assert response_data["message"] == "Task has started but is still running, check back later"

    def test_get_task_multiple_calls_same_id(self):
        """Test case for get_task - multiple calls with same task ID"""
        self.mock_async_result.state = "STARTED"

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }

        # Make multiple calls
        for _ in range(3):
            response = self.client.open(
                f"/api/task/{MOCK_TASK_ID}",
                method="GET",
                headers=headers,
            )
            assert response.status_code == HTTPStatus.PARTIAL_CONTENT.value

        # Verify AsyncResult was created each time
        assert self.mock_async_result_class.call_count == 3
