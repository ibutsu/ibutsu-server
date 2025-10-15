from io import BytesIO
from unittest import skip
from unittest.mock import MagicMock, patch

import pytest

from tests.conftest import MOCK_ARTIFACT_ID, MOCK_RESULT_ID
from tests.test_util import MockArtifact, MockResult

MOCK_ARTIFACT = MockArtifact(
    id=MOCK_ARTIFACT_ID,
    data={
        "resultId": MOCK_RESULT_ID,
        "filename": "log.txt",
        "contentType": "text/plain",
        "additionalMetadata": {"key": "value"},
    },
    content="filecontent",
    result=MockResult(id=MOCK_RESULT_ID),
)


@pytest.fixture
def artifact_controller_mocks():
    """Mocks for the artifact controller tests"""
    with (
        patch("ibutsu_server.controllers.artifact_controller.session") as mock_session,
        patch(
            "ibutsu_server.controllers.artifact_controller.project_has_user"
        ) as mock_project_has_user,
        patch("ibutsu_server.controllers.artifact_controller.Artifact") as mock_artifact_class,
        patch(
            "ibutsu_server.controllers.artifact_controller.add_user_filter"
        ) as mock_add_user_filter,
    ):
        mock_project_has_user.return_value = True
        mock_artifact_class.return_value = MOCK_ARTIFACT
        mock_artifact_class.query.get.return_value = MOCK_ARTIFACT
        mock_limit = MagicMock()
        mock_limit.return_value.offset.return_value.all.return_value = [MOCK_ARTIFACT]
        mock_artifact_class.query.limit = mock_limit
        mock_artifact_class.query.filter.return_value.limit = mock_limit
        mock_artifact_class.query.count.return_value = 1
        mock_artifact_class.query.filter.return_value.count.return_value = 1
        mock_add_user_filter.side_effect = lambda query, _user: query

        yield {
            "session": mock_session,
            "project_has_user": mock_project_has_user,
            "artifact_class": mock_artifact_class,
            "add_user_filter": mock_add_user_filter,
            "limit": mock_limit,
        }


def test_delete_artifact(flask_app, artifact_controller_mocks):
    """Test case for delete_artifact"""
    client, jwt_token = flask_app
    mocks = artifact_controller_mocks
    headers = {"Authorization": f"Bearer {jwt_token}"}
    response = client.open(f"/api/artifact/{MOCK_ARTIFACT_ID}", method="DELETE", headers=headers)
    mocks["artifact_class"].query.get.assert_called_once_with(MOCK_ARTIFACT_ID)
    mocks["session"].delete.assert_called_once_with(MOCK_ARTIFACT)
    mocks["session"].commit.assert_called_once()
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_download_artifact(flask_app, artifact_controller_mocks):
    """Test case for download_artifact"""
    client, jwt_token = flask_app
    mocks = artifact_controller_mocks
    headers = {
        "Accept": "application/octet-stream",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/artifact/{MOCK_ARTIFACT_ID}/download",
        method="GET",
        headers=headers,
    )
    mocks["artifact_class"].query.get.assert_called_once_with(MOCK_ARTIFACT_ID)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_get_artifact(flask_app, artifact_controller_mocks):
    """Test case for get_artifact"""
    client, jwt_token = flask_app
    mocks = artifact_controller_mocks
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/artifact/{MOCK_ARTIFACT_ID}",
        method="GET",
        headers=headers,
    )
    mocks["artifact_class"].query.get.assert_called_once_with(MOCK_ARTIFACT_ID)
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_get_artifact_list(flask_app, artifact_controller_mocks):
    """Test case for get_artifact_list"""
    client, jwt_token = flask_app
    mocks = artifact_controller_mocks
    query_string = [("resultId", MOCK_RESULT_ID), ("page", 56), ("pageSize", 56)]
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/artifact", method="GET", headers=headers, query_string=query_string
    )
    mocks["limit"].return_value.offset.return_value.all.assert_called_once()
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


@skip("Something is getting crossed in the validation layer")
def test_upload_artifact(flask_app, artifact_controller_mocks):
    """Test case for upload_artifact"""
    client, jwt_token = flask_app
    headers = {
        "Accept": "application/json",
        "Content-Type": "multipart/form-data",
        "Authorization": f"Bearer {jwt_token}",
    }
    data = {
        "resultId": MOCK_ARTIFACT_ID,
        "filename": "log.txt",
        "additionalMetadata": {"key": "value"},
        "file": (BytesIO(b"filecontent"), "log.txt"),
    }
    response = client.open(
        "/api/artifact",
        method="POST",
        headers=headers,
        data=data,
        content_type="multipart/form-data",
    )
    assert response.status_code == 201, f"Response body is : {response.data.decode('utf-8')}"
