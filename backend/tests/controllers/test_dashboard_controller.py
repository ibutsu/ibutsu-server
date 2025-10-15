from unittest.mock import MagicMock, patch

import pytest
from flask import json

from tests.conftest import MOCK_DASHBOARD_ID, MOCK_PROJECT_ID, MOCK_USER_ID
from tests.test_util import MockDashboard, MockProject, MockUser, MockWidgetConfig

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


def test_add_dashboard_success(flask_app, dashboard_controller_mocks):
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


def test_add_dashboard_forbidden_project(flask_app, dashboard_controller_mocks):
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


def test_add_dashboard_invalid_user(flask_app, dashboard_controller_mocks):
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


def test_get_dashboard_success(flask_app, dashboard_controller_mocks):
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


def test_get_dashboard_not_found(flask_app, dashboard_controller_mocks):
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


def test_get_dashboard_forbidden(flask_app, dashboard_controller_mocks):
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
    flask_app, dashboard_controller_mocks, page, page_size, expected_offset
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


def test_get_dashboard_list_with_project_filter(flask_app, dashboard_controller_mocks):
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


def test_update_dashboard_success(flask_app, dashboard_controller_mocks):
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


def test_update_dashboard_not_found(flask_app, dashboard_controller_mocks):
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


def test_delete_dashboard_success(flask_app, dashboard_controller_mocks):
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


def test_delete_dashboard_not_found(flask_app, dashboard_controller_mocks):
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


def test_delete_dashboard_forbidden(flask_app, dashboard_controller_mocks):
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


def test_delete_dashboard_with_default_reference(flask_app, dashboard_controller_mocks):
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
    # Verify that the specific mock projects were updated to clear default_dashboard_id
    add_calls = [call[0][0] for call in mocks["session"].add.call_args_list]
    assert mock_projects[0] in add_calls, "First project should be added to session"
    assert mock_projects[1] in add_calls, "Second project should be added to session"
    mocks["session"].commit.assert_called_once()
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_delete_dashboard_with_no_default_reference(flask_app, dashboard_controller_mocks):
    """Test case for delete_dashboard - no projects reference the dashboard as default"""
    client, jwt_token = flask_app
    mocks = dashboard_controller_mocks
    # Mock no projects referencing this dashboard
    mocks["project"].query.filter.return_value.all.return_value = []
    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/dashboard/{MOCK_DASHBOARD_ID}",
        method="DELETE",
        headers=headers,
    )
    # Verify that projects were still queried
    mocks["project"].query.filter.assert_called_once()
    # Dashboard should still be deleted successfully
    mocks["session"].delete.assert_called()
    mocks["session"].commit.assert_called_once()
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_delete_dashboard_with_update_failure(flask_app, dashboard_controller_mocks):
    """Test case for delete_dashboard - database error when updating projects"""
    client, jwt_token = flask_app
    mocks = dashboard_controller_mocks
    # Mock projects that reference this dashboard as default
    mock_projects = [MockProject(id="project1")]
    mocks["project"].query.filter.return_value.all.return_value = mock_projects
    # Simulate a database error when committing
    mocks["session"].commit.side_effect = Exception("Database update failed")
    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    # Verify the exception is raised - Flask's test client re-raises exceptions by default
    with pytest.raises(Exception, match="Database update failed"):
        client.open(
            f"/api/dashboard/{MOCK_DASHBOARD_ID}",
            method="DELETE",
            headers=headers,
        )
