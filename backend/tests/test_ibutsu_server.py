"""Test the main Ibutsu server application."""

from unittest.mock import patch

import pytest


@pytest.fixture
def mocked_add_user_filter():
    """Mock the add_user_filter function."""
    with patch("ibutsu_server.util.projects.add_user_filter") as mock_add_user_filter:
        yield mock_add_user_filter


def test_health_check(mocked_add_user_filter, flask_app):
    """Test the health check endpoint."""
    client, jwt_token = flask_app
    mocked_add_user_filter.side_effect = lambda query, _user: query
    headers = {"Authorization": f"Bearer {jwt_token}"}
    response = client.get("/api/health", headers=headers)
    assert response.status_code == 200


def test_run_list(mocked_add_user_filter, flask_app, make_project):
    """Test the run list endpoint."""
    client, jwt_token = flask_app
    mocked_add_user_filter.side_effect = lambda query, _user, **_kwargs: query

    # Create a project so the user has something to query
    project = make_project(name="test-project")

    headers = {"Authorization": f"Bearer {jwt_token}"}
    # Add project filter for superadmin users to avoid full table scan requirement
    response = client.get(f"/api/run?filter=project_id={project.id}", headers=headers)
    assert response.status_code == 200
