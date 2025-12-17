import pytest

from ibutsu_server.db import db
from ibutsu_server.db.models import Result


@pytest.mark.integration
def test_add_result(flask_app, make_project, make_run, auth_headers):
    """Test case for add_result"""
    client, jwt_token = flask_app

    # Create project and run
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    result_data = {
        "duration": 6.027456183070403,
        "result": "passed",
        "metadata": {
            "jenkins_build": 145,
            "commit_hash": "F4BA3E12",
            "component": "fake-component",
        },
        "test_id": "test.example",
        "run_id": str(run.id),
        "project_id": str(project.id),
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/result",
        headers=headers,
        json=result_data,
    )
    assert response.status_code == 201, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["result"] == "passed"
    assert response_data["test_id"] == "test.example"

    # Verify in database
    with client.application.app_context():
        result = Result.query.filter_by(test_id="test.example").first()
        assert result is not None
        assert result.result == "passed"


@pytest.mark.integration
def test_get_result(flask_app, result_test_hierarchy, auth_headers):
    """Test case for get_result"""
    client, jwt_token = flask_app
    hierarchy = result_test_hierarchy
    result = hierarchy["result"]

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/result/{result.id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["id"] == str(result.id)
    assert response_data["test_id"] == "test.example"


@pytest.mark.integration
@pytest.mark.parametrize(
    ("page", "page_size"),
    [
        (1, 25),
        (2, 10),
        (1, 56),
    ],
)
def test_get_result_list(
    flask_app, make_project, make_run, make_result, page, page_size, auth_headers
):
    """Test case for get_result_list with pagination"""
    client, jwt_token = flask_app

    # Create test data
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    # Create multiple results
    for i in range(30):
        make_result(
            run_id=run.id, project_id=project.id, test_id=f"test.example.{i}", result="passed"
        )

    query_string = [("page", page), ("pageSize", page_size), ("filter", f"project_id={project.id}")]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/result",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert "results" in response_data
    assert "pagination" in response_data
    assert response_data["pagination"]["page"] == page
    assert response_data["pagination"]["pageSize"] == page_size


@pytest.mark.integration
def test_get_result_list_filter_by_result_status(
    flask_app, make_project, make_run, make_result, auth_headers
):
    """Test case for get_result_list with result status filter"""
    client, jwt_token = flask_app

    # Create test data
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    # Create results with different statuses
    for i in range(5):
        make_result(
            run_id=run.id,
            project_id=project.id,
            test_id=f"test.passed.{i}",
            result="passed",
        )

    for i in range(3):
        make_result(
            run_id=run.id,
            project_id=project.id,
            test_id=f"test.failed.{i}",
            result="failed",
        )

    query_string = [("filter", "result=passed"), ("filter", f"project_id={project.id}")]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/result",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    # Should only return passed results
    assert len(response_data["results"]) >= 5
    for result in response_data["results"]:
        assert result["result"] == "passed"


@pytest.mark.integration
def test_update_result(flask_app, result_test_hierarchy, auth_headers):
    """Test case for update_result"""
    client, jwt_token = flask_app
    hierarchy = result_test_hierarchy
    result = hierarchy["result"]

    update_data = {"result": "failed", "metadata": {"component": "updated-component"}}
    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/result/{result.id}",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["result"] == "failed"

    # Verify in database
    with client.application.app_context():
        updated_result = db.session.get(Result, str(result.id))
        assert updated_result.result == "failed"


@pytest.mark.validation
@pytest.mark.parametrize(
    ("result_id", "expected_status", "description"),
    [
        ("not-a-uuid", 400, "Invalid UUID format triggers validation error"),
        ("00000000-0000-0000-0000-000000000000", 404, "Valid UUID format but result not found"),
    ],
)
def test_update_result_validation_errors(
    flask_app, result_id, expected_status, description, auth_headers
):
    """Test case for update_result validation errors - parametrized"""
    client, jwt_token = flask_app

    update_data = {"result": "failed"}
    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/result/{result_id}",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == expected_status, description


@pytest.mark.validation
@pytest.mark.parametrize(
    ("result_id", "expected_status", "description"),
    [
        ("not-a-uuid", 400, "Invalid UUID format triggers validation error"),
        ("00000000-0000-0000-0000-000000000000", 404, "Valid UUID format but result not found"),
    ],
)
def test_get_result_validation_errors(
    flask_app, result_id, expected_status, description, auth_headers
):
    """Test case for get_result validation errors - parametrized"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/result/{result_id}",
        headers=headers,
    )
    assert response.status_code == expected_status, description


@pytest.mark.validation
def test_get_result_list_requires_project_filter_for_superadmin(
    flask_app, make_project, make_run, make_result, auth_headers
):
    """Test that superadmin queries without project filter are rejected"""
    client, jwt_token = flask_app

    # Create some test data
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)
    make_result(run_id=run.id, project_id=project.id, test_id="test.example", result="passed")

    # Try to query without a project filter (should fail for superadmin)
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/result",
        headers=headers,
    )
    assert response.status_code == 400
    assert "project_id filter is required" in response.text


@pytest.mark.integration
def test_get_result_list_with_project_filter_for_superadmin(
    flask_app, make_project, make_run, make_result, auth_headers
):
    """Test that superadmin queries with project filter work correctly"""
    client, jwt_token = flask_app

    # Create test data
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)
    make_result(run_id=run.id, project_id=project.id, test_id="test.example", result="passed")

    # Query with a project filter (should succeed)
    query_string = [("filter", f"project_id={project.id}")]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/result",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200
    response_data = response.json()
    assert "results" in response_data
    assert len(response_data["results"]) >= 1


@pytest.mark.integration
def test_add_result_with_invalid_project(flask_app, make_run, auth_headers):
    """Test add_result with invalid project ID"""
    client, jwt_token = flask_app

    # Create run without valid project
    result_data = {
        "duration": 1.0,
        "result": "passed",
        "test_id": "test.example",
        "project_id": "00000000-0000-0000-0000-000000000000",  # Invalid project
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/result",
        headers=headers,
        json=result_data,
    )
    assert response.status_code == 400
    assert "Invalid project" in response.text


@pytest.mark.integration
def test_add_result_missing_project(flask_app, auth_headers):
    """Test add_result without project_id or project in metadata"""
    client, jwt_token = flask_app

    result_data = {
        "duration": 1.0,
        "result": "passed",
        "test_id": "test.example",
        # No project_id or metadata.project
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/result",
        headers=headers,
        json=result_data,
    )
    assert response.status_code == 400
    assert "project" in response.text.lower()


@pytest.mark.integration
def test_add_result_duplicate_id(flask_app, result_test_hierarchy, auth_headers):
    """Test add_result with duplicate result ID"""
    client, jwt_token = flask_app

    hierarchy = result_test_hierarchy
    existing_result = hierarchy["result"]
    project = hierarchy["project"]

    result_data = {
        "id": str(existing_result.id),  # Use existing ID
        "duration": 1.0,
        "result": "passed",
        "test_id": "test.duplicate",
        "project_id": str(project.id),
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/result",
        headers=headers,
        json=result_data,
    )
    assert response.status_code == 400
    assert "already exist" in response.text


@pytest.mark.integration
def test_add_result_with_metadata_project(flask_app, make_project, make_run, auth_headers):
    """Test add_result using project name in metadata instead of project_id"""
    client, jwt_token = flask_app

    project = make_project(name="meta-project")
    run = make_run(project_id=project.id)

    result_data = {
        "duration": 1.0,
        "result": "passed",
        "test_id": "test.metadata",
        "run_id": str(run.id),
        "metadata": {"project": "meta-project"},  # Project in metadata
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/result",
        headers=headers,
        json=result_data,
    )
    assert response.status_code == 201

    response_data = response.json()
    assert response_data["project_id"] == str(project.id)


@pytest.mark.integration
def test_update_result_merge_metadata(flask_app, make_project, make_run, make_result, auth_headers):
    """Test update_result merges metadata instead of replacing"""
    client, jwt_token = flask_app

    project = make_project(name="metadata-project")
    run = make_run(project_id=project.id)

    # Create a result with initial metadata
    initial_metadata = {
        "jenkins_build": 145,
        "commit_hash": "F4BA3E12",
        "component": "original-component",
    }
    result = make_result(
        run_id=run.id,
        project_id=project.id,
        test_id="test.metadata.merge",
        result="passed",
        metadata=initial_metadata,
    )

    # Update with new metadata - should merge with existing
    update_data = {
        "metadata": {
            "component": "updated-component",  # This should update existing key
            "new_field": "new_value",  # This should be added
        }
    }

    headers = auth_headers(jwt_token)
    response = client.put(
        f"/api/result/{result.id}",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    # Verify merged metadata in response
    response_data = response.json()
    assert "metadata" in response_data
    metadata = response_data["metadata"]

    # Original keys should still exist
    assert metadata["jenkins_build"] == 145
    assert metadata["commit_hash"] == "F4BA3E12"

    # Updated key should have new value
    assert metadata["component"] == "updated-component"

    # New key should be added
    assert metadata["new_field"] == "new_value"

    # Verify in database
    with client.application.app_context():
        updated_result = db.session.get(Result, str(result.id))
        db_metadata = updated_result.data

        assert db_metadata["jenkins_build"] == 145
        assert db_metadata["commit_hash"] == "F4BA3E12"
        assert db_metadata["component"] == "updated-component"
        assert db_metadata["new_field"] == "new_value"


@pytest.mark.integration
@pytest.mark.parametrize(
    "result_status",
    ["passed", "failed", "error", "skipped", "xfailed", "xpassed"],
)
def test_add_result_different_statuses(
    flask_app, make_project, make_run, auth_headers, result_status
):
    """Test add_result with different result statuses"""
    client, jwt_token = flask_app

    project = make_project(name="status-project")
    run = make_run(project_id=project.id)

    result_data = {
        "duration": 1.0,
        "result": result_status,
        "test_id": f"test.{result_status}",
        "run_id": str(run.id),
        "project_id": str(project.id),
    }

    headers = auth_headers(jwt_token)
    response = client.post(
        "/api/result",
        headers=headers,
        json=result_data,
    )
    assert response.status_code == 201

    response_data = response.json()
    assert response_data["result"] == result_status


def test_add_result_non_json(flask_app, headers_without_json):
    """Test add_result with non-JSON content type"""
    client, jwt_token = flask_app

    headers = headers_without_json(jwt_token)
    response = client.post(
        "/api/result",
        headers=headers,
        data="not json",
    )
    assert response.status_code in [400, 415]


def test_update_result_non_json(flask_app, result_test_hierarchy, headers_without_json):
    """Test update_result with non-JSON content type"""
    client, jwt_token = flask_app

    hierarchy = result_test_hierarchy
    result = hierarchy["result"]

    headers = headers_without_json(jwt_token)
    response = client.put(
        f"/api/result/{result.id}",
        headers=headers,
        data="not json",
    )
    assert response.status_code in [400, 415]


@pytest.mark.integration
def test_update_result_not_found(flask_app, auth_headers):
    """Test update_result for non-existent result"""
    client, jwt_token = flask_app

    update_data = {"result": "failed"}
    headers = auth_headers(jwt_token)
    response = client.put(
        "/api/result/00000000-0000-0000-0000-000000000000",
        headers=headers,
        json=update_data,
    )
    assert response.status_code == 404


@pytest.mark.integration
def test_get_result_list_with_duration_filter(
    flask_app, make_project, make_run, make_result, auth_headers
):
    """Test get_result_list with duration filter"""
    client, jwt_token = flask_app

    project = make_project(name="filter-project")
    run = make_run(project_id=project.id)

    # Create diverse results
    make_result(
        run_id=run.id,
        project_id=project.id,
        test_id="test.example.1",
        result="passed",
        duration=1.5,
    )
    make_result(
        run_id=run.id, project_id=project.id, test_id="other.test", result="failed", duration=0.3
    )

    query_string = [("filter", "duration>0.5"), ("filter", f"project_id={project.id}")]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/result",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200

    response_data = response.json()
    # Should return filtered results
    assert "results" in response_data


@pytest.mark.integration
def test_get_result_not_found(flask_app, auth_headers):
    """Test get_result for non-existent result"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/result/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == 404
