from unittest.mock import MagicMock, patch

import pytest
from flask import json

from ibutsu_server.test import MockGroup

MOCK_ID = "c68506e2-202e-4193-a47d-33f1571d4b3e"
MOCK_GROUP = MockGroup(id=MOCK_ID, name="Example group", data={})
MOCK_GROUP_DICT = MOCK_GROUP.to_dict()
MOCK_LIST_RESPONSE = {"pagination": {"page": 0}, "groups": [MOCK_GROUP]}


@pytest.fixture
def group_controller_mocks():
    """Set up mocks for group controller tests"""
    with (
        patch("ibutsu_server.controllers.group_controller.session") as mock_session,
        patch("ibutsu_server.controllers.group_controller.Group") as mock_group,
    ):
        mock_limit = MagicMock()
        mock_limit.return_value.offset.return_value.all.return_value = [MOCK_GROUP]

        # Configure default return values
        mock_group.from_dict.return_value = MOCK_GROUP
        mock_group.query.count.return_value = 1
        mock_group.query.get.return_value = MOCK_GROUP
        mock_group.query.limit = mock_limit

        yield {"session": mock_session, "group": mock_group, "limit": mock_limit}


@pytest.fixture
def flask_app_group():
    """Create Flask app for group testing"""
    import logging

    import ibutsu_server.tasks
    from ibutsu_server import get_app
    from ibutsu_server.db.base import session
    from ibutsu_server.db.models import Token, User
    from ibutsu_server.tasks import create_celery_app
    from ibutsu_server.test import mock_task
    from ibutsu_server.util.jwt import generate_token

    logging.getLogger("connexion.operation").setLevel("ERROR")
    extra_config = {
        "TESTING": True,
        "LIVESERVER_PORT": 0,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "GOOGLE_CLIENT_ID": "123456@client.google.com",
        "GITHUB_CLIENT_ID": None,
        "FACEBOOK_APP_ID": None,
        "GITLAB_CLIENT_ID": "thisisafakegitlabclientid",
        "GITLAB_BASE_URL": "https://gitlab.com",
        "JWT_SECRET": "thisisafakejwtsecretvalue",
        "KEYCLOAK_BASE_URL": None,
        "KEYCLOAK_CLIENT_ID": None,
        "KEYCLOAK_AUTH_PATH": "auth",
    }
    app = get_app(**extra_config)
    create_celery_app(app)

    # Add a test user
    with app.app_context():
        test_user = User(
            name="Test User", email="test@example.com", is_active=True, is_superadmin=True
        )
        session.add(test_user)
        session.commit()
        jwt_token = generate_token(test_user.id)
        token = Token(name="login-token", user=test_user, token=jwt_token)
        session.add(token)
        session.commit()
        session.refresh(test_user)

    if ibutsu_server.tasks.task is None:
        ibutsu_server.tasks.task = mock_task

    with app.test_client() as client:
        yield client, jwt_token


class TestGroupController:
    """GroupController integration test stubs"""

    def test_add_group(self, flask_app_group, group_controller_mocks):
        """Test case for add_group

        Create a new group
        """
        client, jwt_token = flask_app_group
        mocks = group_controller_mocks

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        mocks["group"].query.get.return_value = None
        response = client.open(
            "/api/group",
            method="POST",
            headers=headers,
            data=json.dumps({"name": "Example group"}),
            content_type="application/json",
        )
        assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"
        assert response.json == MOCK_GROUP_DICT

    def test_get_group(self, flask_app_group, group_controller_mocks):
        """Test case for get_group

        Get a group
        """
        client, jwt_token = flask_app_group

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(f"/api/group/{MOCK_ID}", method="GET", headers=headers)
        assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
        assert response.json == MOCK_GROUP_DICT

    def test_get_group_list(self, flask_app_group, group_controller_mocks):
        """Test case for get_group_list

        Get a list of groups
        """
        client, jwt_token = flask_app_group

        query_string = [("page", 56), ("pageSize", 56)]
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            "/api/group", method="GET", headers=headers, query_string=query_string
        )
        assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
        assert response.json == {
            "groups": [MOCK_GROUP_DICT],
            "pagination": {
                "page": 56,
                "pageSize": 56,
                "totalItems": 1,
                "totalPages": 1,
            },
        }

    def test_update_group(self, flask_app_group, group_controller_mocks):
        """Test case for update_group

        Update a group
        """
        client, jwt_token = flask_app_group

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            f"/api/group/{MOCK_ID}",
            method="PUT",
            headers=headers,
            data=json.dumps({"name": "Changed name"}),
            content_type="application/json",
        )
        assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
        MOCK_GROUP.update({"name": "Changed name"})
        assert response.json == MOCK_GROUP.to_dict()
