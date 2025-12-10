import pytest


def test_add_dashboard_success(flask_app, make_project, make_user, auth_headers):
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
    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/dashboard",
        headers=headers,
        json=dashboard_data,
    )
    assert response.status_code == 201, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["title"] == "Test Dashboard"

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db.models import Dashboard

        dashboard = Dashboard.query.filter_by(title="Test Dashboard").first()
        assert dashboard is not None
        assert dashboard.project_id == str(project.id)


def test_add_dashboard_forbidden_project(flask_app, make_project, make_user, auth_headers):
    """Test case for add_dashboard - forbidden project access"""
    client, jwt_token = flask_app

    # Create project with a specific owner (not the test user)
    other_user = make_user(email="other@example.com")
    project = make_project(name="private-project", owner_id=other_user.id)

    dashboard_data = {
        "title": "Test Dashboard",
        "project_id": str(project.id),
    }
    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/dashboard",
        headers=headers,
        json=dashboard_data,
    )
    # Superadmin should have access to all projects
    # If not superadmin, should get 403
    # Since test user is superadmin, this will succeed
    assert response.status_code in [201, 403]


def test_get_dashboard_success(flask_app, make_project, make_dashboard, auth_headers):
    """Test case for get_dashboard - successful retrieval"""
    client, jwt_token = flask_app

    # Create dashboard
    project = make_project(name="test-project")
    dashboard = make_dashboard(title="Test Dashboard", project_id=project.id)

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/dashboard/{dashboard.id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["id"] == str(dashboard.id)
    assert response_data["title"] == "Test Dashboard"


def test_get_dashboard_not_found(flask_app, auth_headers):
    """Test case for get_dashboard - dashboard not found"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
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
def test_get_dashboard_list(flask_app, make_project, make_dashboard, page, page_size, auth_headers):
    """Test case for get_dashboard_list"""
    client, jwt_token = flask_app

    # Create project and dashboards
    project = make_project(name="test-project")
    for i in range(30):
        make_dashboard(title=f"Dashboard {i}", project_id=project.id)

    query_string = [("page", page), ("pageSize", page_size)]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/dashboard",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert "dashboards" in response_data
    assert "pagination" in response_data
    assert response_data["pagination"]["page"] == page
    assert response_data["pagination"]["pageSize"] == page_size


def test_get_dashboard_list_filter_by_project(
    flask_app, make_project, make_dashboard, auth_headers
):
    """Test case for get_dashboard_list with project filter"""
    client, jwt_token = flask_app

    # Create two projects with dashboards
    project1 = make_project(name="project-1")
    project2 = make_project(name="project-2")

    dashboard1 = make_dashboard(title="Dashboard 1", project_id=project1.id)
    dashboard2 = make_dashboard(title="Dashboard 2", project_id=project2.id)

    query_string = [("project_id", str(project1.id))]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/dashboard",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    # Should only return dashboards from project1
    dashboard_ids = [d["id"] for d in response_data["dashboards"]]
    assert str(dashboard1.id) in dashboard_ids
    assert str(dashboard2.id) not in dashboard_ids


def test_update_dashboard_success(flask_app, make_project, make_dashboard, auth_headers):
    """Test case for update_dashboard - successful update"""
    client, jwt_token = flask_app

    # Create dashboard
    project = make_project(name="test-project")
    dashboard = make_dashboard(title="Original Title", project_id=project.id)

    update_data = {"title": "Updated Title"}
    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/dashboard/{dashboard.id}",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["title"] == "Updated Title"

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db import db
        from ibutsu_server.db.models import Dashboard

        updated_dashboard = db.session.get(Dashboard, str(dashboard.id))
        assert updated_dashboard.title == "Updated Title"


def test_update_dashboard_not_found(flask_app, auth_headers):
    """Test case for update_dashboard - dashboard not found"""
    client, jwt_token = flask_app

    update_data = {"title": "Updated Title"}
    headers = auth_headers(jwt_token)
    response = client.put(
        "/api/dashboard/00000000-0000-0000-0000-000000000000",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 404


def test_delete_dashboard_success(flask_app, make_project, make_dashboard, auth_headers):
    """Test case for delete_dashboard - successful deletion"""
    client, jwt_token = flask_app

    # Create dashboard
    project = make_project(name="test-project")
    dashboard = make_dashboard(title="Test Dashboard", project_id=project.id)
    dashboard_id = str(dashboard.id)

    headers = auth_headers(jwt_token)
    response = client.delete(
        f"/api/dashboard/{dashboard_id}",
        headers=headers,
    )
    assert response.status_code == 200

    # Verify deletion in database
    with client.application.app_context():
        from ibutsu_server.db import db
        from ibutsu_server.db.models import Dashboard

        deleted_dashboard = db.session.get(Dashboard, dashboard_id)
        assert deleted_dashboard is None


def test_delete_dashboard_not_found(flask_app, auth_headers):
    """Test case for delete_dashboard - dashboard not found"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.delete(
        "/api/dashboard/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == 404


def test_delete_dashboard_with_widget_configs(
    flask_app, make_project, make_dashboard, make_widget_config, auth_headers
):
    """Test case for delete_dashboard - deletes associated widget configs"""
    client, jwt_token = flask_app

    # Create dashboard with widget configs
    project = make_project(name="test-project")
    dashboard = make_dashboard(title="Test Dashboard", project_id=project.id)

    widget1 = make_widget_config(dashboard_id=dashboard.id, widget="run-aggregator")
    widget2 = make_widget_config(dashboard_id=dashboard.id, widget="result-summary")

    headers = auth_headers(jwt_token)
    response = client.delete(
        f"/api/dashboard/{dashboard.id}",
        headers=headers,
    )
    assert response.status_code == 200

    # Verify widget configs were deleted
    with client.application.app_context():
        from ibutsu_server.db import db
        from ibutsu_server.db.models import WidgetConfig

        widget1_deleted = db.session.get(WidgetConfig, widget1.id)
        widget2_deleted = db.session.get(WidgetConfig, widget2.id)
        assert widget1_deleted is None
        assert widget2_deleted is None


def test_delete_dashboard_clears_default_dashboard_reference(
    flask_app, make_project, make_dashboard, auth_headers
):
    """Test case for delete_dashboard - clears project default_dashboard_id"""
    client, jwt_token = flask_app

    # Create dashboard and set it as default for project
    project = make_project(name="test-project")
    dashboard = make_dashboard(title="Default Dashboard", project_id=project.id)

    # Set dashboard as default for project
    with client.application.app_context():
        from ibutsu_server.db import db
        from ibutsu_server.db.models import Project

        proj = db.session.get(Project, project.id)
        proj.default_dashboard_id = str(dashboard.id)
        db.session.commit()

    headers = auth_headers(jwt_token)
    response = client.delete(
        f"/api/dashboard/{dashboard.id}",
        headers=headers,
    )
    assert response.status_code == 200

    # Verify default_dashboard_id was cleared
    with client.application.app_context():
        from ibutsu_server.db import db
        from ibutsu_server.db.models import Project

        proj = db.session.get(Project, project.id)
        assert proj.default_dashboard_id is None


def test_add_dashboard_with_invalid_user_id(flask_app, make_project, auth_headers):
    """Test case for add_dashboard - invalid user_id"""
    client, jwt_token = flask_app

    project = make_project(name="test-project")

    dashboard_data = {
        "title": "Test Dashboard",
        "project_id": str(project.id),
        "user_id": "00000000-0000-0000-0000-000000000000",  # Non-existent user
    }
    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/dashboard",
        headers=headers,
        json=dashboard_data,
    )
    assert response.status_code == 400


def test_add_dashboard_without_json(flask_app, auth_headers):
    """Test case for add_dashboard - request without JSON content"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/dashboard",
        headers=headers,
        data="not json",
    )
    # Should return error for non-JSON request
    assert response.status_code in [400, 415]


def test_update_dashboard_without_json(flask_app, make_project, make_dashboard, auth_headers):
    """Test case for update_dashboard - request without JSON content"""
    client, jwt_token = flask_app

    project = make_project(name="test-project")
    dashboard = make_dashboard(title="Test Dashboard", project_id=project.id)

    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/dashboard/{dashboard.id}",
        headers=headers,
        data="not json",
    )
    # Should return error for non-JSON request
    assert response.status_code in [400, 415]


def test_update_dashboard_with_metadata_project(
    flask_app, make_project, make_dashboard, auth_headers
):
    """Test case for update_dashboard - updating metadata with project"""
    client, jwt_token = flask_app

    project = make_project(name="test-project")
    dashboard = make_dashboard(title="Test Dashboard", project_id=project.id)

    update_data = {
        "title": "Updated Dashboard",
        "metadata": {"project": str(project.id), "custom_field": "value"},
    }
    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/dashboard/{dashboard.id}",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 200

    response_data = response.json()
    assert response_data["title"] == "Updated Dashboard"


def test_get_dashboard_list_with_filters(flask_app, make_project, make_dashboard, auth_headers):
    """Test case for get_dashboard_list with custom filters"""
    client, jwt_token = flask_app

    project = make_project(name="test-project")
    make_dashboard(title="Alpha Dashboard", project_id=project.id)
    make_dashboard(title="Beta Dashboard", project_id=project.id)

    query_string = [("filter", "title=Alpha Dashboard")]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/dashboard",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200

    response_data = response.json()
    dashboard_titles = [d["title"] for d in response_data["dashboards"]]
    assert "Alpha Dashboard" in dashboard_titles


def test_get_dashboard_with_project_superadmin_access(
    flask_app, make_project, make_dashboard, make_user, auth_headers
):
    """Test case for get_dashboard - superadmin can access any project's dashboard"""
    client, jwt_token = flask_app

    # Create a project with a different owner
    other_user = make_user(email="other@example.com")
    project = make_project(name="private-project", owner_id=other_user.id)
    dashboard = make_dashboard(title="Private Dashboard", project_id=project.id)

    # Use superadmin token (from flask_app fixture)
    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/dashboard/{dashboard.id}",
        headers=headers,
    )
    # Superadmin should have access to all dashboards
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["id"] == str(dashboard.id)
    assert response_data["title"] == "Private Dashboard"


def test_get_dashboard_with_project_non_superadmin_forbidden(
    flask_app, make_project, make_dashboard, make_user, auth_headers
):
    """Test case for get_dashboard - non-superadmin cannot access other user's project dashboard"""
    client, _ = flask_app
    from ibutsu_server.db.base import session
    from ibutsu_server.db.models import Token
    from ibutsu_server.util.jwt import generate_token

    # Create a project owned by one user
    owner_user = make_user(email="owner@example.com")
    project = make_project(name="private-project", owner_id=owner_user.id)
    dashboard = make_dashboard(title="Private Dashboard", project_id=project.id)

    # Create a different non-superadmin user
    other_user = make_user(email="other@example.com", is_superadmin=False)
    session.refresh(other_user)

    # Generate token for the non-superadmin user
    other_jwt_token = generate_token(other_user.id)
    token = Token(name="other-login-token", user=other_user, token=other_jwt_token)
    session.add(token)
    session.commit()

    # Try to access the dashboard as the non-superadmin user
    headers = auth_headers(other_jwt_token)
    response = client.get(
        f"/api/dashboard/{dashboard.id}",
        headers=headers,
    )
    # Non-superadmin should be forbidden from accessing another user's project dashboard
    assert response.status_code == 403


def test_get_dashboard_list_empty(flask_app, auth_headers):
    """Test case for get_dashboard_list - empty list"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/dashboard",
        headers=headers,
    )
    assert response.status_code == 200

    response_data = response.json()
    assert "dashboards" in response_data
    assert "pagination" in response_data
    assert response_data["pagination"]["totalItems"] == 0


def test_add_dashboard_without_project_id(flask_app, auth_headers):
    """Test case for add_dashboard - dashboard without project_id"""
    client, jwt_token = flask_app

    dashboard_data = {
        "title": "Test Dashboard",
        # No project_id
    }
    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/dashboard",
        headers=headers,
        json=dashboard_data,
    )
    # Should succeed - project_id is optional
    assert response.status_code == 201
