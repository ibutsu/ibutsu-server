from unittest.mock import MagicMock, patch

from flask import json

from ibutsu_server.test import BaseTestCase, MockToken, MockUser

MOCK_USER_ID = "70202589-4781-4eb9-bcfc-685b1d2c583a"
MOCK_TOKEN_ID = "23cd86d5-a27e-45a4-83a3-12c74d219709"


MOCK_USER = MockUser(
    id=MOCK_USER_ID,
    name="Test User",
    email="test@example.com",
    password="hashed_password",
    is_superadmin=False,
)

MOCK_TOKEN = MockToken(
    id=MOCK_TOKEN_ID,
    name="test-token",
    user_id=MOCK_USER_ID,
    expires="2024-12-31T23:59:59Z",  # String format expected by controller
)


class TestUserController(BaseTestCase):
    """UserController integration test stubs"""

    def setUp(self):
        """Set up mocks for user controller tests"""
        self.session_patcher = patch("ibutsu_server.controllers.user_controller.session")
        self.mock_session = self.session_patcher.start()

        self.user_patcher = patch("ibutsu_server.controllers.user_controller.User")
        self.mock_user_class = self.user_patcher.start()
        self.mock_user_class.query.get.return_value = MOCK_USER

        self.token_patcher = patch("ibutsu_server.controllers.user_controller.Token")
        self.mock_token_class = self.token_patcher.start()
        self.mock_token_class.from_dict.return_value = MOCK_TOKEN
        self.mock_token_class.query.get.return_value = MOCK_TOKEN

        # Mock query for token list
        mock_token_query = MagicMock()
        mock_token_query.count.return_value = 1
        mock_token_query.offset.return_value.limit.return_value.all.return_value = [MOCK_TOKEN]
        self.mock_token_class.query.filter.return_value = mock_token_query

        self.generate_token_patcher = patch(
            "ibutsu_server.controllers.user_controller.generate_token"
        )
        self.mock_generate_token = self.generate_token_patcher.start()
        self.mock_generate_token.return_value = "generated_token"

    def tearDown(self):
        """Teardown the mocks"""
        self.generate_token_patcher.stop()
        self.token_patcher.stop()
        self.user_patcher.stop()
        self.session_patcher.stop()

    def test_get_current_user_success(self):
        """Test case for get_current_user - successful retrieval"""
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/user",
            method="GET",
            headers=headers,
        )
        self.mock_user_class.query.get.assert_called_once()
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

        # Verify sensitive fields are hidden
        response_data = response.get_json()
        assert "password" not in response_data
        assert "_password" not in response_data
        assert "activation_code" not in response_data

    def test_get_current_user_unauthorized(self):
        """Test case for get_current_user - user not found"""
        self.mock_user_class.query.get.return_value = None
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/user",
            method="GET",
            headers=headers,
        )
        self.assert_401(response, "Response body is : " + response.data.decode("utf-8"))

    def test_update_current_user_success(self):
        """Test case for update_current_user - successful update"""
        update_data = {
            "name": "Updated User Name",
            "email": "updated@example.com",
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/user",
            method="PUT",
            headers=headers,
            data=json.dumps(update_data),
            content_type="application/json",
        )
        self.mock_session.add.assert_called_once()
        self.mock_session.commit.assert_called_once()
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_update_current_user_removes_superadmin_flag(self):
        """Test case for update_current_user - superadmin flag is removed"""
        update_data = {
            "name": "Updated User Name",
            "is_superadmin": True,  # This should be removed
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/user",
            method="PUT",
            headers=headers,
            data=json.dumps(update_data),
            content_type="application/json",
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_update_current_user_unauthorized(self):
        """Test case for update_current_user - user not found"""
        self.mock_user_class.query.get.return_value = None
        update_data = {"name": "Updated User Name"}
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/user",
            method="PUT",
            headers=headers,
            data=json.dumps(update_data),
            content_type="application/json",
        )
        self.assert_401(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_token_list_pagination(self):
        """Test case for get_token_list with pagination parameters"""
        page, page_size = 1, 25
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        query_string = [("page", page), ("pageSize", page_size)]
        response = self.client.open(
            "/api/user/token",
            method="GET",
            headers=headers,
            query_string=query_string,
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

        # Verify response structure
        response_data = response.get_json()
        assert "tokens" in response_data
        assert "pagination" in response_data
        assert response_data["pagination"]["page"] == page
        assert response_data["pagination"]["pageSize"] == page_size

    def test_get_token_list_unauthorized(self):
        """Test case for get_token_list - user not found"""
        self.mock_user_class.query.get.return_value = None
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/user/token",
            method="GET",
            headers=headers,
        )
        self.assert_401(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_token_success(self):
        """Test case for get_token - successful retrieval"""
        MOCK_TOKEN.user = MOCK_USER
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/user/token/{MOCK_TOKEN_ID}",
            method="GET",
            headers=headers,
        )
        self.mock_token_class.query.get.assert_called_once_with(MOCK_TOKEN_ID)
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_token_forbidden(self):
        """Test case for get_token - token belongs to different user"""
        different_user = MockUser(id="different-user-id", name="Different User")
        MOCK_TOKEN.user = different_user
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/user/token/{MOCK_TOKEN_ID}",
            method="GET",
            headers=headers,
        )
        self.assert_403(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_token_not_found(self):
        """Test case for get_token - token not found"""
        self.mock_token_class.query.get.return_value = None
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/user/token/{MOCK_TOKEN_ID}",
            method="GET",
            headers=headers,
        )
        # The controller should handle None token and return 404
        self.assert_404(response, "Response body is : " + response.data.decode("utf-8"))

    def test_delete_token_success(self):
        """Test case for delete_token - successful deletion"""
        MOCK_TOKEN.user = MOCK_USER
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/user/token/{MOCK_TOKEN_ID}",
            method="DELETE",
            headers=headers,
        )
        self.mock_session.delete.assert_called_once_with(MOCK_TOKEN)
        self.mock_session.commit.assert_called_once()
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_delete_token_forbidden(self):
        """Test case for delete_token - token belongs to different user"""
        different_user = MockUser(id="different-user-id", name="Different User")
        MOCK_TOKEN.user = different_user
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/user/token/{MOCK_TOKEN_ID}",
            method="DELETE",
            headers=headers,
        )
        self.assert_403(response, "Response body is : " + response.data.decode("utf-8"))

    def test_add_token_success(self):
        """Test case for add_token - successful creation"""
        token_data = {
            "name": "new-test-token",
            "expires": "2024-12-31T23:59:59Z",
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/user/token",
            method="POST",
            headers=headers,
            data=json.dumps(token_data),
            content_type="application/json",
        )
        self.mock_token_class.from_dict.assert_called_once()
        self.mock_session.add.assert_called_once()
        self.mock_session.commit.assert_called_once()
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))

    def test_add_token_unauthorized(self):
        """Test case for add_token - user not found"""
        self.mock_user_class.query.get.return_value = None
        token_data = {
            "name": "new-test-token",
            "expires": "2024-12-31T23:59:59Z",
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/user/token",
            method="POST",
            headers=headers,
            data=json.dumps(token_data),
            content_type="application/json",
        )
        self.assert_401(response, "Response body is : " + response.data.decode("utf-8"))
