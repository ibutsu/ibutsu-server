# coding: utf-8
from __future__ import absolute_import

from unittest import skip
from unittest.mock import MagicMock
from unittest.mock import patch

from bson import ObjectId
from flask import json
from ibutsu_server.test import BaseTestCase
from six import BytesIO

MOCK_ID = "cd7994f77bcf8639011507f1"
MOCK_RUN = {
    "_id": ObjectId(MOCK_ID),
    "id": MOCK_ID,
    "duration": 540.05433,
    "summary": {"errors": 1, "failures": 3, "skips": 0, "tests": 548},
}


class TestRunController(BaseTestCase):
    """RunController integration test stubs"""

    def setUp(self):
        """Set up a fake MongoDB object"""
        self.mongo_patcher = patch("ibutsu_server.controllers.run_controller.mongo")
        self.mock_mongo = self.mongo_patcher.start()
        self.mock_mongo.runs = MagicMock()
        self.mock_mongo.runs.count.return_value = 1
        self.mock_mongo.runs.find_one.return_value = MOCK_RUN
        self.mock_mongo.runs.find.return_value = [MOCK_RUN]
        self.task_patcher = patch("ibutsu_server.controllers.run_controller.update_run_task")
        self.mock_update_run_task = self.task_patcher.start()

    def tearDown(self):
        """Teardown the mocks"""
        self.mongo_patcher.stop()
        self.task_patcher.stop()

    def test_add_run(self):
        """Test case for add_run

        Create a run
        """
        run = {
            "id": "cd7994f77bcf8639011507f1",
            "duration": 540.05433,
            "summary": {"errors": 1, "failures": 3, "skips": 0, "tests": 548},
        }
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        response = self.client.open(
            "/api/run",
            method="POST",
            headers=headers,
            data=json.dumps(run),
            content_type="application/json",
        )
        self.mock_update_run_task.apply_async.assert_called_once_with((MOCK_ID,), countdown=5)
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_run(self):
        """Test case for get_run

        Get a single run by ID
        """
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/run/{id}".format(id="5d92316a10b3f82ce8076107"), method="GET", headers=headers
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_run_list(self):
        """Test case for get_run_list

        Get a list of the test runs
        """
        query_string = [("page", 56), ("pageSize", 56)]
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/run", method="GET", headers=headers, query_string=query_string
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    @skip("multipart/form-data not supported by Connexion")
    def test_import_run(self):
        """Test case for import_run

        Import a JUnit XML file
        """
        headers = {"Accept": "application/json", "Content-Type": "multipart/form-data"}
        data = dict(xml_file=(BytesIO(b"some file data"), "file.txt"))
        response = self.client.open(
            "/api/run/import",
            method="POST",
            headers=headers,
            data=data,
            content_type="multipart/form-data",
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_update_run(self):
        """Test case for update_run

        Update a single run
        """
        run = {
            "id": "cd7994f77bcf8639011507f1",
            "duration": 540.05433,
            "summary": {"errors": 1, "failures": 3, "skips": 0, "tests": 548},
        }
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        response = self.client.open(
            "/api/run/{id}".format(id="cd7994f77bcf8639011507f1"),
            method="PUT",
            headers=headers,
            data=json.dumps(run),
            content_type="application/json",
        )
        self.mock_update_run_task.delay.assert_called_once_with(MOCK_ID)
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
