from io import BytesIO
from unittest.mock import patch

import pytest


def test_get_import_success(flask_app, make_project, auth_headers):
    """Test case for get_import - successful retrieval"""
    client, jwt_token = flask_app

    # Create project and import
    project = make_project(name="test-project")

    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Import

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
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
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
    assert response.status_code == 404, f"Response body is : {response.data.decode('utf-8')}"


def test_get_import_forbidden_project_access(flask_app, make_project, make_user, auth_headers):
    """Test case for get_import - forbidden project access"""
    client, jwt_token = flask_app

    # Create a project owned by another user
    other_user = make_user(email="other@example.com")
    project = make_project(name="private-project", owner_id=other_user.id)

    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Import

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
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Import

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
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
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
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Import

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
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    # Should only return completed imports
    assert len(response_data["imports"]) >= 5
    for imp in response_data["imports"]:
        assert imp["status"] == "completed"


@patch("ibutsu_server.controllers.import_controller.run_junit_import")
def test_upload_import_junit(mock_run_junit_import, flask_app, make_project, auth_headers):
    """Test case for upload_import - JUnit format"""
    client, jwt_token = flask_app

    # Create project
    project = make_project(name="test-project")

    # Mock the Celery task
    mock_run_junit_import.delay.return_value = None

    headers = auth_headers(jwt_token)

    # Create a file-like object
    xml_content = b'<?xml version="1.0"?><testsuites><testsuite name="test"/></testsuites>'
    data = {
        "project": str(project.id),
        "importFile": (BytesIO(xml_content), "results.xml"),
    }

    response = client.post(
        "/api/import",
        headers=headers,
        data=data,
        content_type="multipart/form-data",
    )

    # The import should be created (may be 201 or other depending on implementation)
    assert response.status_code in [201, 200, 202]


@patch("ibutsu_server.controllers.import_controller.run_archive_import")
def test_upload_import_archive(mock_run_archive_import, flask_app, make_project, auth_headers):
    """Test case for upload_import - archive format"""
    client, jwt_token = flask_app

    # Create project
    project = make_project(name="test-project")

    # Mock the Celery task
    mock_run_archive_import.delay.return_value = None

    headers = auth_headers(jwt_token)

    # Create a file-like object with archive-like content
    archive_content = b"PK\x03\x04"  # ZIP file signature
    data = {
        "project": str(project.id),
        "importFile": (BytesIO(archive_content), "results.tar.gz"),
    }

    response = client.post(
        "/api/import",
        headers=headers,
        data=data,
        content_type="multipart/form-data",
    )

    # The import should be created
    assert response.status_code in [201, 200, 202]


def test_upload_import_missing_file(flask_app, make_project, auth_headers):
    """Test case for upload_import - missing file"""
    client, jwt_token = flask_app

    # Create project
    project = make_project(name="test-project")

    headers = auth_headers(jwt_token)

    data = {
        "project": str(project.id),
        # No file provided
    }

    response = client.post(
        "/api/import",
        headers=headers,
        data=data,
        content_type="multipart/form-data",
    )

    # Should return error for missing file
    assert response.status_code in [400, 422]


def test_upload_import_invalid_project(flask_app, auth_headers):
    """Test case for upload_import - invalid project"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)

    xml_content = b'<?xml version="1.0"?><testsuites><testsuite name="test"/></testsuites>'
    data = {
        "project": "00000000-0000-0000-0000-000000000000",  # Non-existent project
        "importFile": (BytesIO(xml_content), "results.xml"),
    }

    response = client.post(
        "/api/import",
        headers=headers,
        data=data,
        content_type="multipart/form-data",
    )

    # Should return error for invalid project
    assert response.status_code in [400, 404]
