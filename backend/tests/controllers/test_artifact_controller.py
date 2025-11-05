from io import BytesIO
from unittest import skip


def test_delete_artifact(flask_app, make_project, make_run, make_result):
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

    headers = {"Authorization": f"Bearer {jwt_token}"}
    response = client.delete(
        f"/api/artifact/{artifact_id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    # Verify artifact was deleted from database
    with client.application.app_context():
        from ibutsu_server.db.models import Artifact

        deleted_artifact = Artifact.query.get(str(artifact_id))
        assert deleted_artifact is None


def test_download_artifact(flask_app, make_project, make_run, make_result):
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

    headers = {
        "Accept": "application/octet-stream",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        f"/api/artifact/{artifact_id}/download",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"
    # Verify content is returned
    assert b"test file content" in response.data


def test_get_artifact(flask_app, make_project, make_run, make_result):
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

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        f"/api/artifact/{artifact_id}",
        headers=headers,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert response_data["filename"] == "test.log"
    assert response_data["result_id"] == result_id


def test_get_artifact_list(flask_app, make_project, make_run, make_result):
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
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.get(
        "/api/artifact",
        headers=headers,
        query_string=query_string,
    )
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"

    response_data = response.get_json()
    assert "artifacts" in response_data
    assert len(response_data["artifacts"]) == 5


@skip("Multipart form data handling needs investigation")
def test_upload_artifact(flask_app, make_project, make_run, make_result):
    """Test case for upload_artifact"""
    client, jwt_token = flask_app

    # Create test data hierarchy
    project = make_project(name="test-project")
    run = make_run(project_id=project.id)
    result = make_result(run_id=run.id, project_id=project.id, test_id="test.example")

    headers = {
        "Accept": "application/json",
        "Content-Type": "multipart/form-data",
        "Authorization": f"Bearer {jwt_token}",
    }
    data = {
        "resultId": str(result.id),
        "filename": "log.txt",
        "additionalMetadata": {"key": "value"},
        "file": (BytesIO(b"filecontent"), "log.txt"),
    }
    response = client.post(
        "/api/artifact",
        headers=headers,
        data=data,
        content_type="multipart/form-data",
    )
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"
