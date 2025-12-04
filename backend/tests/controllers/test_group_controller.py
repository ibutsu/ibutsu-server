import pytest


def test_add_group(flask_app, auth_headers):
    """Test case for add_group - Create a new group"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/group",
        headers=headers,
        json={"name": "Example group"},
    )
    assert response.status_code == 201, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["name"] == "Example group"

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db.models import Group

        group = Group.query.filter_by(name="Example group").first()
        assert group is not None


def test_get_group(flask_app, make_group, auth_headers):
    """Test case for get_group - Get a group"""
    client, jwt_token = flask_app

    # Create group
    group = make_group(name="Test Group")

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/group/{group.id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["id"] == str(group.id)
    assert response_data["name"] == "Test Group"


@pytest.mark.parametrize(
    ("page", "page_size"),
    [
        (1, 25),
        (2, 10),
        (1, 56),
    ],
)
def test_get_group_list(flask_app, make_group, page, page_size, auth_headers):
    """Test case for get_group_list - Get a list of groups"""
    client, jwt_token = flask_app

    # Create multiple groups
    for i in range(30):
        make_group(name=f"Group {i}")

    query_string = [("page", page), ("pageSize", page_size)]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/group",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert "groups" in response_data
    assert "pagination" in response_data
    assert response_data["pagination"]["page"] == page
    assert response_data["pagination"]["pageSize"] == page_size


def test_update_group(flask_app, make_group, auth_headers):
    """Test case for update_group - Update a group"""
    client, jwt_token = flask_app

    # Create group
    group = make_group(name="Original Name")

    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/group/{group.id}",
        headers=headers,
        json={"name": "Updated Name"},
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["name"] == "Updated Name"

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db import db
        from ibutsu_server.db.models import Group

        updated_group = db.session.get(Group, str(group.id))
        assert updated_group.name == "Updated Name"
