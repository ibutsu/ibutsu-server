# coding: utf-8
from __future__ import absolute_import

from unittest.mock import MagicMock
from unittest.mock import patch

from flask import json
from ibutsu_server.test import BaseTestCase
from ibutsu_server.test import MockProject
from ibutsu_server.util.jwt import generate_token

MOCK_ID = "5ac7d645-45a3-4cbe-acb2-c8d6f7e05468"
MOCK_NAME = "my-project"
MOCK_DATA = {
    "id": MOCK_ID,
    "name": MOCK_NAME,
    "title": "My Project",
    "owner_id": "8f22a434-b160-41ed-b700-0cc3d7f146b1",
    "group_id": "9af34437-047c-48a5-bd21-6430e4532414",
}
MOCK_PROJECT = MockProject.from_dict(**MOCK_DATA)
MOCK_PROJECT_DICT = MOCK_PROJECT.to_dict()


class TestProjectController(BaseTestCase):
    """ProjectController integration test stubs"""

    def setUp(self):
        """Set up a fake MongoDB object"""
        self.session_patcher = patch("ibutsu_server.controllers.project_controller.session")
        self.mock_session = self.session_patcher.start()
        self.project_has_user_patcher = patch(
            "ibutsu_server.controllers.project_controller.project_has_user"
        )
        self.mock_project_has_user = self.project_has_user_patcher.start()
        self.mock_project_has_user.return_value = True
        self.add_user_filter_patcher = patch(
            "ibutsu_server.controllers.project_controller.add_user_filter"
        )
        self.mock_add_user_filter = self.add_user_filter_patcher.start()
        self.mock_add_user_filter.side_effect = lambda query, user: query
        self.project_patcher = patch("ibutsu_server.controllers.project_controller.Project")
        self.mock_project = self.project_patcher.start()
        self.mock_project.return_value = MOCK_PROJECT
        self.mock_project.from_dict.return_value = MOCK_PROJECT
        self.mock_project.query.get.return_value = MOCK_PROJECT
        mock_limit = MagicMock()
        mock_limit.return_value.offset.return_value.all.return_value = [MOCK_PROJECT]
        self.mock_project.query.limit = mock_limit
        self.mock_project.query.filter.return_value.limit = mock_limit
        self.mock_project.query.count.return_value = 1
        self.mock_project.query.filter.return_value.count.return_value = 1
        self.jwt_token = generate_token("test-user")

    def tearDown(self):
        """Teardown the mocks"""
        self.project_patcher.stop()
        self.add_user_filter_patcher.stop()
        self.project_has_user_patcher.stop()
        self.session_patcher.stop()

    def test_add_project(self):
        """Test case for add_project

        Create a project
        """
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/project",
            method="POST",
            headers=headers,
            data=json.dumps(MOCK_DATA),
            content_type="application/json",
        )
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))
        self.assert_equal(response.json, MOCK_PROJECT_DICT)
        self.mock_session.add.assert_called_once_with(MOCK_PROJECT)
        self.mock_session.commit.assert_called_once()

    def test_get_project_by_id(self):
        """Test case for get_project

        Get a single project by ID
        """
        self.mock_project.query.filter.return_value.first.return_value = None
        headers = {"Accept": "application/json", "Authorization": f"Bearer {self.jwt_token}"}
        response = self.client.open(
            "/api/project/{id}".format(id=MOCK_ID), method="GET", headers=headers
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        self.assert_equal(response.json, MOCK_PROJECT_DICT)
        self.mock_project.query.get.assert_called_once_with(MOCK_ID)

    def test_get_project_by_name(self):
        """Test case for get_project

        Get a single project by name
        """
        self.mock_project.query.filter.return_value.first.return_value = MOCK_PROJECT
        headers = {"Accept": "application/json", "Authorization": f"Bearer {self.jwt_token}"}
        response = self.client.open(
            "/api/project/{id}".format(id=MOCK_NAME), method="GET", headers=headers
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        self.assert_equal(response.json, MOCK_PROJECT_DICT)

    def test_get_project_list(self):
        """Test case for get_project_list

        Get a list of projects
        """
        self.mock_project.query.filter.return_value.filter.return_value.count.return_value = 1
        mock_offset = MagicMock()
        mock_offset.return_value.limit.return_value.all.return_value = [MOCK_PROJECT]
        self.mock_project.query.filter.return_value.filter.return_value.offset = mock_offset
        query_string = [
            ("ownerId", "owner_id_example"),
            ("groupId", "group_id_example"),
            ("page", 56),
            ("pageSize", 56),
        ]
        headers = {"Accept": "application/json", "Authorization": f"Bearer {self.jwt_token}"}
        response = self.client.open(
            "/api/project", method="GET", headers=headers, query_string=query_string
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        expected_response = {
            "pagination": {"page": 56, "pageSize": 56, "totalItems": 1, "totalPages": 1},
            "projects": [MOCK_PROJECT_DICT],
        }
        assert response.json == expected_response

    def test_update_project(self):
        """Test case for update_project

        Update a project
        """
        updates = {
            "ownerId": "dd338937-95f0-4b4e-a7a4-0d02da9f56e6",
            "groupId": "99174ff1-bfd8-4727-89e4-2904c2644bfb",
        }
        updated_dict = MOCK_PROJECT_DICT.copy()
        updated_dict.update(updates)
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/project/{id}".format(id=MOCK_ID),
            method="PUT",
            headers=headers,
            data=json.dumps(updates),
            content_type="application/json",
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        self.assert_equal(response.json, updated_dict)
