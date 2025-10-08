from unittest.mock import MagicMock, patch

import pytest
from flask import json

from ibutsu_server.test import MockDashboard, MockProject, MockUser, MockWidgetConfig

MOCK_DASHBOARD_ID = "70202589-4781-4eb9-bcfc-685b1d2c583a"
MOCK_PROJECT_ID = "23cd86d5-a27e-45a4-83a3-12c74d219709"
MOCK_USER_ID = "12345678-1234-1234-1234-123456789012"

MOCK_DASHBOARD = MockDashboard(
    id=MOCK_DASHBOARD_ID,
    title="Test Dashboard",
    project_id=MOCK_PROJECT_ID,
    user_id=MOCK_USER_ID,
)

MOCK_PROJECT = MockProject(
    id=MOCK_PROJECT_ID,
    name="test-project",
    title="Test Project",
)

# Set up the relationship
MOCK_DASHBOARD.project = MOCK_PROJECT

MOCK_USER = MockUser(
    id=MOCK_USER_ID,
    name="Test User",
    email="test@example.com",
)


@pytest.fixture
def dashboard_controller_mocks():
    """Set up mocks for dashboard controller tests"""
    with (
        patch("ibutsu_server.controllers.dashboard_controller.session") as mock_session,
        patch("ibutsu_server.controllers.dashboard_controller.Dashboard") as mock_dashboard,
        patch("ibutsu_server.controllers.dashboard_controller.Project") as mock_project,
        patch("ibutsu_server.controllers.dashboard_controller.User") as mock_user,
        patch(
            "ibutsu_server.controllers.dashboard_controller.project_has_user"
        ) as mock_project_has_user,
        patch("ibutsu_server.controllers.dashboard_controller.WidgetConfig") as mock_widget_config,
    ):
        # Configure default return values
        mock_dashboard.from_dict.return_value = MOCK_DASHBOARD
        mock_dashboard.query.get.return_value = MOCK_DASHBOARD
        mock_project.query.get.return_value = MOCK_PROJECT
        mock_user.query.get.return_value = MOCK_USER
        mock_project_has_user.return_value = True

        yield {
            "session": mock_session,
            "dashboard": mock_dashboard,
            "project": mock_project,
            "user": mock_user,
            "project_has_user": mock_project_has_user,
            "widget_config": mock_widget_config,
        }


@pytest.fixture
def flask_app():
    """Create Flask app for testing"""
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


class TestDashboardController:
    """DashboardController integration test stubs"""

    def test_add_dashboard_success(self, flask_app, dashboard_controller_mocks):
        """Test case for add_dashboard - successful creation"""
        client, jwt_token = flask_app
        mocks = dashboard_controller_mocks

        dashboard_data = {
            "title": "Test Dashboard",
            "project_id": MOCK_PROJECT_ID,
            "user_id": MOCK_USER_ID,
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            "/api/dashboard",
            method="POST",
            headers=headers,
            data=json.dumps(dashboard_data),
            content_type="application/json",
        )
        mocks["dashboard"].from_dict.assert_called_once()
        mocks["session"].add.assert_called_once()
        mocks["session"].commit.assert_called_once()
        assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"

    def test_add_dashboard_forbidden_project(self, flask_app, dashboard_controller_mocks):
        """Test case for add_dashboard - forbidden project access"""
        client, jwt_token = flask_app
        mocks = dashboard_controller_mocks
        mocks["project_has_user"].return_value = False

        dashboard_data = {
            "title": "Test Dashboard",
            "project_id": MOCK_PROJECT_ID,
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            "/api/dashboard",
            method="POST",
            headers=headers,
            data=json.dumps(dashboard_data),
            content_type="application/json",
        )
        assert response.status_code == 403, f"Response body is : {response.data.decode('utf-8')}"

    def test_add_dashboard_invalid_user(self, flask_app, dashboard_controller_mocks):
        """Test case for add_dashboard - invalid user ID"""
        client, jwt_token = flask_app
        mocks = dashboard_controller_mocks
        mocks["user"].query.get.return_value = None

        dashboard_data = {
            "title": "Test Dashboard",
            "user_id": MOCK_USER_ID,
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            "/api/dashboard",
            method="POST",
            headers=headers,
            data=json.dumps(dashboard_data),
            content_type="application/json",
        )
        assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"

    def test_get_dashboard_success(self, flask_app, dashboard_controller_mocks):
        """Test case for get_dashboard - successful retrieval"""
        client, jwt_token = flask_app
        mocks = dashboard_controller_mocks

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            f"/api/dashboard/{MOCK_DASHBOARD_ID}",
            method="GET",
            headers=headers,
        )
        mocks["dashboard"].query.get.assert_called_once_with(MOCK_DASHBOARD_ID)
        assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    def test_get_dashboard_not_found(self, flask_app, dashboard_controller_mocks):
        """Test case for get_dashboard - dashboard not found"""
        client, jwt_token = flask_app
        mocks = dashboard_controller_mocks
        mocks["dashboard"].query.get.return_value = None

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            f"/api/dashboard/{MOCK_DASHBOARD_ID}",
            method="GET",
            headers=headers,
        )
        assert response.status_code == 404, f"Response body is : {response.data.decode('utf-8')}"

    def test_get_dashboard_forbidden(self, flask_app, dashboard_controller_mocks):
        """Test case for get_dashboard - forbidden project access"""
        client, jwt_token = flask_app
        mocks = dashboard_controller_mocks
        mocks["project_has_user"].return_value = False

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            f"/api/dashboard/{MOCK_DASHBOARD_ID}",
            method="GET",
            headers=headers,
        )
        assert response.status_code == 403, f"Response body is : {response.data.decode('utf-8')}"

    @pytest.mark.parametrize(
        ("page", "page_size", "expected_offset"),
        [
            (1, 25, 0),
            (2, 10, 10),
            (3, 5, 10),
        ],
    )
    def test_get_dashboard_list_pagination(
        self, flask_app, dashboard_controller_mocks, page, page_size, expected_offset
    ):
        """Test case for get_dashboard_list with different pagination parameters"""
        client, jwt_token = flask_app
        mocks = dashboard_controller_mocks

        # Set up mock query
        mock_query = MagicMock()
        mock_query.count.return_value = 100
        mock_query.order_by.return_value = mock_query
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = [MOCK_DASHBOARD]
        mocks["dashboard"].query = mock_query

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        query_string = [("page", page), ("pageSize", page_size)]
        response = client.open(
            "/api/dashboard",
            method="GET",
            headers=headers,
            query_string=query_string,
        )
        assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

        # Verify pagination calculation
        mock_query.offset.assert_called_with(expected_offset)
        mock_query.limit.assert_called_with(page_size)

    def test_get_dashboard_list_with_project_filter(self, flask_app, dashboard_controller_mocks):
        """Test case for get_dashboard_list with project filter"""
        client, jwt_token = flask_app
        mocks = dashboard_controller_mocks

        mock_query = MagicMock()
        mock_query.count.return_value = 1
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.offset.return_value.limit.return_value.all.return_value = [MOCK_DASHBOARD]
        mocks["dashboard"].query = mock_query

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        query_string = [("project_id", MOCK_PROJECT_ID)]
        response = client.open(
            "/api/dashboard",
            method="GET",
            headers=headers,
            query_string=query_string,
        )
        assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    def test_update_dashboard_success(self, flask_app, dashboard_controller_mocks):
        """Test case for update_dashboard - successful update"""
        client, jwt_token = flask_app
        mocks = dashboard_controller_mocks

        update_data = {"title": "Updated Dashboard"}
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            f"/api/dashboard/{MOCK_DASHBOARD_ID}",
            method="PUT",
            headers=headers,
            data=json.dumps(update_data),
            content_type="application/json",
        )
        mocks["dashboard"].query.get.assert_called_once_with(MOCK_DASHBOARD_ID)
        assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    def test_update_dashboard_not_found(self, flask_app, dashboard_controller_mocks):
        """Test case for update_dashboard - dashboard not found"""
        client, jwt_token = flask_app
        mocks = dashboard_controller_mocks
        mocks["dashboard"].query.get.return_value = None

        update_data = {"title": "Updated Dashboard"}
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            f"/api/dashboard/{MOCK_DASHBOARD_ID}",
            method="PUT",
            headers=headers,
            data=json.dumps(update_data),
            content_type="application/json",
        )
        assert response.status_code == 404, f"Response body is : {response.data.decode('utf-8')}"

    def test_delete_dashboard_success(self, flask_app, dashboard_controller_mocks):
        """Test case for delete_dashboard - successful deletion"""
        client, jwt_token = flask_app
        mocks = dashboard_controller_mocks

        mock_widget_configs = [MockWidgetConfig(id="widget1"), MockWidgetConfig(id="widget2")]
        mocks["widget_config"].query.filter.return_value.all.return_value = mock_widget_configs

        headers = {
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            f"/api/dashboard/{MOCK_DASHBOARD_ID}",
            method="DELETE",
            headers=headers,
        )
        mocks["dashboard"].query.get.assert_called_once_with(MOCK_DASHBOARD_ID)
        mocks["session"].delete.assert_called()  # Called for widgets and dashboard
        mocks["session"].commit.assert_called_once()
        assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    def test_delete_dashboard_not_found(self, flask_app, dashboard_controller_mocks):
        """Test case for delete_dashboard - dashboard not found"""
        client, jwt_token = flask_app
        mocks = dashboard_controller_mocks
        mocks["dashboard"].query.get.return_value = None

        headers = {
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            f"/api/dashboard/{MOCK_DASHBOARD_ID}",
            method="DELETE",
            headers=headers,
        )
        assert response.status_code == 404, f"Response body is : {response.data.decode('utf-8')}"

    def test_delete_dashboard_forbidden(self, flask_app, dashboard_controller_mocks):
        """Test case for delete_dashboard - forbidden project access"""
        client, jwt_token = flask_app
        mocks = dashboard_controller_mocks
        mocks["project_has_user"].return_value = False

        headers = {
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            f"/api/dashboard/{MOCK_DASHBOARD_ID}",
            method="DELETE",
            headers=headers,
        )
        assert response.status_code == 403, f"Response body is : {response.data.decode('utf-8')}"

    def test_delete_dashboard_with_default_reference(self, flask_app, dashboard_controller_mocks):
        """Test case for delete_dashboard - dashboard referenced as default dashboard"""
        client, jwt_token = flask_app
        mocks = dashboard_controller_mocks

        # Mock projects that reference this dashboard as default
        mock_projects = [MockProject(id="project1"), MockProject(id="project2")]
        mocks["project"].query.filter.return_value.all.return_value = mock_projects

        headers = {
            "Authorization": f"Bearer {jwt_token}",
        }
        response = client.open(
            f"/api/dashboard/{MOCK_DASHBOARD_ID}",
            method="DELETE",
            headers=headers,
        )

        # Verify that projects with default_dashboard_id were queried
        mocks["project"].query.filter.assert_called_once()
        # Verify that projects were updated to clear default_dashboard_id
        assert mocks["session"].add.call_count >= 2  # At least 2 projects updated
        mocks["session"].commit.assert_called_once()
        assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
