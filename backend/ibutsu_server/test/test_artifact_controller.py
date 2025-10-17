from io import BytesIO
from unittest import skip
from unittest.mock import MagicMock, patch

from ibutsu_server.test import BaseTestCase, MockArtifact, MockResult

MOCK_ID = "70202589-4781-4eb9-bcfc-685b1d2c583a"
MOCK_RESULT_ID = "23cd86d5-a27e-45a4-83a3-12c74d219709"
MOCK_RUN_ID = "33cd86d5-a27e-45a4-83a3-12c74d219709"
MOCK_ARTIFACT = MockArtifact(
    id=MOCK_ID,
    data={
        "resultId": MOCK_RESULT_ID,
        "filename": "log.txt",
        "contentType": "text/plain",
        "additionalMetadata": {"key": "value"},
    },
    content="filecontent",
    result=MockResult(id=MOCK_RESULT_ID),
)


class TestArtifactController(BaseTestCase):
    """ArtifactController integration test stubs"""

    def setUp(self):
        """Set up a fake MongoDB object"""
        self.session_patcher = patch("ibutsu_server.controllers.artifact_controller.session")
        self.mock_session = self.session_patcher.start()
        self.project_patcher = patch(
            "ibutsu_server.controllers.artifact_controller.project_has_user"
        )
        self.mock_project_has_user = self.project_patcher.start()
        self.mock_project_has_user.return_value = True
        self.artifact_patcher = patch("ibutsu_server.controllers.artifact_controller.Artifact")
        self.mock_artifact = self.artifact_patcher.start()
        self.mock_artifact.return_value = MOCK_ARTIFACT
        self.mock_artifact.query.get.return_value = MOCK_ARTIFACT
        self.mock_limit = MagicMock()
        self.mock_limit.return_value.offset.return_value.all.return_value = [MOCK_ARTIFACT]
        self.mock_artifact.query.limit = self.mock_limit
        self.mock_artifact.query.filter.return_value.limit = self.mock_limit
        self.mock_artifact.query.count.return_value = 1
        self.mock_artifact.query.filter.return_value.count.return_value = 1
        self.add_user_filter_patcher = patch(
            "ibutsu_server.controllers.artifact_controller.add_user_filter"
        )
        self.mock_add_user_filter = self.add_user_filter_patcher.start()
        self.mock_add_user_filter.side_effect = lambda query, _user: query

        # Mock Result and Run models for permission checks
        self.result_patcher = patch("ibutsu_server.controllers.artifact_controller.Result")
        self.mock_result = self.result_patcher.start()
        self.mock_result.query.get.return_value = MockResult(id=MOCK_RESULT_ID)

        self.run_patcher = patch("ibutsu_server.controllers.artifact_controller.Run")
        self.mock_run = self.run_patcher.start()
        mock_run_instance = MagicMock()
        mock_run_instance.id = MOCK_RUN_ID
        mock_run_instance.project = MagicMock()
        self.mock_run.query.get.return_value = mock_run_instance

    def tearDown(self):
        """Teardown the mocks"""
        self.run_patcher.stop()
        self.result_patcher.stop()
        self.add_user_filter_patcher.stop()
        self.artifact_patcher.stop()
        self.project_patcher.stop()
        self.session_patcher.stop()

    def test_delete_artifact(self):
        """Test case for delete_artifact

        Delete an artifact
        """
        headers = {"Authorization": f"Bearer {self.jwt_token}"}
        response = self.client.open(f"/api/artifact/{MOCK_ID}", method="DELETE", headers=headers)
        self.mock_artifact.query.get.assert_called_once_with(MOCK_ID)
        self.mock_session.delete.assert_called_once_with(MOCK_ARTIFACT)
        self.mock_session.commit.assert_called_once()
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_download_artifact(self):
        """Test case for download_artifact

        Download an artifact
        """
        headers = {
            "Accept": "application/octet-stream",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/artifact/{MOCK_ID}/download",
            method="GET",
            headers=headers,
        )
        self.mock_artifact.query.get.assert_called_once_with(MOCK_ID)
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_artifact(self):
        """Test case for get_artifact

        Get a single artifact
        """
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            f"/api/artifact/{MOCK_ID}",
            method="GET",
            headers=headers,
        )
        self.mock_artifact.query.get.assert_called_once_with(MOCK_ID)
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    def test_get_artifact_list(self):
        """Test case for get_artifact_list

        Get a (filtered) list of artifacts
        """
        query_string = [("resultId", MOCK_RESULT_ID), ("page", 56), ("pageSize", 56)]
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        response = self.client.open(
            "/api/artifact", method="GET", headers=headers, query_string=query_string
        )
        self.mock_limit.return_value.offset.return_value.all.assert_called_once()
        self.assert_200(response, "Response body is : " + response.data.decode("utf-8"))

    @skip("Something is getting crossed in the validation layer")
    def test_upload_artifact(self):
        """Test case for upload_artifact

        Uploads a test run artifact
        """
        headers = {
            "Accept": "application/json",
            "Content-Type": "multipart/form-data",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        data = {
            "resultId": MOCK_ID,
            "filename": "log.txt",
            "additionalMetadata": {"key": "value"},
            "file": (BytesIO(b"filecontent"), "log.txt"),
        }
        response = self.client.open(
            "/api/artifact",
            method="POST",
            headers=headers,
            data=data,
            content_type="multipart/form-data",
        )
        self.assert_201(response, "Response body is : " + response.data.decode("utf-8"))

    def test_upload_artifact_with_both_result_and_run_id(self):
        """Test case for upload_artifact with both resultId and runId

        Should reject when both resultId and runId are provided
        """
        headers = {
            "Accept": "application/json",
            "Content-Type": "multipart/form-data",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        data = {
            "resultId": MOCK_RESULT_ID,
            "runId": MOCK_RUN_ID,
            "filename": "log.txt",
            "file": (BytesIO(b"filecontent"), "log.txt"),
        }
        response = self.client.open(
            "/api/artifact",
            method="POST",
            headers=headers,
            data=data,
            content_type="multipart/form-data",
        )
        self.assert_400(response, "Should reject when both resultId and runId are provided")
        assert b"cannot provide both resultId and runId" in response.data, (
            "Error message should mention mutual exclusivity"
        )

    def test_upload_artifact_with_invalid_metadata_list(self):
        """Test case for upload_artifact with additionalMetadata as a JSON list

        Should reject when additionalMetadata is not a JSON object
        """
        headers = {
            "Accept": "application/json",
            "Content-Type": "multipart/form-data",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        data = {
            "resultId": MOCK_RESULT_ID,
            "filename": "log.txt",
            "additionalMetadata": '["item1", "item2"]',  # JSON list, not object
            "file": (BytesIO(b"filecontent"), "log.txt"),
        }
        response = self.client.open(
            "/api/artifact",
            method="POST",
            headers=headers,
            data=data,
            content_type="multipart/form-data",
        )
        self.assert_400(response, "Should reject when additionalMetadata is a JSON list")
        # Check for either OpenAPI validation error or our custom error
        assert (
            b"not of type 'object'" in response.data or b"must be a JSON object" in response.data
        ), "Error message should indicate JSON object requirement"

    def test_upload_artifact_with_invalid_metadata_number(self):
        """Test case for upload_artifact with additionalMetadata as a JSON number

        Should reject when additionalMetadata is not a JSON object
        """
        headers = {
            "Accept": "application/json",
            "Content-Type": "multipart/form-data",
            "Authorization": f"Bearer {self.jwt_token}",
        }
        data = {
            "resultId": MOCK_RESULT_ID,
            "filename": "log.txt",
            "additionalMetadata": "123",  # JSON number, not object
            "file": (BytesIO(b"filecontent"), "log.txt"),
        }
        response = self.client.open(
            "/api/artifact",
            method="POST",
            headers=headers,
            data=data,
            content_type="multipart/form-data",
        )
        self.assert_400(response, "Should reject when additionalMetadata is a JSON number")
        # Check for either OpenAPI validation error or our custom error
        assert (
            b"not of type 'object'" in response.data or b"must be a JSON object" in response.data
        ), "Error message should indicate JSON object requirement"
