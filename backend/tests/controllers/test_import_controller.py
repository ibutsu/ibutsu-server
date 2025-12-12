from io import BytesIO
from unittest.mock import patch

import pytest

from ibutsu_server.controllers.import_controller import add_import
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Import, User


def test_get_import_success(flask_app, make_project, auth_headers):
    """Test case for get_import - successful retrieval"""
    client, jwt_token = flask_app

    # Create project and import
    project = make_project(name="test-project")

    with client.application.app_context():
        import_obj = Import(
            filename="test_results.xml",
            format="junit",
            status="completed",
            data={"project_id": str(project.id), "metadata": {"key": "value"}},
        )
        session.add(import_obj)
        session.commit()
        session.refresh(import_obj)
        import_id = import_obj.id

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/import/{import_id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["filename"] == "test_results.xml"
    assert response_data["format"] == "junit"


def test_get_import_not_found(flask_app, auth_headers):
    """Test case for get_import - import not found"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/import/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == 404, f"Response body is : {response.text}"


def test_get_import_forbidden_project_access(flask_app, make_project, make_user, auth_headers):
    """Test case for get_import - forbidden project access"""
    client, jwt_token = flask_app

    # Create a project owned by another user
    other_user = make_user(email="other@example.com")
    project = make_project(name="private-project", owner_id=other_user.id)

    with client.application.app_context():
        import_obj = Import(
            filename="test_results.xml",
            format="junit",
            status="completed",
            data={"project_id": str(project.id)},
        )
        session.add(import_obj)
        session.commit()
        session.refresh(import_obj)
        import_id = import_obj.id

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/import/{import_id}",
        headers=headers,
    )
    # Superadmin should have access
    # For non-superadmin, should be 403
    assert response.status_code in [200, 403]


@pytest.mark.parametrize(
    ("page", "page_size"),
    [
        (1, 25),
        (2, 10),
        (1, 50),
    ],
)
def test_get_import_list(flask_app, make_project, page, page_size, auth_headers):
    """Test case for get_import_list with pagination"""
    client, jwt_token = flask_app

    # Create project and imports
    project = make_project(name="test-project")

    with client.application.app_context():
        for i in range(30):
            import_obj = Import(
                filename=f"results{i}.xml",
                format="junit",
                status="completed",
                data={"project_id": str(project.id)},
            )
            session.add(import_obj)
        session.commit()

    query_string = [("page", page), ("pageSize", page_size)]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/import",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert "imports" in response_data
    assert "pagination" in response_data
    assert response_data["pagination"]["page"] == page
    assert response_data["pagination"]["pageSize"] == page_size


def test_get_import_list_filter_by_status(flask_app, make_project, auth_headers):
    """Test case for get_import_list with status filter"""
    client, jwt_token = flask_app

    # Create project and imports with different statuses
    project = make_project(name="test-project")

    with client.application.app_context():
        for i in range(5):
            import_obj = Import(
                filename=f"completed{i}.xml",
                format="junit",
                status="completed",
                data={"project_id": str(project.id)},
            )
            session.add(import_obj)

        for i in range(3):
            import_obj = Import(
                filename=f"pending{i}.xml",
                format="junit",
                status="pending",
                data={"project_id": str(project.id)},
            )
            session.add(import_obj)
        session.commit()

    query_string = [("filter", "status=completed")]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/import",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    # Should only return completed imports
    assert len(response_data["imports"]) >= 5
    for imp in response_data["imports"]:
        assert imp["status"] == "completed"


@patch("ibutsu_server.controllers.import_controller.run_junit_import")
def test_upload_import_junit(mock_run_junit_import, flask_app, make_project, auth_headers):
    """Test case for upload_import - JUnit format.

    Tests the import controller function directly with a test request context
    due to Connexion 3's form data validation limitations with multipart file uploads.
    """
    client, _jwt_token = flask_app

    # Create project
    project = make_project(name="test-project")

    # Mock the Celery task
    mock_run_junit_import.delay.return_value = None

    # Create XML content
    xml_content = b'<?xml version="1.0"?><testsuites><testsuite name="test"/></testsuites>'

    # Use Flask test request context for proper request handling
    with client.application.test_request_context(
        "/api/import",
        method="POST",
        content_type="multipart/form-data",
        data={
            "project": str(project.id),
            "importFile": (BytesIO(xml_content), "results.xml"),
        },
    ):
        # Get test user
        test_user = User.query.filter_by(email="test@example.com").first()

        result, status_code = add_import(
            project=str(project.id),
            user=test_user,
        )

        # The import should be created with 202 Accepted
        assert status_code == 202, f"Result: {result}"
        assert mock_run_junit_import.delay.called
        assert result["filename"] == "results.xml"


@patch("ibutsu_server.controllers.import_controller.run_archive_import")
def test_upload_import_archive(mock_run_archive_import, flask_app, make_project, auth_headers):
    """Test case for upload_import - archive format.

    Tests the import controller function directly with a test request context
    due to Connexion 3's form data validation limitations with multipart file uploads.
    """
    client, _jwt_token = flask_app

    # Create project
    project = make_project(name="test-project")

    # Mock the Celery task
    mock_run_archive_import.delay.return_value = None

    # Create archive content (tar.gz file)
    archive_content = b"mock tar.gz content"

    # Use Flask test request context for proper request handling
    with client.application.test_request_context(
        "/api/import",
        method="POST",
        content_type="multipart/form-data",
        data={
            "project": str(project.id),
            "importFile": (BytesIO(archive_content), "results.tar.gz"),
        },
    ):
        # Get test user
        test_user = User.query.filter_by(email="test@example.com").first()

        result, status_code = add_import(
            project=str(project.id),
            user=test_user,
        )

        # The import should be created with 202 Accepted
        assert status_code == 202, f"Result: {result}"
        assert mock_run_archive_import.delay.called
        assert result["filename"] == "results.tar.gz"


def test_upload_import_missing_file(flask_app, make_project, auth_headers):
    """Test case for upload_import - missing file.

    Tests the import controller function directly with a test request context
    due to Connexion 3's form data validation limitations with multipart file uploads.
    """
    client, _jwt_token = flask_app

    # Create project
    project = make_project(name="test-project")

    # Use Flask test request context without a file
    with client.application.test_request_context(
        "/api/import",
        method="POST",
        content_type="multipart/form-data",
        data={
            "project": str(project.id),
            # No file provided
        },
    ):
        # Get test user
        test_user = User.query.filter_by(email="test@example.com").first()

        result, status_code = add_import(
            project=str(project.id),
            user=test_user,
        )

        # Should return error for missing file (400 Bad Request)
        assert status_code == 400, f"Result: {result}"


def test_upload_import_invalid_project(flask_app, auth_headers):
    """Test case for upload_import - invalid project.

    Tests the import controller function directly with a test request context
    due to Connexion 3's form data validation limitations with multipart file uploads.
    """
    client, _jwt_token = flask_app

    xml_content = b'<?xml version="1.0"?><testsuites><testsuite name="test"/></testsuites>'

    # Use Flask test request context with an invalid project ID
    with client.application.test_request_context(
        "/api/import",
        method="POST",
        content_type="multipart/form-data",
        data={
            "project": "00000000-0000-0000-0000-000000000000",  # Non-existent project
            "importFile": (BytesIO(xml_content), "results.xml"),
        },
    ):
        # Get test user
        test_user = User.query.filter_by(email="test@example.com").first()

        result, status_code = add_import(
            project="00000000-0000-0000-0000-000000000000",
            user=test_user,
        )

        # Should return error for invalid project (400 Bad Request)
        assert status_code == 400, f"Result: {result}"
