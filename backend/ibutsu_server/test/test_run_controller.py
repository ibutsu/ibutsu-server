# coding: utf-8
from __future__ import absolute_import

from datetime import datetime
from unittest import skip
from unittest.mock import MagicMock
from unittest.mock import patch

from flask import json
from ibutsu_server.test import BaseTestCase
from ibutsu_server.test import MockRun
from six import BytesIO

MOCK_ID = "6b26876f-bcd9-49f3-b5bd-35f895a345d1"
START_TIME = datetime.utcnow()
MOCK_RUN = MockRun(
    id=MOCK_ID,
    summary={"errors": 1, "failures": 3, "skips": 0, "tests": 548},
    duration=540.05433,
    data={"component": "test-component", "env": "local"},
    env="local",
    component="test-component",
    start_time=str(START_TIME),
    created=str(START_TIME),
)
MOCK_RUN_DICT = MOCK_RUN.to_dict()


class TestRunController(BaseTestCase):
    """RunController integration test stubs"""

    def setUp(self):
        """Set up a fake MongoDB object"""
        self.mock_limit = MagicMock()
        self.mock_limit.return_value.offset.return_value.all.return_value = [MOCK_RUN]
        self.session_patcher = patch("ibutsu_server.controllers.run_controller.session")
        self.mock_session = self.session_patcher.start()
        self.project_has_user_patcher = patch(
            "ibutsu_server.controllers.run_controller.project_has_user"
        )
        self.mock_project_has_user = self.project_has_user_patcher.start()
        self.mock_project_has_user.return_value = True
        self.run_patcher = patch("ibutsu_server.controllers.run_controller.Run")
        self.mock_run = self.run_patcher.start()
        self.mock_run.query.get.return_value = MOCK_RUN
        self.mock_run.from_dict.return_value = MOCK_RUN
        self.add_user_filter_patcher = patch(
            "ibutsu_server.controllers.run_controller.add_user_filter"
        )
        self.mock_add_user_filter = self.add_user_filter_patcher.start()
        self.mock_add_user_filter.return_value.count.return_value = 1
        self.mock_add_user_filter.return_value.limit = self.mock_limit
        self.task_patcher = patch("ibutsu_server.controllers.run_controller.update_run_task")
        self.mock_update_run_task = self.task_patcher.start()

    def tearDown(self):
        """Teardown the mocks"""
        self.task_patcher.stop()
        self.add_user_filter_patcher.stop()
        self.run_patcher.stop()
        self.project_has_user_patcher.stop()
        self.session_patcher.stop()

    def test_add_run(self):
        """Test case for add_run

        Create a run
        """
        run_dict = {
            "summary": {"errors": 1, "failures": 3, "skips": 0, "tests": 548},
            "duration": 540.05433,
            "metadata": {"component": "test-component", "env": "local"},
            "start_time": START_TIME,
            "created": START_TIME,
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/run",
            method="POST",
            headers=headers,
            data=json.dumps(run_dict),
            content_type="application/json",
        )
        self.mock_update_run_task.apply_async.assert_called_once_with((MOCK_ID,), countdown=5)
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))
        self.assert_equal(response.json, MOCK_RUN_DICT)

    def test_get_run(self):
        """Test case for get_run

        Get a single run by ID
        """
        headers = {"Accept": "application/json", "Authorization": f"Bearer {self.jwt_token}"}
        response = self.client.open(
            "/api/run/{id}".format(id=MOCK_ID), method="GET", headers=headers
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        self.assert_equal(response.json, MOCK_RUN_DICT)

    def test_get_run_list(self):
        """Test case for get_run_list

        Get a list of the test runs
        """
        query_string = [("page", 56), ("pageSize", 56)]
        headers = {"Accept": "application/json", "Authorization": f"Bearer {self.jwt_token}"}
        response = self.client.open(
            "/api/run", method="GET", headers=headers, query_string=query_string
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    @skip("multipart/form-data not supported by Connexion")
    def test_import_run(self):
        """Test case for import_run

        Import a JUnit XML file
        """
        headers = {
            "Accept": "application/json",
            "Content-Type": "multipart/form-data",
            "Authorization": f"Bearer {self.jwt_token}",
        }
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
        run_dict = {
            "duration": 540.05433,
            "summary": {"errors": 1, "failures": 3, "skips": 0, "tests": 548},
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/run/{id}".format(id=MOCK_ID),
            method="PUT",
            headers=headers,
            data=json.dumps(run_dict),
            content_type="application/json",
        )
        self.mock_update_run_task.apply_async.assert_called_once_with((MOCK_ID,), countdown=5)
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        self.assert_equal(response.json, MOCK_RUN_DICT)
