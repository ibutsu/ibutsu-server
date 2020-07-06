# coding: utf-8
from __future__ import absolute_import

from unittest.mock import MagicMock
from unittest.mock import patch

from bson import ObjectId
from flask import json
from ibutsu_server.test import BaseTestCase

MOCK_ID = "5d9230bb10b3f82ce80760fd"
MOCK_RESULT = {
    "_id": ObjectId(MOCK_ID),
    "id": MOCK_ID,
    "duration": 6.027456183070403,
    "result": "passed",
    "metadata": {"jenkins_build": 145, "commit_hash": "F4BA3E12"},
    "start_time": 0.8008281904610115,
    "source": "source",
    "params": {"provider": "vmware", "ip_stack": "ipv4"},
    "test_id": "test_id",
}


class TestResultController(BaseTestCase):
    """ResultController integration test stubs"""

    def setUp(self):
        """Set up a fake MongoDB object"""
        self.mongo_patcher = patch("ibutsu_server.controllers.result_controller.mongo")
        self.mock_mongo = self.mongo_patcher.start()
        self.mock_mongo.results = MagicMock()
        self.mock_mongo.results.count.return_value = 1
        self.mock_mongo.results.find_one.return_value = MOCK_RESULT
        self.mock_mongo.results.find.return_value = [MOCK_RESULT]

    def tearDown(self):
        """Teardown the mocks"""
        self.mongo_patcher.stop()

    def test_add_result(self):
        """Test case for add_result

        Create a test result
        """
        result = {
            "duration": 6.027456183070403,
            "result": "passed",
            "metadata": {"jenkins_build": 145, "commit_hash": "F4BA3E12"},
            "start_time": 0.8008281904610115,
            "source": "source",
            "params": {"provider": "vmware", "ip_stack": "ipv4"},
            "test_id": "test_id",
        }

        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        response = self.client.open(
            "/api/result",
            method="POST",
            headers=headers,
            data=json.dumps(result),
            content_type="application/json",
        )
        json_dict = response.json
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))
        for key, value in result.items():
            assert key in json_dict, "{key} should be in the output".format(key=key)
            assert value == json_dict[key], "Value should be the same."
        response_keys = list(json_dict.keys())
        if "id" in response_keys:
            response_keys.remove("id")
        if "_id" in response_keys:
            response_keys.remove("_id")
        assert set(response_keys) - set(result.keys()) == set()

    def test_get_result(self):
        """Test case for get_result

        Get a single result
        """
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/result/{id}".format(id="5d9230bb10b3f82ce80760fd"), method="GET", headers=headers
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_result_list(self):
        """Test case for get_result_list

        Get the list of results.
        """
        query_string = [("filter", "filter_example"), ("page", 56), ("pageSize", 56)]
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/result", method="GET", headers=headers, query_string=query_string
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_update_result(self):
        """Test case for update_result

        Updates a single result
        """
        result = {
            "duration": 6.027456183070403,
            "result": "passed",
            "metadata": {"jenkins_build": 145, "commit_hash": "F4BA3E12"},
            "start_time": 0.8008281904610115,
            "source": "source",
            "params": {"provider": "vmware", "ip_stack": "ipv4"},
            "test_id": "test_id",
        }
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        response = self.client.open(
            "/api/result/{id}".format(id="5d9230bb10b3f82ce80760fd"),
            method="PUT",
            headers=headers,
            data=json.dumps(result),
            content_type="application/json",
        )
        json_dict = response.json
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        response_keys = list(json_dict.keys())
        """Issue here with
        type error.
        """
        if "id" in response_keys:
            response_keys.remove("id")
        if "_id" in response_keys:
            response_keys.remove("_id")
        assert set(response_keys) - set(result.keys()) == set()
