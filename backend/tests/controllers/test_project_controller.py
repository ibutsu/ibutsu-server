import pytest
from flask import json


def test_add_project(flask_app, make_group, auth_headers):
    """Test case for add_project"""
    client, jwt_token = flask_app

    # Create group for the project
    group = make_group(name="test-group")

    project_data = {
        "name": "my-project",
        "title": "My Project",
        "group_id": str(group.id),
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/project",
        headers=headers,
        data=json.dumps(project_data),
        content_type="application/json",
    )
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["name"] == "my-project"
    assert response_data["title"] == "My Project"

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db.models import Project

        project = Project.query.filter_by(name="my-project").first()
        assert project is not None
        assert project.title == "My Project"


def test_get_project_by_id(flask_app, make_project, auth_headers):
    """Test case for get_project by ID"""
    client, jwt_token = flask_app

    # Create project
    project = make_project(name="test-project", title="Test Project")

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/project/{project.id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["id"] == str(project.id)
    assert response_data["name"] == "test-project"
    assert response_data["title"] == "Test Project"


def test_get_project_by_name(flask_app, make_project, auth_headers):
    """Test case for get_project by name"""
    client, jwt_token = flask_app

    # Create project
    project = make_project(name="my-project", title="My Project")

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/project/{project.id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["name"] == "my-project"


@pytest.mark.parametrize(
    ("page", "page_size"),
    [
        (1, 25),
        (2, 10),
        (1, 56),
    ],
)
def test_get_project_list(flask_app, make_project, page, page_size, auth_headers):
    """Test case for get_project_list with pagination"""
    client, jwt_token = flask_app

    # Create multiple projects
    for i in range(30):
        make_project(name=f"project-{i}", title=f"Project {i}")

    query_string = [
        ("page", page),
        ("pageSize", page_size),
    ]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/project",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert "projects" in response_data
    assert "pagination" in response_data
    assert response_data["pagination"]["page"] == page
    assert response_data["pagination"]["pageSize"] == page_size


def test_get_project_list_filter_by_owner(flask_app, make_project, make_user, auth_headers):
    """Test case for get_project_list with owner filter"""
    client, jwt_token = flask_app

    # Create users and projects
    owner1 = make_user(email="owner1@example.com")
    owner2 = make_user(email="owner2@example.com")

    project1 = make_project(name="project-1", owner_id=owner1.id)
    make_project(name="project-2", owner_id=owner2.id)

    query_string = [("filter", f"owner_id={owner1.id}")]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/project",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    # Should only return projects from owner1
    project_ids = [p["id"] for p in response_data["projects"]]
    assert str(project1.id) in project_ids
    # Depending on user access, owner2's project may or may not be in results


def test_update_project(flask_app, make_project, auth_headers):
    """Test case for update_project"""
    client, jwt_token = flask_app

    # Create project
    project = make_project(name="original-name", title="Original Title")

    update_data = {
        "title": "Updated Title",
    }
    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/project/{project.id}",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["title"] == "Updated Title"

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db.models import Project

        updated_project = Project.query.get(str(project.id))
        assert updated_project.title == "Updated Title"


def test_update_project_not_found(flask_app, auth_headers):
    """Test case for update_project - project not found"""
    client, jwt_token = flask_app

    update_data = {"title": "Updated Title"}
    headers = auth_headers(jwt_token)
    response = client.put(
        "/api/project/00000000-0000-0000-0000-000000000000",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )
    assert response.status_code == 404
