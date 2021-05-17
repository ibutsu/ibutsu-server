# coding: utf-8
from __future__ import absolute_import

from unittest.mock import MagicMock
from unittest.mock import patch

from flask import json
from ibutsu_server.test import BaseTestCase
from ibutsu_server.test import MockGroup
from ibutsu_server.util.jwt import generate_token

MOCK_ID = "c68506e2-202e-4193-a47d-33f1571d4b3e"
MOCK_GROUP = MockGroup(id=MOCK_ID, name="Example group", data={})
MOCK_GROUP_DICT = MOCK_GROUP.to_dict()
MOCK_LIST_RESPONSE = {"pagination": {"page": 0}, "groups": [MOCK_GROUP]}


class TestGroupController(BaseTestCase):
    """GroupController integration test stubs"""

    def setUp(self):
        """Set up a fake MongoDB object"""
        self.mock_limit = MagicMock()
        self.mock_limit.return_value.offset.return_value.all.return_value = [MOCK_GROUP]
        self.session_patcher = patch("ibutsu_server.controllers.group_controller.session")
        self.mock_session = self.session_patcher.start()
        self.group_patcher = patch("ibutsu_server.controllers.group_controller.Group")
        self.mock_group = self.group_patcher.start()
        self.mock_group.from_dict.return_value = MOCK_GROUP
        self.mock_group.query.count.return_value = 1
        self.mock_group.query.get.return_value = MOCK_GROUP
        self.mock_group.query.limit = self.mock_limit
        self.jwt_token = generate_token("test-user")

    def tearDown(self):
        """Teardown the mocks"""
        self.group_patcher.stop()
        self.session_patcher.stop()

    def test_add_group(self):
        """Test case for add_group

        Create a new group
        """
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/group",
            method="POST",
            headers=headers,
            data=json.dumps({"name": "Example group"}),
            content_type="application/json",
        )
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))
        self.assert_equal(response.json, MOCK_GROUP_DICT)

    def test_get_group(self):
        """Test case for get_group

        Get a group
        """
        headers = {"Accept": "application/json", "Authorization": f"Bearer {self.jwt_token}"}
        response = self.client.open(
            "/api/group/{id}".format(id=MOCK_ID), method="GET", headers=headers
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        self.assert_equal(response.json, MOCK_GROUP_DICT)

    def test_get_group_list(self):
        """Test case for get_group_list

        Get a list of groups
        """
        query_string = [("page", 56), ("pageSize", 56)]
        headers = {"Accept": "application/json", "Authorization": f"Bearer {self.jwt_token}"}
        response = self.client.open(
            "/api/group", method="GET", headers=headers, query_string=query_string
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        self.assert_equal(
            response.json,
            {
                "groups": [MOCK_GROUP_DICT],
                "pagination": {"page": 56, "pageSize": 56, "totalItems": 1, "totalPages": 1},
            },
        )

    def test_update_group(self):
        """Test case for update_group

        Update a group
        """
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/group/{id}".format(id=MOCK_ID),
            method="PUT",
            headers=headers,
            data=json.dumps({"name": "Changed name"}),
            content_type="application/json",
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        MOCK_GROUP.update({"name": "Changed name"})
        self.assert_equal(response.json, MOCK_GROUP.to_dict())
