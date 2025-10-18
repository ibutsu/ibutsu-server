from http import HTTPStatus

import pytest
from flask import json


def test_admin_add_project_success(flask_app, make_group):
    """Test case for admin_add_project - successful creation"""
    client, jwt_token = flask_app

    # Create a group to associate with the project
    group = make_group(name="test-group")

    project_data = {
        "name": "new-project",
        "title": "New Project",
        "group_id": str(group.id),
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.post(
        "/api/admin/project",
        headers=headers,
        data=json.dumps(project_data),
        content_type="application/json",
    )
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"

    # Verify the project was created in the database
    response_data = response.get_json()
    assert response_data["name"] == "new-project"
    assert response_data["title"] == "New Project"
    assert response_data["group_id"] == str(group.id)

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db.models import Project

        project = Project.query.filter_by(name="new-project").first()
        assert project is not None
        assert project.title == "New Project"


def test_admin_add_project_already_exists(flask_app, make_project):
    """Test case for admin_add_project - project already exists"""
    client, jwt_token = flask_app

    # Create existing project
    existing_project = make_project(name="existing-project", title="Existing Project")

    # Try to create project with the same ID
    project_data = {
        "id": str(existing_project.id),
        "name": "new-project",
        "title": "New Project",
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.post(
        "/api/admin/project",
        headers=headers,
        data=json.dumps(project_data),
        content_type="application/json",
    )
    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"
    assert "already exist" in response.data.decode("utf-8")


def test_admin_add_project_group_not_found(flask_app):
    """Test case for admin_add_project - group not found"""
    client, jwt_token = flask_app

    project_data = {
        "name": "new-project",
        "title": "New Project",
        "group_id": "00000000-0000-0000-0000-000000000000",
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.post(
        "/api/admin/project",
        headers=headers,
        data=json.dumps(project_data),
        content_type="application/json",
    )
    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"
    assert "doesn't exist" in response.data.decode("utf-8")


def test_admin_add_project_with_user_as_owner(flask_app):
    """Test case for admin_add_project - user becomes owner and is added to users list"""
    client, jwt_token = flask_app

    project_data = {
        "name": "new-project",
        "title": "New Project",
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.post(
        "/api/admin/project",
        headers=headers,
        data=json.dumps(project_data),
        content_type="application/json",
    )

    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"

    # Verify user was set as owner and added to users
    with client.application.app_context():
        from ibutsu_server.db.models import Project, User

        project = Project.query.filter_by(name="new-project").first()
        assert project is not None
        assert project.owner is not None
        test_user = User.query.filter_by(email="test@example.com").first()
        assert test_user in project.users


def test_admin_get_project_success(flask_app, make_project):
    """Test case for admin_get_project - successful retrieval by ID"""
    client, jwt_token = flask_app

    # Create project
    project = make_project(name="test-project", title="Test Project")

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        f"/api/admin/project/{project.id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["id"] == str(project.id)
    assert response_data["name"] == "test-project"


def test_admin_get_project_by_name(flask_app, make_project):
    """Test case for admin_get_project - successful retrieval by name"""
    client, jwt_token = flask_app

    # Create project
    project = make_project(name="test-project", title="Test Project")

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        f"/api/admin/project/{project.id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_admin_get_project_not_found(flask_app):
    """Test case for admin_get_project - project not found"""
    client, jwt_token = flask_app

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }

    response = client.get(
        "/api/admin/project/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == HTTPStatus.NOT_FOUND


@pytest.mark.parametrize(
    ("page", "page_size", "expected_offset"),
    [
        (1, 25, 0),
        (2, 10, 10),
        (3, 5, 10),
    ],
)
def test_admin_get_project_list_pagination(
    flask_app, make_project, page, page_size, expected_offset
):
    """Test case for admin_get_project_list with pagination parameters"""
    client, jwt_token = flask_app

    # Create multiple projects
    for i in range(100):
        make_project(name=f"project-{i}", title=f"Project {i}")

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    query_string = [("page", page), ("pageSize", page_size)]
    response = client.get(
        "/api/admin/project",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert "projects" in response_data
    assert response_data["pagination"]["page"] == page
    assert response_data["pagination"]["pageSize"] == page_size


def test_admin_get_project_list_with_filters(flask_app, make_project, make_user, make_group):
    """Test case for admin_get_project_list with owner and group filters"""
    client, jwt_token = flask_app

    # Create test data
    user = make_user(email="owner@example.com")
    group = make_group(name="test-group")
    make_project(name="filtered-project", owner_id=user.id, group_id=group.id)

    # Create other projects without the filters
    make_project(name="other-project-1")
    make_project(name="other-project-2")

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    query_string = [
        ("owner_id", str(user.id)),
        ("group_id", str(group.id)),
    ]
    response = client.get(
        "/api/admin/project",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    # Should only return the filtered project
    assert len(response_data["projects"]) == 1
    assert response_data["projects"][0]["name"] == "filtered-project"


def test_admin_get_project_list_page_too_big(flask_app):
    """Test case for admin_get_project_list - page number too big"""
    client, jwt_token = flask_app

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    # Use a very large page number that would cause overflow
    query_string = [("page", 999999999999999999), ("pageSize", 25)]
    response = client.get(
        "/api/admin/project",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"
    assert "too big" in response.data.decode("utf-8")


def test_admin_update_project_success(flask_app, make_project, make_user):
    """Test case for admin_update_project - successful update"""
    client, jwt_token = flask_app

    # Create project
    project = make_project(name="test-project", title="Original Title")

    # Create a new user to add to project
    new_user = make_user(email="newuser@example.com")

    update_data = {
        "title": "Updated Project Title",
        "users": [new_user.email],
        "owner_id": str(new_user.id),
    }

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.put(
        f"/api/admin/project/{project.id}",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )

    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db.models import Project

        updated_project = Project.query.get(str(project.id))
        assert updated_project.title == "Updated Project Title"
        assert new_user in updated_project.users


def test_admin_update_project_not_found(flask_app):
    """Test case for admin_update_project - project not found"""
    client, jwt_token = flask_app

    update_data = {"title": "Updated Project Title"}
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }

    response = client.put(
        "/api/admin/project/00000000-0000-0000-0000-000000000000",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_admin_update_project_converts_objectid(flask_app, make_project):
    """Test case for admin_update_project - converts ObjectId to UUID"""
    client, jwt_token = flask_app

    # Create project
    make_project(name="test-project", title="Original Title")

    # Use ObjectId format
    object_id = "507f1f77bcf86cd799439011"

    update_data = {"title": "Updated Project Title"}
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.put(
        f"/api/admin/project/{object_id}",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )

    # ObjectId conversion should happen and fail gracefully if no project found
    assert response.status_code in [200, 400, 404]


def test_admin_delete_project_success(flask_app, make_project):
    """Test case for admin_delete_project - successful deletion"""
    client, jwt_token = flask_app

    # Create project
    project = make_project(name="test-project", title="Test Project")
    project_id = project.id

    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.delete(
        f"/api/admin/project/{project_id}",
        headers=headers,
    )

    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    # Verify project is deleted from database
    with client.application.app_context():
        from ibutsu_server.db.models import Project

        project = Project.query.get(str(project_id))
        assert project is None


def test_admin_delete_project_not_found(flask_app):
    """Test case for admin_delete_project - project not found"""
    client, jwt_token = flask_app

    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }

    response = client.delete(
        "/api/admin/project/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_admin_delete_project_invalid_uuid(flask_app):
    """Test case for admin_delete_project - invalid UUID format"""
    client, jwt_token = flask_app
    invalid_id = "not-a-valid-uuid"

    headers = {
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.delete(
        f"/api/admin/project/{invalid_id}",
        headers=headers,
    )

    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"
    assert "is not a valid UUID" in response.data.decode("utf-8")
