"""Tests for ibutsu_server.importers"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from ibutsu_server.tasks.importers import (
    prune_fields,
    run_archive_import,
    run_junit_import,
)

# Get the absolute path to the test_data directory
# Note: if this file is moved, this path will need to be updated
TEST_DATA_DIR = (Path(__file__).parent.parent / "test_data").resolve()


@pytest.fixture
def mock_result_and_run():
    """Mock a result and run object for testing."""
    mock_result = MagicMock()
    mock_run = MagicMock()
    mock_run.to_dict.return_value = {"id": "run_id"}
    return mock_result, mock_run


def test_prune_fields():
    """Test that fields are pruned correctly."""
    data = {
        "id": "123",
        "field_to_keep": "value1",
        "another_field": "value2",
        "_id": "456",
        "to_be_removed": "value3",
    }
    pruned_data = prune_fields(data, fields_to_prune=["id", "_id", "to_be_removed"])
    assert "id" not in pruned_data
    assert "_id" not in pruned_data
    assert "to_be_removed" not in pruned_data
    assert "field_to_keep" in pruned_data
    assert "another_field" in pruned_data


@patch("ibutsu_server.tasks.importers.session")
@patch("ibutsu_server.tasks.importers.Result")
@patch("ibutsu_server.tasks.importers.Run")
@patch("ibutsu_server.tasks.importers.Import")
def test_run_junit_import(
    mock_import_class, mock_run_class, mock_result_class, mock_session, mock_result_and_run
):
    """Test the run_junit_import task."""
    mock_result, mock_run = mock_result_and_run
    mock_result_class.from_dict.return_value = mock_result
    mock_run_class.from_dict.return_value = mock_run

    # Mock the Import record
    mock_import_record = MagicMock()
    mock_import_record.filename = str(TEST_DATA_DIR / "junit.xml")
    mock_import_class.query.get.return_value = mock_import_record

    import_id = "import_id"

    # Call the function directly (not as a Celery task)
    run_junit_import(import_id)

    mock_result_class.from_dict.assert_called()
    mock_session.add.assert_called()
    mock_session.commit.assert_called()


@patch("ibutsu_server.tasks.importers.Artifact")
@patch("ibutsu_server.tasks.importers.Run")
@patch("ibutsu_server.tasks.importers.Result")
@patch("ibutsu_server.tasks.importers.Import")
@patch("ibutsu_server.tasks.importers.session")
def test_run_archive_import(
    mock_session,
    mock_import_class,
    mock_result_class,
    mock_run_class,
    mock_artifact_class,
    mock_result_and_run,
):
    """Test the run_archive_import task."""
    mock_result, mock_run = mock_result_and_run
    mock_result_class.from_dict.return_value = mock_result
    mock_run_class.from_dict.return_value = mock_run

    # Mock the Import record
    mock_import_record = MagicMock()
    mock_import_record.filename = str(TEST_DATA_DIR / "archive.tar.gz")
    mock_import_class.query.get.return_value = mock_import_record

    import_id = "import_id"

    # Call the function directly (not as a Celery task)
    run_archive_import(import_id)

    mock_result_class.from_dict.assert_called()
    mock_artifact_class.assert_called()
    mock_session.add.assert_called()
    mock_session.commit.assert_called()
