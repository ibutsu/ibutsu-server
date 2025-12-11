import pytest


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
        from ibutsu_server.db.models import Result

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
        from ibutsu_server.db import db
        from ibutsu_server.db.models import Result

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
