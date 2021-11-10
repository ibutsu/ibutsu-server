# coding: utf-8
from __future__ import absolute_import

from unittest.mock import patch

from flask import json
from ibutsu_server.test import BaseTestCase
from ibutsu_server.test import MockUser
from ibutsu_server.util.jwt import generate_token

MOCK_ID = "6f7c2d52-54dc-4309-8e2e-c74515d39455"
MOCK_EMAIL = "test@example.com"
MOCK_PASSWORD = "my super secret password"
MOCK_USER = MockUser(id=MOCK_ID, email=MOCK_EMAIL, password=MOCK_PASSWORD, name="Test User")


class TestLoginController(BaseTestCase):
    """LoginController integration test stubs"""

    def setUp(self):
        """Set up a fake DB objects"""
        self.user_patcher = patch("ibutsu_server.controllers.login_controller.User")
        self.mock_user = self.user_patcher.start()
        self.mock_user.query.filter_by.return_value.first.return_value = MOCK_USER

    def tearDown(self):
        """Teardown the mocks"""
        self.user_patcher.stop()

    @patch("ibutsu_server.controllers.login_controller.generate_token")
    def test_login(self, mocked_generate_token):
        """Test case for login

        Log in to the API
        """
        login_details = {"email": MOCK_EMAIL, "password": MOCK_PASSWORD}
        expected_token = generate_token(MOCK_ID)
        mocked_generate_token.return_value = expected_token
        expected_response = {"name": "Test User", "email": MOCK_EMAIL, "token": expected_token}
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        response = self.client.open(
            "/api/login",
            method="POST",
            headers=headers,
            data=json.dumps(login_details),
            content_type="application/json",
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == expected_response

    def test_login_empty_request(self):
        """Test case for login

        Log in to the API
        """
        login_details = {"email": "", "password": ""}
        expected_response = {"code": "EMPTY", "message": "Username and/or password are empty"}
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        response = self.client.open(
            "/api/login",
            method="POST",
            headers=headers,
            data=json.dumps(login_details),
            content_type="application/json",
        )
        self.assert_401(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == expected_response

    def test_login_no_user(self):
        """Test case for login

        Log in to the API
        """
        login_details = {"email": "bad@email.com", "password": MOCK_PASSWORD}
        expected_response = {"code": "INVALID", "message": "Username and/or password are invalid"}
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        self.mock_user.query.filter_by.return_value.first.return_value = None
        response = self.client.open(
            "/api/login",
            method="POST",
            headers=headers,
            data=json.dumps(login_details),
            content_type="application/json",
        )
        self.assert_401(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == expected_response

    def test_login_bad_password(self):
        """Test case for login

        Log in to the API
        """
        login_details = {"email": MOCK_EMAIL, "password": "bad password"}
        expected_response = {"code": "INVALID", "message": "Username and/or password are invalid"}
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        response = self.client.open(
            "/api/login",
            method="POST",
            headers=headers,
            data=json.dumps(login_details),
            content_type="application/json",
        )
        self.assert_401(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == expected_response

    def test_support(self):
        """Test the support method"""
        expected_response = {
            "user": True,
            "keycloak": False,
            "google": True,
            "github": False,
            "facebook": False,
            "gitlab": True,
        }
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        response = self.client.open(
            "/api/login/support",
            method="GET",
            headers=headers,
            content_type="application/json",
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == expected_response

    def test_config_gitlab(self):
        """Test getting the "gitlab" provider config"""
        expected_response = {
            "authorization_url": "https://gitlab.com/oauth/authorize",
            "client_id": "dfgfdgh4563453456dsfgdsfg456",
            "redirect_uri": "http://localhost:8080/api/login/auth/gitlab",
            "scope": "read_user",
        }
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        response = self.client.open(
            "/api/login/config/gitlab",
            method="GET",
            headers=headers,
            content_type="application/json",
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))
        assert response.json == expected_response
