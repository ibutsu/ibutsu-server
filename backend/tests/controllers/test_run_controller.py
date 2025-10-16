from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from flask import json


@patch("ibutsu_server.controllers.run_controller.update_run_task")
def test_add_run(mock_update_run_task, flask_app, make_project):
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
        "start_time": datetime.now(timezone.utc).isoformat(),
    }

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.post(
        "/api/run",
        headers=headers,
        data=json.dumps(run_data),
        content_type="application/json",
    )
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["summary"]["tests"] == 548
    assert response_data["summary"]["failures"] == 3

    # Verify task was triggered
    mock_update_run_task.apply_async.assert_called_once()


def test_get_run(flask_app, make_project, make_run):
    """Test case for get_run"""
    client, jwt_token = flask_app

    # Create test data
    project = make_project(name="test-project")
    run = make_run(
        project_id=project.id,
        summary={"errors": 1, "failures": 3, "skips": 0, "tests": 548},
        duration=540.05433,
    )

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        f"/api/run/{run.id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
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
def test_get_run_list(flask_app, make_project, make_run, page, page_size):
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

    query_string = [("page", page), ("pageSize", page_size)]
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        "/api/run",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert "runs" in response_data
    assert "pagination" in response_data
    assert response_data["pagination"]["page"] == page
    assert response_data["pagination"]["pageSize"] == page_size


def test_get_run_list_filter_by_project(flask_app, make_project, make_run):
    """Test case for get_run_list with project filter"""
    client, jwt_token = flask_app

    # Create two projects with runs
    project1 = make_project(name="project-1")
    project2 = make_project(name="project-2")

    run1 = make_run(project_id=project1.id, metadata={"project": "1"})
    run2 = make_run(project_id=project2.id, metadata={"project": "2"})

    query_string = [("filter", f"project_id={project1.id}")]
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        "/api/run",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    # Should only return runs from project1
    run_ids = [r["id"] for r in response_data["runs"]]
    assert str(run1.id) in run_ids
    assert str(run2.id) not in run_ids


@patch("ibutsu_server.controllers.run_controller.update_run_task")
def test_update_run(mock_update_run_task, flask_app, make_project, make_run):
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
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.put(
        f"/api/run/{run.id}",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["summary"]["failures"] == 5

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db.models import Run

        updated_run = Run.query.get(str(run.id))
        assert updated_run.summary["failures"] == 5


def test_update_run_not_found(flask_app):
    """Test case for update_run - run not found"""
    client, jwt_token = flask_app

    update_data = {"summary": {"tests": 100}}
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.put(
        "/api/run/00000000-0000-0000-0000-000000000000",
        headers=headers,
        data=json.dumps(update_data),
        content_type="application/json",
    )
    assert response.status_code == 404
