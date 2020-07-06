# coding: utf-8
from __future__ import absolute_import

from unittest.mock import MagicMock
from unittest.mock import patch

from bson import ObjectId
from flask import json
from ibutsu_server.test import BaseTestCase

MOCK_ID = "86cd799439011507f1f77bcf"
MOCK_PROJECT = {
    "_id": ObjectId(MOCK_ID),
    "id": MOCK_ID,
    "name": "my-project",
    "title": "My Project",
    "ownerId": "6afedb7a8348eb4ebdbe0c77",
    "groupId": "7a8348eb4e6afedb0c77bdbe",
}


class TestProjectController(BaseTestCase):
    """ProjectController integration test stubs"""

    def setUp(self):
        """Set up a fake MongoDB object"""
        self.mongo_patcher = patch("ibutsu_server.controllers.project_controller.mongo")
        self.mock_mongo = self.mongo_patcher.start()
        self.mock_mongo.projects = MagicMock()
        self.mock_mongo.projects.count.return_value = 1
        self.mock_mongo.projects.find_one.return_value = MOCK_PROJECT
        self.mock_mongo.projects.find.return_value = [MOCK_PROJECT]

    def tearDown(self):
        """Teardown the mocks"""
        self.mongo_patcher.stop()

    def test_add_project(self):
        """Test case for add_project

        Create a project
        """
        project = {
            "id": "86cd799439011507f1f77bcf",
            "name": "my-project",
            "title": "My Project",
            "ownerId": "6afedb7a8348eb4ebdbe0c77",
            "groupId": "7a8348eb4e6afedb0c77bdbe",
        }
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        response = self.client.open(
            "/api/project",
            method="POST",
            headers=headers,
            data=json.dumps(project),
            content_type="application/json",
        )
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_project_by_id(self):
        """Test case for get_project

        Get a single project by ID
        """
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/project/{id}".format(id="5d9230bb10b3f82ce80760fd"), method="GET", headers=headers
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_project_by_name(self):
        """Test case for get_project

        Get a single project by name
        """
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/project/{id}".format(id="my-project"), method="GET", headers=headers
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_project_list(self):
        """Test case for get_project_list

        Get a list of projects
        """
        query_string = [
            ("ownerId", "owner_id_example"),
            ("groupId", "group_id_example"),
            ("page", 56),
            ("pageSize", 56),
        ]
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/project", method="GET", headers=headers, query_string=query_string
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_update_project(self):
        """Test case for update_project

        Update a project
        """
        project = {
            "id": "86cd799439011507f1f77bcf",
            "name": "my-project",
            "title": "My Project",
            "ownerId": "6afedb7a8348eb4ebdbe0c77",
            "groupId": "7a8348eb4e6afedb0c77bdbe",
        }
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        response = self.client.open(
            "/api/project/{id}".format(id="5d9230bb10b3f82ce80760fd"),
            method="PUT",
            headers=headers,
            data=json.dumps(project),
            content_type="application/json",
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
