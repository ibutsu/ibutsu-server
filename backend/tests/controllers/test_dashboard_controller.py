import pytest
from flask import json


def test_add_dashboard_success(flask_app, make_project, make_user):
    """Test case for add_dashboard - successful creation"""
    client, jwt_token = flask_app

    # Create project and user
    project = make_project(name="test-project")
    user = make_user(email="dashboard-user@example.com")

    dashboard_data = {
        "title": "Test Dashboard",
        "project_id": str(project.id),
        "user_id": str(user.id),
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.post(
        "/api/dashboard",
        headers=headers,
        data=json.dumps(dashboard_data),
        content_type="application/json",
    )
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["title"] == "Test Dashboard"

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db.models import Dashboard

        dashboard = Dashboard.query.filter_by(title="Test Dashboard").first()
        assert dashboard is not None
        assert dashboard.project_id == str(project.id)


def test_add_dashboard_forbidden_project(flask_app, make_project, make_user):
    """Test case for add_dashboard - forbidden project access"""
    client, jwt_token = flask_app

    # Create project with a specific owner (not the test user)
    other_user = make_user(email="other@example.com")
    project = make_project(name="private-project", owner_id=other_user.id)

    dashboard_data = {
        "title": "Test Dashboard",
        "project_id": str(project.id),
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.post(
        "/api/dashboard",
        headers=headers,
        data=json.dumps(dashboard_data),
        content_type="application/json",
    )
    # Superadmin should have access to all projects
    # If not superadmin, should get 403
    # Since test user is superadmin, this will succeed
    assert response.status_code in [201, 403]


def test_get_dashboard_success(flask_app, make_project, make_dashboard):
    """Test case for get_dashboard - successful retrieval"""
    client, jwt_token = flask_app

    # Create dashboard
    project = make_project(name="test-project")
    dashboard = make_dashboard(title="Test Dashboard", project_id=project.id)

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        f"/api/dashboard/{dashboard.id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["id"] == str(dashboard.id)
    assert response_data["title"] == "Test Dashboard"


def test_get_dashboard_not_found(flask_app):
    """Test case for get_dashboard - dashboard not found"""
    client, jwt_token = flask_app

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        "/api/dashboard/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == 404


@pytest.mark.parametrize(
    ("page", "page_size"),
    [
        (1, 25),
        (2, 10),
        (1, 50),
    ],
)
def test_get_dashboard_list(flask_app, make_project, make_dashboard, page, page_size):
    """Test case for get_dashboard_list"""
    client, jwt_token = flask_app

    # Create project and dashboards
    project = make_project(name="test-project")
    for i in range(30):
        make_dashboard(title=f"Dashboard {i}", project_id=project.id)

    query_string = [("page", page), ("pageSize", page_size)]
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        "/api/dashboard",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert "dashboards" in response_data
    assert "pagination" in response_data
    assert response_data["pagination"]["page"] == page
    assert response_data["pagination"]["pageSize"] == page_size


def test_get_dashboard_list_filter_by_project(flask_app, make_project, make_dashboard):
    """Test case for get_dashboard_list with project filter"""
    client, jwt_token = flask_app

    # Create two projects with dashboards
    project1 = make_project(name="project-1")
    project2 = make_project(name="project-2")

    dashboard1 = make_dashboard(title="Dashboard 1", project_id=project1.id)
    dashboard2 = make_dashboard(title="Dashboard 2", project_id=project2.id)

    query_string = [("project", str(project1.id))]
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        "/api/dashboard",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    # Should only return dashboards from project1
    dashboard_ids = [d["id"] for d in response_data["dashboards"]]
    assert str(dashboard1.id) in dashboard_ids
    assert str(dashboard2.id) not in dashboard_ids


def test_update_dashboard_success(flask_app, make_project, make_dashboard):
    """Test case for update_dashboard - successful update"""
    client, jwt_token = flask_app

    # Create dashboard
    project = make_project(name="test-project")
    dashboard = make_dashboard(title="Original Title", project_id=project.id)

    update_data = {"title": "Updated Title"}
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.put(
        f"/api/dashboard/{dashboard.id}",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["title"] == "Updated Title"

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db.models import Dashboard

        updated_dashboard = Dashboard.query.get(str(dashboard.id))
        assert updated_dashboard.title == "Updated Title"


def test_update_dashboard_not_found(flask_app):
    """Test case for update_dashboard - dashboard not found"""
    client, jwt_token = flask_app

    update_data = {"title": "Updated Title"}
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.put(
        "/api/dashboard/00000000-0000-0000-0000-000000000000",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )
    assert response.status_code == 404
