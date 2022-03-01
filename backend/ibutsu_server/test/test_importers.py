from pathlib import Path
from unittest.mock import call
from unittest.mock import MagicMock
from unittest.mock import patch

from ibutsu_server.test import BaseTestCase


XML_FILE = Path(__file__).parent / "res" / "empty-testsuite.xml"
XML_FILE_COMBINED = Path(__file__).parent / "res" / "combined.xml"


class TestImporterTasks(BaseTestCase):
    @patch("ibutsu_server.tasks.importers.session")
    def test_update_import_status(self, mocked_session):
        """Test that the _update_import_status() method works correctly"""
        from ibutsu_server.tasks.importers import _update_import_status

        # GIVEN: A mocked out session and a mocked import
        mocked_import = MagicMock()

        _update_import_status(mocked_import, "running")

        mocked_session.add.assert_called_once_with(mocked_import)
        mocked_session.commit.assert_called_once()
        assert mocked_import.status == "running"

    @patch("ibutsu_server.tasks.importers.ImportFile")
    @patch("ibutsu_server.tasks.importers.Import")
    @patch("ibutsu_server.tasks.importers._update_import_status")
    @patch("ibutsu_server.tasks.importers.session")
    def test_junit_import(self, mocked_session, mocked_update, MockImport, MockImportFile):
        """Test the junit importer"""
        mocked_import = {"id": "12345"}
        mocked_record = MagicMock(data={})
        MockImport.query.get.return_value = mocked_record
        mocked_file = MagicMock(content=XML_FILE.open().read().encode("utf8"))
        MockImportFile.query.filter.return_value.first.return_value = mocked_file

        from ibutsu_server.tasks.importers import run_junit_import

        # We mocked out the @task decorator, use the _orig_func attr to get the original function
        run_junit_import = run_junit_import._orig_func
        run_junit_import(mocked_import)

        MockImport.query.get.assert_called_once_with("12345")
        assert mocked_update.call_args_list == [
            call(mocked_record, "running"),
            call(mocked_record, "done"),
        ]
        MockImportFile.query.filter.assert_called_once()
        MockImportFile.query.filter.return_value.first.assert_called_once()

    @patch("ibutsu_server.tasks.importers.ImportFile")
    @patch("ibutsu_server.tasks.importers.Import")
    @patch("ibutsu_server.tasks.importers._update_import_status")
    @patch("ibutsu_server.tasks.importers.session")
    def test_junit_import_non_empty(
        self, mocked_session, mocked_update, MockImport, MockImportFile
    ):
        """Test the junit importer"""
        mocked_import = {"id": "12345"}
        mocked_record = MagicMock(data={"metadata": {"job_name": "foo"}})
        MockImport.query.get.return_value = mocked_record
        mocked_file = MagicMock(content=XML_FILE_COMBINED.open().read().encode("utf8"))
        MockImportFile.query.filter.return_value.first.return_value = mocked_file

        from ibutsu_server.tasks.importers import run_junit_import

        # We mocked out the @task decorator, use the _orig_func attr to get the original function
        run_junit_import = run_junit_import._orig_func
        run_junit_import(mocked_import)

        MockImport.query.get.assert_called_once_with("12345")
        assert mocked_update.call_args_list == [
            call(mocked_record, "running"),
            call(mocked_record, "done"),
        ]
        MockImportFile.query.filter.assert_called_once()
        MockImportFile.query.filter.return_value.first.assert_called_once()
