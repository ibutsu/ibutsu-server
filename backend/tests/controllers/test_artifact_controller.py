import json
from io import BytesIO

import pytest

from ibutsu_server.controllers.artifact_controller import upload_artifact
from ibutsu_server.db import db
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Artifact, User


def test_delete_artifact(flask_app, artifact_test_hierarchy, auth_headers):
    """Test case for delete_artifact"""
    client, jwt_token = flask_app
    hierarchy = artifact_test_hierarchy
    result = hierarchy["result"]

    # Create artifact
    with client.application.app_context():
        artifact = Artifact(
            filename="test.log",
            content=b"test content",
            result_id=result.id,
        )
        session.add(artifact)
        session.commit()
        session.refresh(artifact)
        artifact_id = artifact.id

    headers = auth_headers(jwt_token)
    response = client.delete(
        f"/api/artifact/{artifact_id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    # Verify artifact was deleted from database
    with client.application.app_context():
        deleted_artifact = db.session.get(Artifact, str(artifact_id))
        assert deleted_artifact is None


def test_download_artifact(flask_app, artifact_test_hierarchy, auth_headers):
    """Test case for download_artifact"""
    client, jwt_token = flask_app
    hierarchy = artifact_test_hierarchy
    result = hierarchy["result"]

    # Create artifact with content
    with client.application.app_context():
        artifact = Artifact(
            filename="test.log",
            content=b"test file content",
            result_id=result.id,
        )
        session.add(artifact)
        session.commit()
        session.refresh(artifact)
        artifact_id = artifact.id

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/artifact/{artifact_id}/download",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"
    # Verify content is returned
    assert b"test file content" in response.content


def test_get_artifact(flask_app, artifact_test_hierarchy, auth_headers):
    """Test case for get_artifact"""
    client, jwt_token = flask_app
    hierarchy = artifact_test_hierarchy
    result = hierarchy["result"]
    result_id = str(result.id)

    # Create artifact
    with client.application.app_context():
        artifact = Artifact(
            filename="test.log",
            content=b"test content",
            result_id=result_id,
        )
        session.add(artifact)
        session.commit()
        session.refresh(artifact)
        artifact_id = artifact.id

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/artifact/{artifact_id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert response_data["filename"] == "test.log"
    assert response_data["result_id"] == result_id


def test_get_artifact_list(flask_app, artifact_test_hierarchy, auth_headers):
    """Test case for get_artifact_list"""
    client, jwt_token = flask_app
    hierarchy = artifact_test_hierarchy
    result = hierarchy["result"]
    result_id = str(result.id)

    # Create multiple artifacts
    with client.application.app_context():
        for i in range(5):
            artifact = Artifact(
                filename=f"test{i}.log",
                content=b"test content",
                result_id=result_id,
            )
            session.add(artifact)
        session.commit()

    query_string = [("resultId", result_id), ("page", 1), ("pageSize", 56)]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/artifact",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert "artifacts" in response_data
    assert len(response_data["artifacts"]) == 5


def test_upload_artifact(flask_app, artifact_test_hierarchy, auth_headers):
    """Test case for upload_artifact.

    Tests the artifact upload via Flask test request context
    due to Connexion 3's form data validation limitations with multipart file uploads.
    """
    client, _jwt_token = flask_app
    hierarchy = artifact_test_hierarchy
    result = hierarchy["result"]

    # Use Flask test request context for proper request handling
    with client.application.test_request_context(
        "/api/artifact",
        method="POST",
        content_type="multipart/form-data",
        data={
            "resultId": str(result.id),
            "filename": "log.txt",
            "additionalMetadata": json.dumps({"key": "value"}),
            "file": (BytesIO(b"filecontent"), "log.txt"),
        },
    ):
        # Get test user
        test_user = User.query.filter_by(email="test@example.com").first()

        # upload_artifact takes body parameter, but reads from request.files/form
        response_data, status_code = upload_artifact(user=test_user)

        assert status_code == 201, f"Response: {response_data}"
        assert response_data["filename"] == "log.txt"
        assert response_data["result_id"] == str(result.id)
        assert "id" in response_data


def test_view_artifact(flask_app, artifact_test_hierarchy, auth_headers):
    """Test case for view_artifact - streaming artifact to browser"""
    client, jwt_token = flask_app
    hierarchy = artifact_test_hierarchy
    result = hierarchy["result"]

    # Create artifact with content
    with client.application.app_context():
        artifact = Artifact(
            filename="test.txt",
            content=b"test file content for viewing",
            result_id=result.id,
        )
        session.add(artifact)
        session.commit()
        session.refresh(artifact)
        artifact_id = artifact.id

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/artifact/{artifact_id}/view",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"
    # Verify content is returned
    assert b"test file content for viewing" in response.content
    # Content-Type should be set (detected by magic)
    assert "Content-Type" in response.headers


def test_view_artifact_with_run_id(flask_app, make_project, make_run, auth_headers):
    """Test view_artifact for artifact attached to run (not result)"""
    client, jwt_token = flask_app

    # Create test data
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    # Create artifact attached to run (not result)
    with client.application.app_context():
        artifact = Artifact(
            filename="run-artifact.log",
            content=b"run level artifact content",
            run_id=run.id,
            result_id=None,  # Explicitly not attached to result
        )
        session.add(artifact)
        session.commit()
        session.refresh(artifact)
        artifact_id = artifact.id

    headers = auth_headers(jwt_token)
    response = client.get(
        f"/api/artifact/{artifact_id}/view",
        headers=headers,
    )
    assert response.status_code == 200
    assert b"run level artifact content" in response.content


def test_get_artifact_not_found(flask_app, auth_headers):
    """Test get_artifact with non-existent artifact ID"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/artifact/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == 404


def test_get_artifact_invalid_uuid(flask_app, auth_headers):
    """Test get_artifact with invalid UUID format"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/artifact/not-a-uuid",
        headers=headers,
    )
    assert response.status_code == 400  # validate_uuid decorator


def test_delete_artifact_not_found(flask_app, auth_headers):
    """Test delete_artifact with non-existent artifact ID"""
    client, jwt_token = flask_app

    headers = auth_headers(jwt_token)
    response = client.delete(
        "/api/artifact/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert response.status_code == 404


def test_upload_artifact_with_run_id(flask_app, make_project, make_run, auth_headers):
    """Test artifact upload attached to run instead of result"""
    client, _jwt_token = flask_app

    # Create test data
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    # Upload artifact with run_id (not result_id)
    with client.application.test_request_context(
        "/api/artifact",
        method="POST",
        content_type="multipart/form-data",
        data={
            "runId": str(run.id),
            "filename": "run-level.log",
            "file": (BytesIO(b"run artifact content"), "run-level.log"),
        },
    ):
        test_user = User.query.filter_by(email="test@example.com").first()
        response_data, status_code = upload_artifact(user=test_user)

        assert status_code == 201, f"Response: {response_data}"
        assert response_data["filename"] == "run-level.log"
        assert response_data["run_id"] == str(run.id)
        assert response_data.get("result_id") is None


@pytest.mark.parametrize(
    ("data_builder", "needs_hierarchy", "expected_status", "expected_error_fragment"),
    [
        # No file provided
        (
            lambda h: {"resultId": str(h["result"].id), "filename": "test.txt"},
            True,
            400,
            "no file uploaded",
        ),
        # Missing both resultId and runId
        (
            lambda _: {"filename": "test.txt", "file": (BytesIO(b"content"), "test.txt")},
            False,
            400,
            "resultid or runid",
        ),
        # Both resultId and runId provided
        (
            lambda h: {
                "resultId": str(h["result"].id),
                "runId": str(h["run"].id),
                "filename": "test.txt",
                "file": (BytesIO(b"content"), "test.txt"),
            },
            True,
            400,
            "cannot provide both",
        ),
        # Invalid UUID format
        (
            lambda _: {
                "resultId": "not-a-uuid",
                "filename": "test.txt",
                "file": (BytesIO(b"content"), "test.txt"),
            },
            False,
            400,
            "uuid format",
        ),
        # Non-existent result
        (
            lambda _: {
                "resultId": "00000000-0000-0000-0000-000000000000",
                "filename": "test.txt",
                "file": (BytesIO(b"content"), "test.txt"),
            },
            False,
            404,
            "not found",
        ),
        # Invalid JSON metadata
        (
            lambda h: {
                "resultId": str(h["result"].id),
                "filename": "test.txt",
                "additionalMetadata": "not valid json {",
                "file": (BytesIO(b"content"), "test.txt"),
            },
            True,
            400,
            "not valid json",
        ),
        # Array metadata (must be object)
        (
            lambda h: {
                "resultId": str(h["result"].id),
                "filename": "test.txt",
                "additionalMetadata": json.dumps(["not", "an", "object"]),
                "file": (BytesIO(b"content"), "test.txt"),
            },
            True,
            400,
            "json object",
        ),
    ],
)
def test_upload_artifact_validation_errors(
    flask_app,
    artifact_test_hierarchy,
    data_builder,
    needs_hierarchy,
    expected_status,
    expected_error_fragment,
):
    """Test artifact upload validation with various invalid inputs"""
    client, _jwt_token = flask_app

    # Use hierarchy if needed, otherwise pass empty dict
    hierarchy = artifact_test_hierarchy if needs_hierarchy else {}
    upload_data = data_builder(hierarchy)

    with client.application.test_request_context(
        "/api/artifact",
        method="POST",
        content_type="multipart/form-data",
        data=upload_data,
    ):
        test_user = User.query.filter_by(email="test@example.com").first()
        response_data, status_code = upload_artifact(user=test_user)

        assert status_code == expected_status
        assert expected_error_fragment in response_data.lower()


def test_get_artifact_list_by_run_id(flask_app, make_project, make_run, auth_headers):
    """Test get_artifact_list filtered by run_id"""
    client, jwt_token = flask_app

    # Create test data
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)

    # Create artifacts for the run
    with client.application.app_context():
        for i in range(3):
            artifact = Artifact(
                filename=f"run-artifact-{i}.log",
                content=b"content",
                run_id=run.id,
            )
            session.add(artifact)
        session.commit()

    query_string = [("runId", str(run.id)), ("page", 1), ("pageSize", 10)]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/artifact",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.text}"

    response_data = response.json()
    assert "artifacts" in response_data
    assert len(response_data["artifacts"]) == 3


def test_get_artifact_list_pagination(flask_app, artifact_test_hierarchy, auth_headers):
    """Test get_artifact_list with pagination"""
    client, jwt_token = flask_app
    hierarchy = artifact_test_hierarchy
    result = hierarchy["result"]

    # Create many artifacts
    with client.application.app_context():
        for i in range(30):
            artifact = Artifact(
                filename=f"artifact-{i}.log",
                content=b"content",
                result_id=result.id,
            )
            session.add(artifact)
        session.commit()

    # Test pagination
    query_string = [("resultId", str(result.id)), ("page", 1), ("pageSize", 10)]
    headers = auth_headers(jwt_token)
    response = client.get(
        "/api/artifact",
        headers=headers,
        params=query_string,
    )
    assert response.status_code == 200

    response_data = response.json()
    assert len(response_data["artifacts"]) == 10
    assert response_data["pagination"]["totalItems"] == 30
    assert response_data["pagination"]["totalPages"] == 3
