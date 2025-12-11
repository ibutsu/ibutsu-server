from datetime import UTC, datetime
from unittest.mock import patch

import pytest


@patch("ibutsu_server.controllers.run_controller.update_run_task")
def test_add_run(mock_update_run_task, flask_app, make_project, auth_headers):
    """Test case for add_run"""
    client, jwt_token = flask_app

    # Create project
    project = make_project(name="test-project")

    # Mock the Celery task
    mock_update_run_task.apply_async.return_value = None

    run_data = {
        "summary": {"errors": 1, "failures": 3, "skips": 0, "tests": 548},
        "duration": 540.05433,
        "metadata": {
            "component": "test-component",
            "env": "local",
        },
        "project_id": str(project.id),
        "start_time": datetime.now(UTC).isoformat(),
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/run",
        headers=headers,
        json=run_data,
    )
    assert response.status_code == 201, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["summary"]["tests"] == 548
    assert response_data["summary"]["failures"] == 3

    # Verify task was triggered
    mock_update_run_task.apply_async.assert_called_once()


def test_get_run(flask_app, make_project, make_run, auth_headers):
    """Test case for get_run"""
    client, jwt_token = flask_app

    # Create test data
    project = make_project(name="test-project")
    run = make_run(
        project_id=project.id,
        summary={"errors": 1, "failures": 3, "skips": 0, "tests": 548},
        duration=540.05433,
    )

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/run/{run.id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["id"] == str(run.id)
    assert response_data["summary"]["tests"] == 548


@pytest.mark.parametrize(
    ("page", "page_size"),
    [
        (1, 25),
        (2, 10),
        (1, 56),
    ],
)
def test_get_run_list(flask_app, make_project, make_run, page, page_size, auth_headers):
    """Test case for get_run_list with pagination"""
    client, jwt_token = flask_app

    # Create test data
    project = make_project(name="test-project")

    # Create multiple runs
    for i in range(30):
        make_run(
            project_id=project.id,
            metadata={"build_number": i},
            summary={"tests": 100, "failures": i},
        )

    query_string = [("page", page), ("pageSize", page_size), ("filter", f"project_id={project.id}")]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/run",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert "runs" in response_data
    assert "pagination" in response_data
    assert response_data["pagination"]["page"] == page
    assert response_data["pagination"]["pageSize"] == page_size


def test_get_run_list_filter_by_project(flask_app, make_project, make_run, auth_headers):
    """Test case for get_run_list with project filter"""
    client, jwt_token = flask_app

    # Create two projects with runs
    project1 = make_project(name="project-1")
    project2 = make_project(name="project-2")

    run1 = make_run(project_id=project1.id, metadata={"project": "1"})
    run2 = make_run(project_id=project2.id, metadata={"project": "2"})

    query_string = [("filter", f"project_id={project1.id}")]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/run",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    # Should only return runs from project1
    run_ids = [r["id"] for r in response_data["runs"]]
    assert str(run1.id) in run_ids
    assert str(run2.id) not in run_ids


@patch("ibutsu_server.controllers.run_controller.update_run_task")
def test_update_run(mock_update_run_task, flask_app, make_project, make_run, auth_headers):
    """Test case for update_run"""
    client, jwt_token = flask_app

    # Create test data
    project = make_project(name="test-project")
    run = make_run(
        project_id=project.id,
        summary={"tests": 100, "failures": 10},
    )

    # Mock the Celery task
    mock_update_run_task.apply_async.return_value = None

    update_data = {
        "summary": {"tests": 100, "failures": 5},
        "metadata": {"component": "updated"},
    }
    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/run/{run.id}",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["summary"]["failures"] == 5

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db import db
        from ibutsu_server.db.models import Run

        updated_run = db.session.get(Run, str(run.id))
        assert updated_run.summary["failures"] == 5


def test_update_run_not_found(flask_app, auth_headers):
    """Test case for update_run - run not found"""
    client, jwt_token = flask_app

    update_data = {"summary": {"tests": 100}}
    headers = auth_headers(jwt_token)
    response = client.put(
        "/api/run/00000000-0000-0000-0000-000000000000",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 404


def test_get_run_list_requires_project_filter_for_superadmin(
    flask_app, make_project, make_run, auth_headers
):
    """Test that superadmin queries without project filter are rejected"""
    client, jwt_token = flask_app

    # Create some test data
    project = make_project(name="test-project")
    make_run(project_id=project.id, summary={"tests": 100, "failures": 0})

    # Try to query without a project filter (should fail for superadmin)
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/run",
        headers=headers,
    )
    assert response.status_code == 400
    assert "project_id filter is required" in response.text


def test_get_run_list_with_project_filter_for_superadmin(
    flask_app, make_project, make_run, auth_headers
):
    """Test that superadmin queries with project filter work correctly"""
    client, jwt_token = flask_app

    # Create test data
    project = make_project(name="test-project")
    make_run(project_id=project.id, summary={"tests": 100, "failures": 0})

    # Query with a project filter (should succeed)
    query_string = [("filter", f"project_id={project.id}")]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/run",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200
    response_data = response.json()
    assert "runs" in response_data
    assert len(response_data["runs"]) >= 1


# Note: bulk_update tests are not included here because bulk_update() calls
# get_run_list with estimate=True, which uses PostgreSQL-specific EXPLAIN
# functionality that is incompatible with SQLite test databases.
# These tests would require a PostgreSQL database to run properly.


def test_get_run_list_pagination_metadata(flask_app, make_project, make_run, auth_headers):
    """Test get_run_list returns proper pagination metadata"""
    client, jwt_token = flask_app

    # Create test data
    project = make_project(name="test-project")
    for i in range(10):
        make_run(project_id=project.id, summary={"tests": 100, "failures": i})

    # Query with specific page size
    query_string = [
        ("filter", f"project_id={project.id}"),
        ("page", 1),
        ("pageSize", 5),
    ]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/run",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert "runs" in response_data
    assert "pagination" in response_data
    # Should have correct pagination data
    assert response_data["pagination"]["page"] == 1
    assert response_data["pagination"]["pageSize"] == 5
    assert response_data["pagination"]["totalItems"] == 10
    assert response_data["pagination"]["totalPages"] == 2


@pytest.mark.parametrize(
    ("run_data_builder", "needs_project", "expected_error_fragment"),
    [
        # Missing project_id
        (
            lambda _: {
                "summary": {"errors": 0, "failures": 0, "skips": 0, "tests": 100},
                "duration": 100.0,
                "metadata": {"component": "test"},
            },
            False,
            "project",
        ),
        # Invalid/non-existent project
        (
            lambda _: {
                "summary": {"errors": 0, "failures": 0, "skips": 0, "tests": 100},
                "duration": 100.0,
                "project_id": "00000000-0000-0000-0000-000000000000",
                "metadata": {"env": "test"},
            },
            False,
            "project",
        ),
        # Missing metadata/data
        (
            lambda project_id: {"project_id": str(project_id)},
            True,
            "no data supplied",
        ),
    ],
)
def test_add_run_validation_errors(
    flask_app, make_project, auth_headers, run_data_builder, needs_project, expected_error_fragment
):
    """Test add_run validation with various invalid inputs"""
    client, jwt_token = flask_app

    project_id = None
    if needs_project:
        project = make_project(name="test-project")
        project_id = project.id

    run_data = run_data_builder(project_id)

    response = client.post(
        "/api/run",
        headers=auth_headers(jwt_token),
        json=run_data,
    )
    assert response.status_code == 400
    assert expected_error_fragment in response.text.lower()


@patch("ibutsu_server.controllers.run_controller.update_run_task")
def test_update_run_change_project(
    mock_update_run_task, flask_app, make_project, make_run, auth_headers
):
    """Test update_run changing project"""
    client, jwt_token = flask_app

    # Create two projects
    project1 = make_project(name="project-1")
    project2 = make_project(name="project-2")

    # Create run in project1
    run = make_run(project_id=project1.id, summary={"tests": 100})

    # Mock the Celery task
    mock_update_run_task.apply_async.return_value = None

    # Update to project2
    update_data = {"metadata": {"project": project2.name}}
    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/run/{run.id}",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 200

    response_data = response.json()
    assert response_data["project_id"] == str(project2.id)


def test_get_run_list_filter_by_duration(flask_app, make_project, make_run, auth_headers):
    """Test get_run_list with duration filter"""
    client, jwt_token = flask_app

    # Create test data
    project = make_project(name="test-project")
    make_run(project_id=project.id, summary={"tests": 100}, duration=50.0)
    make_run(project_id=project.id, summary={"tests": 200}, duration=150.0)

    query_string = [("filter", f"project_id={project.id}"), ("filter", "duration>100")]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/run",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200

    response_data = response.json()
    # At least the run with duration 150 should match
    for run in response_data["runs"]:
        assert run["duration"] > 100


@pytest.mark.parametrize(
    ("run_id", "expected_status", "description"),
    [
        ("not-a-uuid", 400, "Invalid UUID format triggers validation error"),
        ("00000000-0000-0000-0000-000000000000", 404, "Valid UUID format but run not found"),
    ],
)
def test_get_run_validation(flask_app, auth_headers, run_id, expected_status, description):
    """Test get_run with invalid UUID or non-existent run ID"""
    client, jwt_token = flask_app

    response = client.get(
        f"/api/run/{run_id}",
        headers=auth_headers(jwt_token),
    )
    assert response.status_code == expected_status, description


@patch("ibutsu_server.controllers.run_controller.update_run_task")
def test_add_run_with_env_and_component(
    mock_update_run_task, flask_app, make_project, auth_headers
):
    """Test add_run extracts env and component from metadata"""
    client, jwt_token = flask_app

    project = make_project(name="test-project")

    # Mock the Celery task
    mock_update_run_task.apply_async.return_value = None

    run_data = {
        "summary": {"tests": 100, "failures": 0},
        "duration": 50.0,
        "metadata": {
            "env": "production",
            "component": "web-frontend",
            "extra": "data",
        },
        "project_id": str(project.id),
        "start_time": datetime.now(UTC).isoformat(),
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/run",
        headers=headers,
        json=run_data,
    )
    assert response.status_code == 201

    response_data = response.json()
    assert response_data["env"] == "production"
    assert response_data["component"] == "web-frontend"

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db import db
        from ibutsu_server.db.models import Run

        run = db.session.get(Run, response_data["id"])
        assert run.env == "production"
        assert run.component == "web-frontend"
