"""Enhanced tests for import controller"""

import uuid
from http import HTTPStatus
from unittest.mock import patch

from ibutsu_server.test import BaseTestCase, MockImport, MockProject


class TestImportControllerEnhanced(BaseTestCase):
    """Enhanced tests for import controller"""

    def setUp(self):
        """Set up test data and mocks"""
        super().setUp()

        self.import_patcher = patch("ibutsu_server.controllers.import_controller.Import")
        self.mock_import = self.import_patcher.start()

        self.get_project_patcher = patch("ibutsu_server.controllers.import_controller.get_project")
        self.mock_get_project = self.get_project_patcher.start()

        self.project_has_user_patcher = patch(
            "ibutsu_server.controllers.import_controller.project_has_user"
        )
        self.mock_project_has_user = self.project_has_user_patcher.start()
        self.mock_project_has_user.return_value = True

    def tearDown(self):
        """Teardown mocks"""
        self.import_patcher.stop()
        self.get_project_patcher.stop()
        self.project_has_user_patcher.stop()

    def test_get_import_success(self):
        """Test successful import retrieval"""
        import_id = str(uuid.uuid4())
        mock_import = MockImport(id=import_id, filename="test.xml")
        mock_import.data = {}  # No project restriction
        self.mock_import.query.get.return_value = mock_import

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }

        response = self.client.get(f"/api/import/{import_id}", headers=headers)

        self.assert_200(response)

    def test_get_import_not_found(self):
        """Test import retrieval when import doesn't exist"""
        import_id = str(uuid.uuid4())
        self.mock_import.query.get.return_value = None

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }

        response = self.client.get(f"/api/import/{import_id}", headers=headers)

        assert response.status_code == HTTPStatus.NOT_FOUND

    def test_get_import_with_project_access(self):
        """Test import retrieval with project access check"""
        import_id = str(uuid.uuid4())
        project_id = str(uuid.uuid4())
        mock_import = MockImport(id=import_id, filename="test.xml")
        mock_import.data = {"project_id": project_id}
        self.mock_import.query.get.return_value = mock_import

        mock_project = MockProject(id=project_id)
        self.mock_get_project.return_value = mock_project
        self.mock_project_has_user.return_value = True

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }

        response = self.client.get(f"/api/import/{import_id}", headers=headers)

        self.assert_200(response)

    def test_get_import_forbidden_project(self):
        """Test import retrieval with forbidden project access"""
        import_id = str(uuid.uuid4())
        project_id = str(uuid.uuid4())
        mock_import = MockImport(id=import_id, filename="test.xml")
        mock_import.data = {"project_id": project_id}
        self.mock_import.query.get.return_value = mock_import

        mock_project = MockProject(id=project_id)
        self.mock_get_project.return_value = mock_project
        self.mock_project_has_user.return_value = False  # User doesn't have access

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }

        response = self.client.get(f"/api/import/{import_id}", headers=headers)

        assert response.status_code == HTTPStatus.FORBIDDEN

    def test_get_import_no_project_found(self):
        """Test import retrieval when project doesn't exist"""
        import_id = str(uuid.uuid4())
        project_id = str(uuid.uuid4())
        mock_import = MockImport(id=import_id, filename="test.xml")
        mock_import.data = {"project_id": project_id}
        self.mock_import.query.get.return_value = mock_import

        self.mock_get_project.return_value = None  # Project doesn't exist

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.jwt_token}",
        }

        response = self.client.get(f"/api/import/{import_id}", headers=headers)

        self.assert_200(response)  # Should still return the import if project doesn't exist
