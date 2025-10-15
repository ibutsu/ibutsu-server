import json
from datetime import datetime, timezone
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
from werkzeug.datastructures import FileStorage

from tests.conftest import MOCK_IMPORT_ID, MOCK_PROJECT_ID
from tests.test_util import MockImport, MockProject

MOCK_IMPORT = MockImport(
    id=MOCK_IMPORT_ID,
    filename="test_results.xml",
    format="junit",
    status="completed",
    data={"project_id": MOCK_PROJECT_ID, "metadata": {"key": "value"}},
    created=datetime.now(timezone.utc),
)
MOCK_PROJECT = MockProject(
    id=MOCK_PROJECT_ID,
    name="test-project",
    title="Test Project",
)


@pytest.fixture
def import_controller_mocks():
    """Set up mocks for import controller tests"""
    with (
        patch("ibutsu_server.controllers.import_controller.session") as mock_session,
        patch("ibutsu_server.controllers.import_controller.Import") as mock_import_class,
        patch("ibutsu_server.controllers.import_controller.ImportFile") as mock_import_file_class,
        patch("ibutsu_server.controllers.import_controller.get_project") as mock_get_project,
        patch(
            "ibutsu_server.controllers.import_controller.project_has_user"
        ) as mock_project_has_user,
        patch(
            "ibutsu_server.controllers.import_controller.run_junit_import"
        ) as mock_run_junit_import,
        patch(
            "ibutsu_server.controllers.import_controller.run_archive_import"
        ) as mock_run_archive_import,
    ):
        # Configure default return values
        mock_import_class.query.get.return_value = MOCK_IMPORT
        mock_import_class.from_dict.return_value = MOCK_IMPORT
        mock_get_project.return_value = MOCK_PROJECT
        mock_project_has_user.return_value = True
        yield {
            "session": mock_session,
            "import_class": mock_import_class,
            "import_file_class": mock_import_file_class,
            "get_project": mock_get_project,
            "project_has_user": mock_project_has_user,
            "run_junit_import": mock_run_junit_import,
            "run_archive_import": mock_run_archive_import,
        }


def test_get_import_success(flask_app, import_controller_mocks):
    """Test case for get_import - successful retrieval"""
    client, jwt_token = flask_app
    mocks = import_controller_mocks
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/import/{MOCK_IMPORT_ID}",
        method="GET",
        headers=headers,
    )
    mocks["import_class"].query.get.assert_called_once_with(MOCK_IMPORT_ID)
    mocks["get_project"].assert_called_once_with(MOCK_PROJECT_ID)
    # The user parameter should be the authenticated user ID from the JWT token
    mocks["project_has_user"].assert_called_once()
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_get_import_not_found(flask_app, import_controller_mocks):
    """Test case for get_import - import not found"""
    client, jwt_token = flask_app
    mocks = import_controller_mocks
    mocks["import_class"].query.get.return_value = None
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/import/{MOCK_IMPORT_ID}",
        method="GET",
        headers=headers,
    )
    assert response.status_code == 404, f"Response body is : {response.data.decode('utf-8')}"


def test_get_import_forbidden_project_access(flask_app, import_controller_mocks):
    """Test case for get_import - forbidden project access"""
    client, jwt_token = flask_app
    mocks = import_controller_mocks
    mocks["project_has_user"].return_value = False
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/import/{MOCK_IMPORT_ID}",
        method="GET",
        headers=headers,
    )
    assert response.status_code == 403, f"Response body is : {response.data.decode('utf-8')}"


def test_get_import_no_project_in_data(flask_app, import_controller_mocks):
    """Test case for get_import - import with no project_id in data"""
    client, jwt_token = flask_app
    mocks = import_controller_mocks
    import_without_project = MockImport(
        id=MOCK_IMPORT_ID,
        filename="test_results.xml",
        data={},  # No project_id
    )
    mocks["import_class"].query.get.return_value = import_without_project
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/import/{MOCK_IMPORT_ID}",
        method="GET",
        headers=headers,
    )
    # Should not call get_project or project_has_user
    mocks["get_project"].assert_not_called()
    mocks["project_has_user"].assert_not_called()
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


def test_get_import_project_not_found(flask_app, import_controller_mocks):
    """Test case for get_import - project not found"""
    client, jwt_token = flask_app
    mocks = import_controller_mocks
    mocks["get_project"].return_value = None
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/import/{MOCK_IMPORT_ID}",
        method="GET",
        headers=headers,
    )
    # Should still return the import even if project is not found
    assert response.status_code == 200, f"Response body is : {response.data.decode('utf-8')}"


@patch("ibutsu_server.controllers.import_controller.connexion")
def test_add_import_success_with_file_upload(mock_connexion, flask_app, import_controller_mocks):
    """Test case for add_import - successful file upload"""
    client, jwt_token = flask_app
    mocks = import_controller_mocks
    # Mock file upload
    test_file_content = b"<?xml version='1.0'?><testsuite></testsuite>"
    mock_file = MagicMock()
    mock_file.filename = "test_results.xml"
    mock_file.read.return_value = test_file_content
    mock_file.content_type = "application/xml"
    # Mock connexion request
    mock_connexion.request.files = {"importFile": mock_file}
    form_data = {
        "project": MOCK_PROJECT_ID,
        "metadata": json.dumps({"key": "value"}),
        "source": "pytest",
    }
    mock_form = MagicMock()
    mock_form.get = lambda key, default=None: form_data.get(key, default)
    mock_connexion.request.form = mock_form
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/import",
        method="POST",
        headers=headers,
        data={"importFile": (BytesIO(b"test file content"), "test.xml")},
    )
    # Verify import creation
    mocks["import_class"].from_dict.assert_called_once()
    mocks["session"].add.assert_called()
    mocks["session"].commit.assert_called()
    assert response.status_code == 202, f"Response body is : {response.data.decode('utf-8')}"


@patch("ibutsu_server.controllers.import_controller.connexion")
def test_add_import_no_file_uploaded(mock_connexion, flask_app, import_controller_mocks):
    """Test case for add_import - no file uploaded"""
    client, jwt_token = flask_app
    mock_connexion.request.files = {}
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/import",
        method="POST",
        headers=headers,
        data={},  # No importFile provided
    )
    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"
    assert "importFile" in response.data.decode("utf-8")


@patch("ibutsu_server.controllers.import_controller.connexion")
def test_add_import_project_not_found(mock_connexion, flask_app, import_controller_mocks):
    """Test case for add_import - project not found"""
    client, jwt_token = flask_app
    mocks = import_controller_mocks
    mocks["get_project"].return_value = None
    mock_file = MagicMock(spec=FileStorage)
    mock_file.filename = "test_results.xml"
    mock_connexion.request.files = {"importFile": mock_file}
    mock_connexion.request.form = {"project": "nonexistent-project"}
    form_data = mock_connexion.request.form
    mock_form = MagicMock()
    mock_form.get = lambda key, default=None: form_data.get(key, default)
    mock_connexion.request.form = mock_form
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/import",
        method="POST",
        headers=headers,
        data={
            "importFile": (BytesIO(b"test file content"), "test_results.xml"),
            "project": "nonexistent-project",
        },
    )
    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"
    assert "doesn't exist" in response.data.decode("utf-8")


@patch("ibutsu_server.controllers.import_controller.connexion")
def test_add_import_forbidden_project_access(mock_connexion, flask_app, import_controller_mocks):
    """Test case for add_import - forbidden project access"""
    client, jwt_token = flask_app
    mocks = import_controller_mocks
    mocks["project_has_user"].return_value = False
    mock_file = MagicMock(spec=FileStorage)
    mock_file.filename = "test_results.xml"
    mock_connexion.request.files = {"importFile": mock_file}
    mock_connexion.request.form = {"project": MOCK_PROJECT_ID}
    form_data = mock_connexion.request.form
    mock_form = MagicMock()
    mock_form.get = lambda key, default=None: form_data.get(key, default)
    mock_connexion.request.form = mock_form
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/import",
        method="POST",
        headers=headers,
        data={
            "importFile": (BytesIO(b"test file content"), "test_results.xml"),
            "project": MOCK_PROJECT_ID,
        },
    )
    assert response.status_code == 403, f"Response body is : {response.data.decode('utf-8')}"


@patch("ibutsu_server.controllers.import_controller.connexion")
def test_add_import_without_project(mock_connexion, flask_app, import_controller_mocks):
    """Test case for add_import - successful upload without project"""
    client, jwt_token = flask_app
    mocks = import_controller_mocks
    mock_file = MagicMock()
    mock_file.filename = "test_results.xml"
    mock_file.read.return_value = b"<?xml version='1.0'?><testsuite></testsuite>"
    mock_file.content_type = "application/xml"
    mock_connexion.request.files = {"importFile": mock_file}
    mock_form = MagicMock()
    mock_form.get.return_value = None
    mock_connexion.request.form = mock_form
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/import",
        method="POST",
        headers=headers,
        data={
            "importFile": (
                BytesIO(b"<?xml version='1.0'?><testsuite></testsuite>"),
                "test_results.xml",
            )
        },
    )
    # Should still create import without project
    mocks["import_class"].from_dict.assert_called_once()
    mocks["session"].add.assert_called()
    mocks["session"].commit.assert_called()
    assert response.status_code == 202, f"Response body is : {response.data.decode('utf-8')}"


@patch("ibutsu_server.controllers.import_controller.connexion")
def test_add_import_various_metadata_formats(mock_connexion, flask_app, import_controller_mocks):
    """Test case for add_import - various metadata JSON formats"""
    client, jwt_token = flask_app
    mock_file = MagicMock()
    mock_file.filename = "test_results.xml"
    mock_file.read.return_value = b"<?xml version='1.0'?><testsuite></testsuite>"
    mock_file.content_type = "application/xml"
    mock_connexion.request.files = {"importFile": mock_file}
    metadata_value = '{"key": "value", "number": 123}'
    mock_connexion.request.form = {"metadata": metadata_value}
    form_data = mock_connexion.request.form
    mock_form = MagicMock()
    mock_form.get = lambda key, default=None: form_data.get(key, default)
    mock_connexion.request.form = mock_form
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        "/api/import",
        method="POST",
        headers=headers,
        data={
            "importFile": (
                BytesIO(b"<?xml version='1.0'?><testsuite></testsuite>"),
                "test_results.xml",
            ),
            "metadata": metadata_value,
        },
    )
    assert response.status_code == 202, f"Response body is : {response.data.decode('utf-8')}"


def test_get_import_invalid_uuid(flask_app, import_controller_mocks):
    """Test case for get_import - invalid UUID format"""
    client, jwt_token = flask_app
    invalid_id = "not-a-valid-uuid"
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }
    response = client.open(
        f"/api/import/{invalid_id}",
        method="GET",
        headers=headers,
    )
    # The @validate_uuid decorator should handle this
    assert response.status_code == 400, f"Response body is : {response.data.decode('utf-8')}"
