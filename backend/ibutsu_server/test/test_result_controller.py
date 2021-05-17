# coding: utf-8
from __future__ import absolute_import

from datetime import datetime
from unittest.mock import MagicMock
from unittest.mock import patch

from flask import json
from ibutsu_server.test import BaseTestCase
from ibutsu_server.test import MockProject
from ibutsu_server.test import MockResult
from ibutsu_server.util.jwt import generate_token

MOCK_ID = "99fba7d2-4d32-4b9b-b07f-4200c9717661"
START_TIME = datetime.utcnow()
MOCK_RESULT = MockResult(
    id=MOCK_ID,
    duration=6.027456183070403,
    result="passed",
    data={"jenkins_build": 145, "commit_hash": "F4BA3E12"},
    start_time=str(START_TIME),
    source="source",
    params={"provider": "vmware", "ip_stack": "ipv4"},
    test_id="test_id",
    project=MockProject(),
)
MOCK_RESULT_DICT = MOCK_RESULT.to_dict()


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
        self.mock_result.from_dict.return_value = MOCK_RESULT
        self.mock_result.query.get.return_value = MOCK_RESULT
        self.jwt_token = generate_token("test-user")

    def tearDown(self):
        """Teardown the mocks"""
        self.result_patcher.stop()
        self.project_has_user_patcher.stop()
        self.session_patcher.stop()

    def test_add_result(self):
        """Test case for add_result

        Create a test result
        """
        result = {
            "duration": 6.027456183070403,
            "result": "passed",
            "metadata": {"jenkins_build": 145, "commit_hash": "F4BA3E12"},
            "start_time": START_TIME,
            "source": "source",
            "params": {"provider": "vmware", "ip_stack": "ipv4"},
            "test_id": "test_id",
        }
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
        headers = {"Accept": "application/json", "Authorization": f"Bearer {self.jwt_token}"}
        response = self.client.open(
            "/api/result/{id}".format(id=MOCK_ID), method="GET", headers=headers
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == MOCK_RESULT_DICT

    def test_get_result_list(self):
        """Test case for get_result_list

        Get the list of results.
        """
        mock_offset = MagicMock()
        mock_offset.return_value.limit.return_value.all.return_value = [MOCK_RESULT]
        self.mock_result.query.filter.return_value.order_by.return_value.offset = mock_offset
        self.mock_result.query.count.return_value = 1
        self.mock_result.query.filter.return_value.count.return_value = 1
        query_string = [("filter", "metadata.component=frontend"), ("page", 56), ("pageSize", 56)]
        headers = {"Accept": "application/json", "Authorization": f"Bearer {self.jwt_token}"}
        response = self.client.open(
            "/api/result", method="GET", headers=headers, query_string=query_string
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        expected_response = {
            "pagination": {"page": 56, "pageSize": 56, "totalItems": 1, "totalPages": 1},
            "results": [MOCK_RESULT_DICT],
        }
        assert response.json == expected_response

    def test_update_result(self):
        """Test case for update_result

        Updates a single result
        """
        result = {
            "duration": 6.027456183070403,
            "result": "passed",
            "metadata": {"jenkins_build": 145, "commit_hash": "F4BA3E12"},
            "source": "source",
            "params": {"provider": "vmware", "ip_stack": "ipv4"},
            "test_id": "test_id",
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/result/{id}".format(id=MOCK_ID),
            method="PUT",
            headers=headers,
            data=json.dumps(result),
            content_type="application/json",
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        MOCK_RESULT.update(result)
        assert response.json == MOCK_RESULT.to_dict()
