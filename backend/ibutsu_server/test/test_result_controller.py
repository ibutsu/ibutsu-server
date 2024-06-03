from datetime import datetime
from unittest.mock import MagicMock, patch

from flask import json

from ibutsu_server.test import BaseTestCase, MockProject, MockResult

MOCK_ID = "99fba7d2-4d32-4b9b-b07f-4200c9717661"
START_TIME = datetime.utcnow()
MOCK_RESULT = MockResult(
    id=MOCK_ID,
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
    id=MOCK_ID,
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
    id=MOCK_ID,
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


class TestResultController(BaseTestCase):
    """ResultController integration test stubs"""

    def setUp(self):
        """Set up a fake MongoDB object"""
        self.session_patcher = patch("ibutsu_server.controllers.result_controller.session")
        self.mock_session = self.session_patcher.start()
        self.project_has_user_patcher = patch(
            "ibutsu_server.controllers.result_controller.project_has_user"
        )
        self.mock_project_has_user = self.project_has_user_patcher.start()
        self.mock_project_has_user.return_value = True
        self.result_patcher = patch("ibutsu_server.controllers.result_controller.Result")
        self.mock_result = self.result_patcher.start()
        self.mock_result.return_value = MOCK_RESULT
        self.mock_result.query.get.return_value = MOCK_RESULT
        self.mock_result.from_dict.return_value = ADDED_RESULT
        self.add_user_filter_patcher = patch(
            "ibutsu_server.controllers.result_controller.add_user_filter"
        )
        self.mock_add_user_filter = self.add_user_filter_patcher.start()
        self.mock_add_user_filter.return_value.count.return_value = 1
        self.mock_add_user_filter.return_value.get.return_value = MOCK_RESULT

    def tearDown(self):
        """Teardown the mocks"""
        self.add_user_filter_patcher.stop()
        self.result_patcher.stop()
        self.project_has_user_patcher.stop()
        self.session_patcher.stop()

    def test_add_result(self):
        """Test case for add_result

        Create a test result
        """
        result = ADDED_RESULT.to_dict()
        self.mock_result.query.get.return_value = None
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/result",
            method="POST",
            headers=headers,
            data=json.dumps(result),
            content_type="application/json",
        )
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == MOCK_RESULT_DICT

    def test_get_result(self):
        """Test case for get_result

        Get a single result
        """
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(f"/api/result/{MOCK_ID}", method="GET", headers=headers)
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == MOCK_RESULT_DICT

    def test_get_result_list(self):
        """Test case for get_result_list

        Get the list of results.
        """
        mock_all = MagicMock(return_value=[MOCK_RESULT])
        mock_filter = MagicMock()
        mock_filter.order_by.return_value.offset.return_value.limit.return_value.all = mock_all
        mock_filter.count.return_value = 1
        self.mock_add_user_filter.return_value.filter.return_value = mock_filter
        query_string = [
            ("filter", "metadata.component=frontend"),
            ("page", 56),
            ("pageSize", 56),
        ]
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/result", method="GET", headers=headers, query_string=query_string
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
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

    def test_update_result(self):
        """Test case for update_result

        Updates a single result
        """
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
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/result/{MOCK_ID}",
            method="PUT",
            headers=headers,
            data=json.dumps(result),
            content_type="application/json",
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == UPDATED_RESULT.to_dict()
