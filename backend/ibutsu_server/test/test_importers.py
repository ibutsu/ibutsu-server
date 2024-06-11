from pathlib import Path
from unittest.mock import MagicMock, call, patch

from ibutsu_server.test import BaseTestCase

PARENT = Path(__file__).parent
XML_FILE = PARENT / "res" / "empty-testsuite.xml"
XML_FILE_COMBINED = PARENT / "res" / "combined.xml"
XML_FILE_COLLECTION = PARENT / "res" / "collection.xml"
XML_FILE_PROPERTIES = PARENT / "res" / "merged-with-props.xml"


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
        mocked_record = MagicMock(
            data={}, filename="run-f56b3831-0813-484a-809f-53d4c36a10a5.ibutsu.xml"
        )
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
        assert (
            mocked_session.add.call_args_list[0][0][0].id == "f56b3831-0813-484a-809f-53d4c36a10a5"
        )

    @patch("ibutsu_server.tasks.importers.ImportFile")
    @patch("ibutsu_server.tasks.importers.Import")
    @patch("ibutsu_server.tasks.importers._update_import_status")
    @patch("ibutsu_server.tasks.importers.session")
    def test_junit_import_non_empty(
        self, mocked_session, mocked_update, MockImport, MockImportFile
    ):
        """Test the junit importer"""
        mocked_import = {"id": "12345"}
        mocked_record = MagicMock(data={"metadata": {"job_name": "foo"}}, filename="junit.xml")
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

    @patch("ibutsu_server.tasks.importers.ImportFile")
    @patch("ibutsu_server.tasks.importers.Import")
    @patch("ibutsu_server.tasks.importers._update_import_status")
    @patch("ibutsu_server.tasks.importers.session")
    @patch("ibutsu_server.tasks.importers.get_project_id")
    def test_junit_import_tests_with_properties(
        self,
        mocked_get_project_id,
        mocked_session,
        mocked_update,
        MockImport,
        MockImportFile,
    ):
        """Test the junit importer"""
        mocked_import = {"id": "12345"}
        mocked_record = MagicMock(data={}, filename="junit.xml")
        MockImport.query.get.return_value = mocked_record
        mocked_file = MagicMock(content=XML_FILE_PROPERTIES.open().read().encode("utf8"))
        MockImportFile.query.filter.return_value.first.return_value = mocked_file
        mocked_get_project_id.return_value = "3765d8b1-3fa2-40d6-a64a-b76f3a02e43f"

        from ibutsu_server.tasks.importers import run_junit_import

        # We mocked out the @task decorator, use the _orig_func attr to get the original function
        run_junit_import = run_junit_import._orig_func
        run_junit_import(mocked_import)

        MockImport.query.get.assert_called_once_with("12345")
        imported_run = mocked_session.add.call_args[0][0]
        mocked_get_project_id.assert_called_once_with("insights-qe")
        assert imported_run.summary["tests"] == 162
        assert imported_run.component == "frontend-components"
        assert imported_run.source == "pr_check-400-1"
        assert imported_run.project_id == "3765d8b1-3fa2-40d6-a64a-b76f3a02e43f"

    @patch("ibutsu_server.tasks.importers.ImportFile")
    @patch("ibutsu_server.tasks.importers.Import")
    @patch("ibutsu_server.tasks.importers._update_import_status")
    @patch("ibutsu_server.tasks.importers.session")
    def test_junit_import_testcase_without_time(
        self, mocked_session, mocked_update, MockImport, MockImportFile
    ):
        """Test the junit importer"""
        mocked_import = {"id": "12345"}
        mocked_record = MagicMock(data={"metadata": {"job_name": "foo"}}, filename="junit.xml")
        MockImport.query.get.return_value = mocked_record
        mocked_file = MagicMock(content=XML_FILE_COLLECTION.open().read().encode("utf8"))
        MockImportFile.query.filter.return_value.first.return_value = mocked_file

        from ibutsu_server.tasks.importers import run_junit_import

        # We mocked out the @task decorator, use the _orig_func attr to get the original function
        run_junit_import = run_junit_import._orig_func
        run_junit_import(mocked_import)

        MockImport.query.get.assert_called_once_with("12345")
        assert mocked_session.add.call_args[0][0].summary["tests"] == 1
