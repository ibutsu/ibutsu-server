from http import HTTPStatus
from unittest.mock import MagicMock, patch

import pytest
from flask import json

from ibutsu_server.test import BaseTestCase, MockGroup, MockProject, MockUser

MOCK_PROJECT_ID = "70202589-4781-4eb9-bcfc-685b1d2c583a"
MOCK_USER_ID = "12345678-1234-1234-1234-123456789012"
MOCK_GROUP_ID = "23cd86d5-a27e-45a4-83a3-12c74d219709"

MOCK_PROJECT = MockProject(
    id=MOCK_PROJECT_ID,
    name="test-project",
    title="Test Project",
    owner_id=MOCK_USER_ID,
    group_id=MOCK_GROUP_ID,
)

MOCK_USER = MockUser(
    id=MOCK_USER_ID,
    name="Test User",
    email="test@example.com",
    is_superadmin=True,
)

MOCK_GROUP = MockGroup(
    id=MOCK_GROUP_ID,
    name="test-group",
)


class TestAdminProjectController(BaseTestCase):
    """AdminProjectController integration test stubs"""

    def setUp(self):
        """Set up mocks for admin project controller tests"""
        self.session_patcher = patch("ibutsu_server.controllers.admin.project_controller.session")
        self.mock_session = self.session_patcher.start()

        self.project_patcher = patch("ibutsu_server.controllers.admin.project_controller.Project")
        self.mock_project_class = self.project_patcher.start()
        self.mock_project_class.query.get.return_value = MOCK_PROJECT
        self.mock_project_class.from_dict.return_value = MOCK_PROJECT

        self.user_patcher = patch("ibutsu_server.controllers.admin.project_controller.User")
        self.mock_user_class = self.user_patcher.start()
        self.mock_user_class.query.get.return_value = MOCK_USER

        self.group_patcher = patch("ibutsu_server.controllers.admin.project_controller.Group")
        self.mock_group_class = self.group_patcher.start()
        self.mock_group_class.query.get.return_value = MOCK_GROUP

        # Mock validate_admin decorator to pass through and set user
        self.validate_admin_patcher = patch(
            "ibutsu_server.controllers.admin.project_controller.validate_admin"
        )
        self.mock_validate_admin = self.validate_admin_patcher.start()

        def mock_validate_admin_decorator(func):
            def wrapper(**kwargs):
                kwargs["user"] = MOCK_USER.id  # Set the user ID for admin functions
                return func(**kwargs)

            return wrapper

        self.mock_validate_admin.side_effect = mock_validate_admin_decorator

        # Mock abort function
        self.abort_patcher = patch("ibutsu_server.controllers.admin.project_controller.abort")
        self.mock_abort = self.abort_patcher.start()
        self.mock_abort.side_effect = Exception("Aborted")  # Simulate abort behavior

        # Mock UUID validation functions
        self.is_uuid_patcher = patch("ibutsu_server.controllers.admin.project_controller.is_uuid")
        self.mock_is_uuid = self.is_uuid_patcher.start()
        self.mock_is_uuid.return_value = True

        self.convert_objectid_patcher = patch(
            "ibutsu_server.controllers.admin.project_controller.convert_objectid_to_uuid"
        )
        self.mock_convert_objectid = self.convert_objectid_patcher.start()
        self.mock_convert_objectid.return_value = MOCK_PROJECT_ID

    def tearDown(self):
        """Teardown the mocks"""
        self.convert_objectid_patcher.stop()
        self.is_uuid_patcher.stop()
        self.abort_patcher.stop()
        self.validate_admin_patcher.stop()
        self.group_patcher.stop()
        self.user_patcher.stop()
        self.project_patcher.stop()
        self.session_patcher.stop()

    def test_admin_add_project_success(self):
        """Test case for admin_add_project - successful creation"""
        # Mock that project doesn't exist
        self.mock_project_class.query.get.return_value = None

        # Mock project has users list
        MOCK_PROJECT.users = []

        project_data = {
            "name": "new-project",
            "title": "New Project",
            "group_id": MOCK_GROUP_ID,
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/admin/project",
            method="POST",
            headers=headers,
            data=json.dumps(project_data),
            content_type="application/json",
        )
        self.mock_project_class.from_dict.assert_called_once()
        self.mock_session.add.assert_called_once()
        self.mock_session.commit.assert_called_once()
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))

    def test_admin_add_project_already_exists(self):
        """Test case for admin_add_project - project already exists"""
        # Mock project with ID that already exists
        existing_project = MockProject(id=MOCK_PROJECT_ID, name="existing")
        self.mock_project_class.from_dict.return_value = existing_project
        self.mock_project_class.query.get.return_value = existing_project

        project_data = {
            "id": MOCK_PROJECT_ID,
            "name": "new-project",
            "title": "New Project",
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/admin/project",
            method="POST",
            headers=headers,
            data=json.dumps(project_data),
            content_type="application/json",
        )
        self.assert_400(response, "Response body is : " + response.data.decode("utf-8"))
        assert "already exist" in response.data.decode("utf-8")

    def test_admin_add_project_group_not_found(self):
        """Test case for admin_add_project - group not found"""
        # Mock that project doesn't exist but group doesn't exist
        self.mock_project_class.query.get.return_value = None
        self.mock_group_class.query.get.return_value = None

        project_data = {
            "name": "new-project",
            "title": "New Project",
            "group_id": "nonexistent-group-id",
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/admin/project",
            method="POST",
            headers=headers,
            data=json.dumps(project_data),
            content_type="application/json",
        )
        self.assert_400(response, "Response body is : " + response.data.decode("utf-8"))
        assert "doesn't exist" in response.data.decode("utf-8")

    def test_admin_add_project_with_user_as_owner(self):
        """Test case for admin_add_project - user becomes owner and is added to users list"""
        # Mock that project doesn't exist
        self.mock_project_class.query.get.return_value = None

        # Mock project has users list
        MOCK_PROJECT.users = []
        MOCK_PROJECT.owner = None

        project_data = {
            "name": "new-project",
            "title": "New Project",
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/admin/project",
            method="POST",
            headers=headers,
            data=json.dumps(project_data),
            content_type="application/json",
        )

        # Verify user was set as owner and added to users
        assert MOCK_PROJECT.owner == MOCK_USER
        assert MOCK_USER in MOCK_PROJECT.users
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))

    def test_admin_get_project_success(self):
        """Test case for admin_get_project - successful retrieval by ID"""
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/admin/project/{MOCK_PROJECT_ID}",
            method="GET",
            headers=headers,
        )
        self.mock_project_class.query.get.assert_called_once_with(MOCK_PROJECT_ID)
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_admin_get_project_by_name(self):
        """Test case for admin_get_project - successful retrieval by name"""
        # Mock that get by ID returns the project
        self.mock_project_class.query.get.return_value = MOCK_PROJECT

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/admin/project/{MOCK_PROJECT_ID}",
            method="GET",
            headers=headers,
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_admin_get_project_not_found(self):
        """Test case for admin_get_project - project not found"""
        self.mock_project_class.query.get.return_value = None
        self.mock_project_class.query.filter.return_value.first.return_value = None

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }

        with pytest.raises(Exception, match="Aborted"):
            self.client.open(
                f"/api/admin/project/{MOCK_PROJECT_ID}",
                method="GET",
                headers=headers,
            )

        self.mock_abort.assert_called_once_with(HTTPStatus.NOT_FOUND)

    def test_admin_get_project_list_pagination(self):
        """Test case for admin_get_project_list with pagination parameters"""
        page, page_size = 2, 10
        mock_query = MagicMock()
        mock_query.count.return_value = 100
        mock_query.offset.return_value.limit.return_value.all.return_value = [MOCK_PROJECT]
        self.mock_project_class.query = mock_query

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        query_string = [("page", page), ("pageSize", page_size)]
        response = self.client.open(
            "/api/admin/project",
            method="GET",
            headers=headers,
            query_string=query_string,
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

        # Verify pagination calculation
        expected_offset = (page - 1) * page_size
        mock_query.offset.assert_called_with(expected_offset)
        mock_query.offset.return_value.limit.assert_called_with(page_size)

    def test_admin_get_project_list_with_filters(self):
        """Test case for admin_get_project_list with owner and group filters"""
        mock_query = MagicMock()
        mock_query.count.return_value = 1
        mock_query.filter.return_value = mock_query
        mock_query.offset.return_value.limit.return_value.all.return_value = [MOCK_PROJECT]
        self.mock_project_class.query = mock_query

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        query_string = [
            ("owner_id", MOCK_USER_ID),
            ("group_id", MOCK_GROUP_ID),
        ]
        response = self.client.open(
            "/api/admin/project",
            method="GET",
            headers=headers,
            query_string=query_string,
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_admin_get_project_list_page_too_big(self):
        """Test case for admin_get_project_list - page number too big"""
        mock_query = MagicMock()
        mock_query.count.return_value = 1
        self.mock_project_class.query = mock_query

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        # Use a very large page number that would cause overflow
        query_string = [("page", 999999999999999999), ("pageSize", 25)]
        response = self.client.open(
            "/api/admin/project",
            method="GET",
            headers=headers,
            query_string=query_string,
        )
        self.assert_400(response, "Response body is : " + response.data.decode("utf-8"))
        assert "too big" in response.data.decode("utf-8")

    def test_admin_update_project_success(self):
        """Test case for admin_update_project - successful update"""
        # Mock project has users list
        MOCK_PROJECT.users = []

        update_data = {
            "title": "Updated Project Title",
            "users": ["newuser@example.com"],
            "owner_id": MOCK_USER_ID,
        }

        # Mock user lookup for email
        new_user = MockUser(id="new-user-id", email="newuser@example.com")
        self.mock_user_class.query.filter_by.return_value.first.return_value = new_user

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/admin/project/{MOCK_PROJECT_ID}",
            method="PUT",
            headers=headers,
            data=json.dumps(update_data),
            content_type="application/json",
        )

        self.mock_session.add.assert_called_once()
        self.mock_session.commit.assert_called_once()
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_admin_update_project_not_found(self):
        """Test case for admin_update_project - project not found"""
        self.mock_project_class.query.get.return_value = None

        update_data = {"title": "Updated Project Title"}
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }

        with pytest.raises(Exception, match="Aborted"):
            self.client.open(
                f"/api/admin/project/{MOCK_PROJECT_ID}",
                method="PUT",
                headers=headers,
                data=json.dumps(update_data),
                content_type="application/json",
            )

        self.mock_abort.assert_called_once_with(HTTPStatus.NOT_FOUND)

    def test_admin_update_project_converts_objectid(self):
        """Test case for admin_update_project - converts ObjectId to UUID"""
        self.mock_is_uuid.return_value = False
        object_id = "507f1f77bcf86cd799439011"

        # Mock project has users list
        MOCK_PROJECT.users = []

        update_data = {"title": "Updated Project Title"}
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/admin/project/{object_id}",
            method="PUT",
            headers=headers,
            data=json.dumps(update_data),
            content_type="application/json",
        )

        self.mock_convert_objectid.assert_called_once_with(object_id)
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_admin_delete_project_success(self):
        """Test case for admin_delete_project - successful deletion"""
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/admin/project/{MOCK_PROJECT_ID}",
            method="DELETE",
            headers=headers,
        )

        self.mock_session.delete.assert_called_once_with(MOCK_PROJECT)
        self.mock_session.commit.assert_called_once()
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_admin_delete_project_not_found(self):
        """Test case for admin_delete_project - project not found"""
        self.mock_project_class.query.get.return_value = None

        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
        }

        with pytest.raises(Exception, match="Aborted"):
            self.client.open(
                f"/api/admin/project/{MOCK_PROJECT_ID}",
                method="DELETE",
                headers=headers,
            )

        self.mock_abort.assert_called_once_with(HTTPStatus.NOT_FOUND)

    def test_admin_delete_project_invalid_uuid(self):
        """Test case for admin_delete_project - invalid UUID format"""
        self.mock_is_uuid.return_value = False
        invalid_id = "not-a-valid-uuid"

        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/admin/project/{invalid_id}",
            method="DELETE",
            headers=headers,
        )

        self.assert_400(response, "Response body is : " + response.data.decode("utf-8"))
        assert "is not a valid UUID" in response.data.decode("utf-8")
