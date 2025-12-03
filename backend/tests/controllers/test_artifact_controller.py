import json


def test_delete_artifact(flask_app, make_project, make_run, make_result, auth_headers):
    """Test case for delete_artifact"""
    client, jwt_token = flask_app

    # Create test data hierarchy
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)
    result = make_result(run_id=run.id, project_id=project.id, test_id="test.example")

    # Create artifact
    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Artifact

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
        from ibutsu_server.db import db
        from ibutsu_server.db.models import Artifact

        deleted_artifact = db.session.get(Artifact, str(artifact_id))
        assert deleted_artifact is None


def test_download_artifact(flask_app, make_project, make_run, make_result, auth_headers):
    """Test case for download_artifact"""
    client, jwt_token = flask_app

    # Create test data hierarchy
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)
    result = make_result(run_id=run.id, project_id=project.id, test_id="test.example")

    # Create artifact with content
    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Artifact

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


def test_get_artifact(flask_app, make_project, make_run, make_result, auth_headers):
    """Test case for get_artifact"""
    client, jwt_token = flask_app

    # Create test data hierarchy
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)
    result = make_result(run_id=run.id, project_id=project.id, test_id="test.example")
    result_id = str(result.id)

    # Create artifact
    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Artifact

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


def test_get_artifact_list(flask_app, make_project, make_run, make_result, auth_headers):
    """Test case for get_artifact_list"""
    client, jwt_token = flask_app

    # Create test data hierarchy
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)
    result = make_result(run_id=run.id, project_id=project.id, test_id="test.example")
    result_id = str(result.id)

    # Create multiple artifacts
    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Artifact

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


def test_upload_artifact(flask_app, make_project, make_run, make_result, auth_headers):
    """Test case for upload_artifact.

    Tests the artifact upload via Flask test request context
    due to Connexion 3's form data validation limitations with multipart file uploads.
    """
    client, _jwt_token = flask_app

    # Create test data hierarchy
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)
    result = make_result(run_id=run.id, project_id=project.id, test_id="test.example")

    from io import BytesIO

    from ibutsu_server.controllers.artifact_controller import upload_artifact
    from ibutsu_server.db.models import User

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
