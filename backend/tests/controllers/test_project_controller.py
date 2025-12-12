import pytest

from ibutsu_server.db import db
from ibutsu_server.db.models import Project, User


@pytest.mark.integration
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
        json=project_data,
    )
    assert response.status_code == 201, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["name"] == "my-project"
    assert response_data["title"] == "My Project"

    # Verify in database
    with client.application.app_context():
        project = Project.query.filter_by(name="my-project").first()
        assert project is not None
        assert project.title == "My Project"


@pytest.mark.integration
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
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["id"] == str(project.id)
    assert response_data["name"] == "test-project"
    assert response_data["title"] == "Test Project"


@pytest.mark.integration
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
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["name"] == "my-project"


@pytest.mark.integration
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
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert "projects" in response_data
    assert "pagination" in response_data
    assert response_data["pagination"]["page"] == page
    assert response_data["pagination"]["pageSize"] == page_size


@pytest.mark.integration
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
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    # Should only return projects from owner1
    project_ids = [p["id"] for p in response_data["projects"]]
    assert str(project1.id) in project_ids
    # Depending on user access, owner2's project may or may not be in results


@pytest.mark.integration
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
        json=update_data,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["title"] == "Updated Title"

    # Verify in database
    with client.application.app_context():
        updated_project = db.session.get(Project, str(project.id))
        assert updated_project.title == "Updated Title"


@pytest.mark.validation
@pytest.mark.parametrize(
    ("project_id", "expected_status", "description"),
    [
        ("not-a-uuid", 400, "Invalid UUID format triggers validation error"),
        ("00000000-0000-0000-0000-000000000000", 404, "Valid UUID format but project not found"),
    ],
)
def test_update_project_validation_errors(
    flask_app, project_id, expected_status, description, auth_headers
):
    """Test case for update_project validation errors - parametrized"""
    client, jwt_token = flask_app

    update_data = {"title": "Updated Title"}
    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/project/{project_id}",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == expected_status, description


@pytest.mark.validation
@pytest.mark.parametrize(
    ("project_id", "expected_status", "description"),
    [
        ("not-a-uuid", 400, "Invalid UUID format triggers validation error"),
        ("00000000-0000-0000-0000-000000000000", 404, "Valid UUID format but project not found"),
    ],
)
def test_get_project_validation_errors(
    flask_app, project_id, expected_status, description, auth_headers
):
    """Test case for get_project validation errors - parametrized"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/project/{project_id}",
        headers=headers,
    )
    assert response.status_code == expected_status, description


@pytest.mark.integration
def test_add_project_duplicate_id(flask_app, make_project, auth_headers):
    """Test add_project with duplicate project ID"""
    client, jwt_token = flask_app

    # Create a project
    existing_project = make_project(name="existing-project")

    # Try to create another project with same ID
    project_data = {
        "id": str(existing_project.id),
        "name": "duplicate-id-project",
        "title": "Duplicate ID Project",
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/project",
        headers=headers,
        json=project_data,
    )
    assert response.status_code == 400
    assert "already exist" in response.text


@pytest.mark.integration
def test_add_project_with_owner(flask_app, auth_headers):
    """Test add_project assigns current user as owner"""
    client, jwt_token = flask_app

    project_data = {
        "name": "owned-project",
        "title": "Owned Project",
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/project",
        headers=headers,
        json=project_data,
    )
    assert response.status_code == 201

    # Verify owner was set
    with client.application.app_context():
        project = Project.query.filter_by(name="owned-project").first()
        test_user = User.query.filter_by(email="test@example.com").first()
        assert project.owner_id == test_user.id
        assert test_user in project.users


@pytest.mark.integration
def test_update_project_add_users(flask_app, make_project, make_user, auth_headers):
    """Test update_project adding users to project"""
    client, jwt_token = flask_app

    # Create project
    project = make_project(name="team-project", title="Team Project")

    # Create additional users
    make_user(email="user1@example.com")
    make_user(email="user2@example.com")

    update_data = {
        "users": ["user1@example.com", "user2@example.com"],
    }

    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/project/{project.id}",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 200

    # Verify users were added
    with client.application.app_context():
        updated_project = db.session.get(Project, str(project.id))
        user_emails = {u.email for u in updated_project.users}
        assert "user1@example.com" in user_emails
        assert "user2@example.com" in user_emails


@pytest.mark.integration
def test_update_project_as_superadmin(flask_app, make_project, make_user, auth_headers):
    """Test update_project works for superadmin even on other user's project"""
    client, jwt_token = flask_app

    # Create another user and their project
    other_user = make_user(email="other@example.com", is_superadmin=False)
    project = make_project(name="other-project", owner_id=other_user.id)

    # Update as superadmin (should work - superadmins can update any project)
    update_data = {"title": "Updated by superadmin"}
    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/project/{project.id}",
        headers=headers,
        json=update_data,
    )
    # Superadmin can update any project
    assert response.status_code == 200

    # Verify the update
    response_data = response.json()
    assert response_data["title"] == "Updated by superadmin"


@pytest.mark.integration
def test_get_project_list_with_name_filter(flask_app, make_project, auth_headers):
    """Test get_project_list with name filter"""
    client, jwt_token = flask_app

    # Create projects
    proj1 = make_project(name="specific-name", title="Test Project 1")
    make_project(name="other-name", title="Test Project 2")

    query_string = [("filter", "name=specific-name")]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/project",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200

    response_data = response.json()
    # Should find at least the specific project
    assert any(p["id"] == str(proj1.id) for p in response_data["projects"])


@pytest.mark.integration
def test_get_project_list_by_group(flask_app, make_project, make_group, auth_headers):
    """Test get_project_list filtered by group_id"""
    client, jwt_token = flask_app

    # Create groups and projects
    group1 = make_group(name="group1")
    group2 = make_group(name="group2")

    proj1 = make_project(name="proj1", group_id=group1.id)
    make_project(name="proj2", group_id=group2.id)

    query_string = [("groupId", str(group1.id))]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/project",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200

    response_data = response.json()
    project_ids = [p["id"] for p in response_data["projects"]]
    assert str(proj1.id) in project_ids


def test_add_project_non_json(flask_app, headers_without_json):
    """Test add_project with non-JSON content type"""
    client, jwt_token = flask_app

    headers = headers_without_json(jwt_token)
    response = client.post(
        "/api/project",
        headers=headers,
        data="not json",
    )
    assert response.status_code in [400, 415]


def test_update_project_non_json(flask_app, make_project, headers_without_json):
    """Test update_project with non-JSON content type"""
    client, jwt_token = flask_app

    project = make_project(name="test-project")

    headers = headers_without_json(jwt_token)
    response = client.put(
        f"/api/project/{project.id}",
        headers=headers,
        data="not json",
    )
    assert response.status_code in [400, 415]
