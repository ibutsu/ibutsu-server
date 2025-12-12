"""
Utility fixtures for common test patterns.

This module provides fixtures for HTTP headers, pagination test cases,
and other common testing utilities.
"""

from unittest.mock import patch

import pytest

# ============================================================================
# UTILITY FIXTURES - HTTP headers, pagination, and common test patterns
# ============================================================================


@pytest.fixture
def pagination_test_cases():
    """Common pagination test cases."""
    return [
        (1, 25),
        (2, 10),
        (1, 50),
        (3, 5),
    ]


@pytest.fixture
def http_headers():
    """Standard HTTP headers for API requests."""
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


@pytest.fixture
def auth_headers(http_headers):
    """HTTP headers with authorization."""
    # This will be set by individual tests that need authentication
    return lambda token: {**http_headers, "Authorization": f"Bearer {token}"}


@pytest.fixture
def headers_without_json(auth_headers):
    """
    HTTP headers with authorization but without Content-Type: application/json.

    Useful for testing endpoints that require JSON content type.

    Example:
        def test_endpoint_requires_json(flask_app, headers_without_json):
            client, jwt_token = flask_app
            headers = headers_without_json(jwt_token)
            response = client.post('/api/endpoint', headers=headers, data='not json')
            assert response.status_code in [400, 415]
    """
    return lambda token: {k: v for k, v in auth_headers(token).items() if k != "Content-Type"}


@pytest.fixture
def mocked_celery():
    """Mock Celery app for testing."""
    with patch("ibutsu_server.tasks.celery") as mock:
        yield mock


# ============================================================================
# CONNEXION 3 HELPERS - Working with httpx responses
# ============================================================================


def get_json(response):
    """
    Extract JSON from Connexion 3 (httpx) response.

    Connexion 3 uses httpx which has response.json() method (not get_json()).
    This helper provides a consistent interface.

    Args:
        response: httpx.Response object from Connexion 3 test client

    Returns:
        dict: Parsed JSON response

    Example:
        response = client.get('/api/health')
        data = get_json(response)
    """
    return response.json()


def get_text(response):
    """
    Get response text from Connexion 3 (httpx) response.

    Args:
        response: httpx.Response object from Connexion 3 test client

    Returns:
        str: Response text

    Example:
        response = client.get('/api/health')
        text = get_text(response)
    """
    return response.text


@pytest.fixture
def json_response():
    """Fixture that provides helper to extract JSON from responses."""
    return get_json


# ============================================================================
# COMPOSITE FIXTURES - Common test data hierarchies
# ============================================================================


@pytest.fixture
def artifact_test_hierarchy(make_project, make_run, make_result):
    """
    Create project -> run -> result hierarchy for artifact tests.

    Returns a dictionary with project, run, and result objects.
    This reduces boilerplate in artifact controller tests.

    Example:
        def test_artifact_upload(artifact_test_hierarchy):
            hierarchy = artifact_test_hierarchy
            artifact = make_artifact(result_id=hierarchy["result"].id)
            assert artifact.result_id == hierarchy["result"].id
    """
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)
    result = make_result(run_id=run.id, project_id=project.id, test_id="test.example")
    return {"project": project, "run": run, "result": result}


@pytest.fixture
def result_test_hierarchy(make_project, make_run, make_result):
    """
    Create project -> run -> result hierarchy for result controller tests.

    Returns a dictionary with project, run, and result objects.
    This reduces boilerplate in result controller tests.

    Example:
        def test_update_result(result_test_hierarchy):
            hierarchy = result_test_hierarchy
            result = hierarchy["result"]
            # Update result logic here
    """
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)
    result = make_result(run_id=run.id, project_id=project.id, test_id="test.example")
    return {"project": project, "run": run, "result": result}


@pytest.fixture
def widget_test_hierarchy(make_project, make_widget_config):
    """
    Create project -> widget_config hierarchy for widget tests.

    Returns a dictionary with project and widget_config objects.
    This reduces boilerplate in widget controller tests.

    Example:
        def test_widget_config(widget_test_hierarchy):
            hierarchy = widget_test_hierarchy
            widget = hierarchy["widget_config"]
            project = hierarchy["project"]
            # Test widget logic here
    """
    project = make_project(name="test-project")
    widget_config = make_widget_config(
        project_id=project.id, widget="run-aggregator", params={"weeks": 4}
    )
    return {"project": project, "widget_config": widget_config}


@pytest.fixture
def temp_config(flask_app):
    """
    Temporarily modify Flask app configuration with automatic cleanup.

    Provides a function to set config values that will be automatically
    restored to their original values after the test completes.

    Example:
        def test_with_disabled_login(temp_config):
            temp_config("USER_LOGIN_ENABLED", False)
            # ... test logic
            # Config will be restored automatically

    Args:
        flask_app: The flask_app fixture

    Returns:
        callable: Function to set config values
    """
    client, _ = flask_app
    original_values = {}

    def _set(key, value):
        if key not in original_values:
            original_values[key] = client.application.config.get(key)
        client.application.config[key] = value

    yield _set

    # Restore original values
    for key, value in original_values.items():
        if value is None:
            client.application.config.pop(key, None)
        else:
            client.application.config[key] = value


@pytest.fixture
def set_user_password(flask_app):
    """
    Helper to set user password in tests.

    Provides a function to set a user's password within the proper
    application context and commit to the database.

    Example:
        def test_login(make_user, set_user_password):
            user = make_user(email="test@example.com")
            set_user_password(user, "secret123")
            # ... test login with this password

    Args:
        flask_app: The flask_app fixture

    Returns:
        callable: Function to set user password
    """
    client, _ = flask_app

    def _set_password(user, password):
        with client.application.app_context():
            from ibutsu_server.db.base import session

            user.password = password
            session.commit()

    return _set_password
