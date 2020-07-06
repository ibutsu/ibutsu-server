# coding: utf-8
from __future__ import absolute_import

from unittest.mock import MagicMock
from unittest.mock import patch

from bson import ObjectId
from flask import json
from ibutsu_server.test import BaseTestCase

MOCK_ID = "cd7994f77bcf8639011507f1"
MOCK_GROUP = {"_id": ObjectId(MOCK_ID), "id": MOCK_ID, "name": "Example group"}


class TestGroupController(BaseTestCase):
    """GroupController integration test stubs"""

    def setUp(self):
        """Set up a fake MongoDB object"""
        self.mongo_patcher = patch("ibutsu_server.controllers.group_controller.mongo")
        self.mock_mongo = self.mongo_patcher.start()
        self.mock_mongo.groups = MagicMock()
        self.mock_mongo.groups.count.return_value = 1
        self.mock_mongo.groups.find_one.return_value = MOCK_GROUP
        self.mock_mongo.groups.find.return_value = [MOCK_GROUP]

    def tearDown(self):
        """Teardown the mocks"""
        self.mongo_patcher.stop()

    def test_add_group(self):
        """Test case for add_group

        Create a new group
        """
        group = {"id": "af3b3ff0c6188c9ba767", "name": "Example group"}
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        response = self.client.open(
            "/api/group",
            method="POST",
            headers=headers,
            data=json.dumps(group),
            content_type="application/json",
        )
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_group(self):
        """Test case for get_group

        Get a group
        """
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/group/{id}".format(id=MOCK_ID), method="GET", headers=headers
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_group_list(self):
        """Test case for get_group_list

        Get a list of groups
        """
        query_string = [("page", 56), ("pageSize", 56)]
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/group", method="GET", headers=headers, query_string=query_string
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_update_group(self):
        """Test case for update_group

        Update a group
        """
        group = {"id": "af3b3ff0c6188c9ba767", "name": "Example group"}
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        response = self.client.open(
            "/api/group/{id}".format(id=MOCK_ID),
            method="PUT",
            headers=headers,
            data=json.dumps(group),
            content_type="application/json",
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
