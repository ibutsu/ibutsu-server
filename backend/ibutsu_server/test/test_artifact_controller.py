# coding: utf-8
from __future__ import absolute_import

from unittest import skip
from unittest.mock import MagicMock
from unittest.mock import patch

from bson import ObjectId
from ibutsu_server.test import BaseTestCase
from six import BytesIO


class MockArtifact(object):
    def __init__(self, id_, result_id, filename, additional_metadata, content_type, file_contents):
        self._id = ObjectId(id_)
        self.filename = filename
        self.content_type = content_type
        self.metadata = {"resultId": result_id, "additionalMetadata": additional_metadata}
        self._file_contents = file_contents

    def read(self):
        return self._file_contents


MOCK_ID = "507f1f77bcf86cd799439011"
MOCK_ARTIFACT = MockArtifact(
    MOCK_ID, "cd7994f77bcf8639011507f1", "filename", {"key": "{}"}, "text/plain", "file_contents"
)


class TestArtifactController(BaseTestCase):
    """ArtifactController integration test stubs"""

    def setUp(self):
        """Set up a fake MongoDB object"""
        self.mongo_patcher = patch("ibutsu_server.controllers.artifact_controller.mongo")
        self.mock_mongo = self.mongo_patcher.start()
        self.mock_mongo.fs = MagicMock()
        self.mock_mongo.fs.find.return_value = [MOCK_ARTIFACT]
        self.mock_mongo.fs.upload_from_stream.return_value = ObjectId(MOCK_ID)

    def tearDown(self):
        """Teardown the mocks"""
        self.mongo_patcher.stop()

    def test_delete_artifact(self):
        """Test case for delete_artifact

        Delete an artifact
        """
        headers = {}
        response = self.client.open(
            "/api/artifact/{id}".format(id=MOCK_ID), method="DELETE", headers=headers
        )
        assert self.mock_mongo.fs.delete.called_once_with(ObjectId(MOCK_ID))
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_download_artifact(self):
        """Test case for download_artifact

        Download an artifact
        """
        headers = {"Accept": "application/octet-stream"}
        response = self.client.open(
            "/api/artifact/{id}/download".format(id="5d9230bb10b3f82ce80760fd"),
            method="GET",
            headers=headers,
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_artifact(self):
        """Test case for get_artifact

        Get a single artifact
        """
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/artifact/{id}".format(id="5d9230bb10b3f82ce80760fd"),
            method="GET",
            headers=headers,
        )
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_artifact_list(self):
        """Test case for get_artifact_list

        Get a (filtered) list of artifacts
        """
        query_string = [("resultId", "result_id_example"), ("page", 56), ("pageSize", 56)]
        headers = {"Accept": "application/json"}
        response = self.client.open(
            "/api/artifact", method="GET", headers=headers, query_string=query_string
        )
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
