# coding: utf-8
from __future__ import absolute_import

from unittest import skip
from unittest.mock import MagicMock
from unittest.mock import patch

from ibutsu_server.test import BaseTestCase
from ibutsu_server.test import MockArtifact
from six import BytesIO


MOCK_ID = "70202589-4781-4eb9-bcfc-685b1d2c583a"
MOCK_RESULT_ID = "23cd86d5-a27e-45a4-83a3-12c74d219709"
MOCK_ARTIFACT = MockArtifact(
    id=MOCK_ID,
    data={
        "resultId": MOCK_RESULT_ID,
        "filename": "log.txt",
        "contentType": "text/plain",
        "additionalMetadata": {"key": "value"},
    },
    content="filecontent",
)


class TestArtifactController(BaseTestCase):
    """ArtifactController integration test stubs"""

    def setUp(self):
        """Set up a fake MongoDB object"""
        self.session_patcher = patch("ibutsu_server.controllers.artifact_controller.session")
        self.mock_session = self.session_patcher.start()
        self.artifact_patcher = patch("ibutsu_server.controllers.artifact_controller.Artifact")
        self.mock_artifact = self.artifact_patcher.start()
        self.mock_artifact.query.get.return_value = MOCK_ARTIFACT
        self.mock_limit = MagicMock()
        self.mock_limit.return_value.offset.return_value.all.return_value = [MOCK_ARTIFACT]
        self.mock_artifact.query.limit = self.mock_limit
        self.mock_artifact.query.filter.return_value.limit = self.mock_limit
        self.mock_artifact.query.count.return_value = 1
        self.mock_artifact.query.filter.return_value.count.return_value = 1

    def tearDown(self):
        """Teardown the mocks"""
        self.artifact_patcher.stop()
        self.session_patcher.stop()

    def test_delete_artifact(self):
        """Test case for delete_artifact

        Delete an artifact
        """
        headers = {}
        response = self.client.open(
            "/api/artifact/{id}".format(id=MOCK_ID), method="DELETE", headers=headers
        )
        self.mock_artifact.query.get.assert_called_once_with(MOCK_ID)
        self.mock_session.delete.assert_called_once_with(MOCK_ARTIFACT)
        self.mock_session.commit.assert_called_once()
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_download_artifact(self):
        """Test case for download_artifact

        Download an artifact
        """
        headers = {"Accept": "application/octet-stream"}
        response = self.client.open(
            "/api/artifact/{id}/download".format(id=MOCK_ID), method="GET", headers=headers,
        )
        self.mock_artifact.query.get.assert_called_once_with(MOCK_ID)
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_artifact(self):
        """Test case for get_artifact

        Get a single artifact
        """
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/artifact/{id}".format(id=MOCK_ID), method="GET", headers=headers,
        )
        self.mock_artifact.query.get.assert_called_once_with(MOCK_ID)
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_artifact_list(self):
        """Test case for get_artifact_list

        Get a (filtered) list of artifacts
        """
        query_string = [("resultId", MOCK_RESULT_ID), ("page", 56), ("pageSize", 56)]
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/artifact", method="GET", headers=headers, query_string=query_string
        )
        self.mock_limit.return_value.offset.return_value.all.assert_called_once()
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    @skip("multipart/form-data not supported by Connexion")
    def test_upload_artifact(self):
        """Test case for upload_artifact

        Uploads a test run artifact
        """
        headers = {"Accept": "application/json", "Content-Type": "multipart/form-data"}
        data = dict(
            result_id="result_id_example",
            filename="filename_example",
            file=(BytesIO(b"some file data"), "file.txt"),
            additional_metadata=None,
        )
        response = self.client.open(
            "/api/artifact",
            method="POST",
            headers=headers,
            data=data,
            content_type="multipart/form-data",
        )
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))
