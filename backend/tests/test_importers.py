"""Tests for ibutsu_server.tasks.importers module"""

import json
import tarfile
from datetime import UTC, datetime
from io import BytesIO
from unittest.mock import patch
from uuid import uuid4

import pytest
from lxml import etree, objectify
from sqlalchemy import func

from ibutsu_server.db import db
from ibutsu_server.db.models import Artifact, Import, ImportFile, Result, Run
from ibutsu_server.tasks.importers import (
    _add_artifacts,
    _extract_run_id,
    _get_properties,
    _get_test_name_path,
    _get_ts_element,
    _parse_timestamp,
    _populate_created_times,
    _populate_metadata,
    _populate_result_metadata,
    _process_result,
    _update_import_status,
    _update_run_summary,
    _upsert_artifact,
    _upsert_result_artifact,
    _upsert_run_artifact,
    run_archive_import,
    run_junit_import,
)
from ibutsu_server.tasks.runs import update_run
from ibutsu_server.util.uuid import is_uuid


def make_archive_bytes(members: dict) -> bytes:
    """Create an in-memory tar.gz archive from a mapping of path -> content."""
    buf = BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for name, content in members.items():
            if content is None or content == "dir":
                info = tarfile.TarInfo(name=name)
                info.type = tarfile.DIRTYPE
                tar.addfile(info)
            else:
                if isinstance(content, dict):
                    payload = json.dumps(content).encode()
                elif isinstance(content, str):
                    payload = content.encode()
                else:
                    payload = content
                info = tarfile.TarInfo(name=name)
                info.size = len(payload)
                tar.addfile(info, BytesIO(payload))
    buf.seek(0)
    return buf.read()


class TestGetProperties:
    """Tests for _get_properties helper function"""

    def test_get_properties_with_properties(self):
        """Test _get_properties extracts properties from XML element"""
        xml_string = """
        <testsuite name="test">
            <properties>
                <property key="env" value="production"/>
                <property key="build" value="123"/>
            </properties>
        </testsuite>
        """
        element = objectify.fromstring(xml_string)
        result = _get_properties(element)

        assert result == {"env": "production", "build": "123"}

    def test_get_properties_no_properties(self):
        """Test _get_properties with element that has no properties"""
        xml_string = "<testsuite name='test'/>"
        element = objectify.fromstring(xml_string)
        result = _get_properties(element)

        assert result == {}

    def test_get_properties_empty_properties(self):
        """Test _get_properties with empty properties element"""
        xml_string = "<testsuite name='test'><properties/></testsuite>"
        element = objectify.fromstring(xml_string)
        result = _get_properties(element)

        assert result == {}

    def test_get_properties_missing_key(self):
        """Test _get_properties skips properties without key attribute"""
        xml_string = """
        <testsuite>
            <properties>
                <property key="env" value="prod"/>
                <property value="should-be-skipped"/>
            </properties>
        </testsuite>
        """
        element = objectify.fromstring(xml_string)
        result = _get_properties(element)

        # Only the property with a key should be included
        assert result == {"env": "prod"}

    def test_get_properties_none_value(self):
        """Test _get_properties with None value"""
        xml_string = """
        <testsuite>
            <properties>
                <property key="empty"/>
            </properties>
        </testsuite>
        """
        element = objectify.fromstring(xml_string)
        result = _get_properties(element)

        assert "empty" in result
        assert result["empty"] is None


class TestGetTestNamePath:
    """Tests for _get_test_name_path helper function"""

    def test_get_test_name_path_with_name_and_classname(self):
        """Test extracting test name and path from testcase with name and classname"""
        xml_string = '<testcase name="test_function" classname="tests.unit.test_module"/>'
        testcase = objectify.fromstring(xml_string)

        test_name, backup_fspath = _get_test_name_path(testcase)

        assert test_name == "test_module.test_function"
        assert backup_fspath == "tests/unit"

    def test_get_test_name_path_with_name_only(self):
        """Test extracting test name with name but no classname"""
        xml_string = '<testcase name="test_function"/>'
        testcase = objectify.fromstring(xml_string)

        test_name, backup_fspath = _get_test_name_path(testcase)

        assert test_name == "test_function"
        assert backup_fspath is None

    def test_get_test_name_path_with_classname_only(self):
        """Test extracting path with classname but no name"""
        xml_string = '<testcase classname="tests.unit.test_module"/>'
        testcase = objectify.fromstring(xml_string)

        test_name, backup_fspath = _get_test_name_path(testcase)

        assert test_name == "test_module."
        assert backup_fspath == "tests/unit"

    def test_get_test_name_path_no_attributes(self):
        """Test with testcase that has no name or classname"""
        xml_string = "<testcase/>"
        testcase = objectify.fromstring(xml_string)

        test_name, backup_fspath = _get_test_name_path(testcase)

        assert test_name == ""
        assert backup_fspath is None

    def test_get_test_name_path_dotted_name(self):
        """Test with dotted test name (takes last segment)"""
        xml_string = '<testcase name="TestClass.test_method.subtest"/>'
        testcase = objectify.fromstring(xml_string)

        test_name, _backup_fspath = _get_test_name_path(testcase)

        assert test_name == "subtest"

    def test_get_test_name_path_nested_classname(self):
        """Test with deeply nested classname"""
        xml_string = '<testcase name="test_func" classname="a.b.c.d.e.TestClass"/>'
        testcase = objectify.fromstring(xml_string)

        test_name, backup_fspath = _get_test_name_path(testcase)

        assert test_name == "TestClass.test_func"
        assert backup_fspath == "a/b/c/d/e"


class TestGetTsElement:
    """Tests for _get_ts_element helper function"""

    def test_get_ts_element_with_testsuite_tag(self):
        """Test when root element is testsuite"""
        xml_string = '<testsuite name="tests"/>'
        tree = objectify.fromstring(xml_string)

        result = _get_ts_element(tree)

        assert result.tag == "testsuite"

    def test_get_ts_element_with_testsuites_tag(self):
        """Test when root element is testsuites"""
        xml_string = """
        <testsuites>
            <testsuite name="suite1"/>
        </testsuites>
        """
        tree = objectify.fromstring(xml_string)

        result = _get_ts_element(tree)

        assert result.tag == "testsuite"


class TestParseTimestamp:
    """Tests for _parse_timestamp helper function"""

    def test_parse_timestamp_with_valid_iso_timestamp(self):
        """Test parsing valid ISO timestamp"""
        xml_string = '<testsuite timestamp="2024-01-15T10:30:00"/>'
        ts = objectify.fromstring(xml_string)

        result = _parse_timestamp(ts)

        assert isinstance(result, datetime)
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15

    def test_parse_timestamp_without_timestamp(self):
        """Test parsing when no timestamp attribute exists"""
        xml_string = "<testsuite/>"
        ts = objectify.fromstring(xml_string)

        result = _parse_timestamp(ts)

        # Should return a datetime close to "now" (broad tolerance to avoid flakiness)
        assert isinstance(result, datetime)
        delta_seconds = abs((datetime.now(UTC) - result).total_seconds())
        assert delta_seconds < 24 * 60 * 60

    def test_parse_timestamp_with_different_formats(self):
        """Test parsing various timestamp formats"""
        # dateutil.parser is quite flexible
        xml_string = '<testsuite timestamp="2024-01-15 10:30:00"/>'
        ts = objectify.fromstring(xml_string)

        result = _parse_timestamp(ts)

        assert isinstance(result, datetime)
        assert result.year == 2024


class TestProcessResult:
    """Tests for _process_result helper function"""

    def test_process_result_with_failure(self):
        """Test processing result with failure"""
        xml_string = """
        <testcase name="test">
            <failure message="Assertion failed">
                Traceback here
            </failure>
        </testcase>
        """
        testcase = objectify.fromstring(xml_string)
        result_dict = {"result": None, "metadata": {}}

        result_dict, traceback = _process_result(result_dict, testcase)

        assert result_dict["result"] == "failed"
        assert traceback is not None
        assert b"Traceback here" in traceback

    def test_process_result_with_error(self):
        """Test processing result with error"""
        xml_string = """
        <testcase name="test">
            <error message="Runtime error">
                Error details
            </error>
        </testcase>
        """
        testcase = objectify.fromstring(xml_string)
        result_dict = {"result": None, "metadata": {}}

        result_dict, traceback = _process_result(result_dict, testcase)

        assert result_dict["result"] == "error"
        assert traceback is not None
        assert b"Error details" in traceback

    def test_process_result_with_skipped(self):
        """Test processing result with skipped"""
        xml_string = """
        <testcase name="test">
            <skipped message="Skipped due to condition">Reason here</skipped>
        </testcase>
        """
        testcase = objectify.fromstring(xml_string)
        result_dict = {"result": None, "metadata": {}}

        result_dict, traceback = _process_result(result_dict, testcase)

        assert result_dict["result"] == "skipped"
        assert traceback is None
        assert "skip_reason" in result_dict["metadata"]

    def test_process_result_with_xfailure(self):
        """Test processing result with expected failure"""
        xml_string = """
        <testcase name="test">
            <xfailure/>
        </testcase>
        """
        testcase = objectify.fromstring(xml_string)
        result_dict = {"result": None, "metadata": {}}

        result_dict, traceback = _process_result(result_dict, testcase)

        assert result_dict["result"] == "xfailed"
        assert traceback is None

    def test_process_result_with_xpassed(self):
        """Test processing result with unexpected pass"""
        xml_string = """
        <testcase name="test">
            <xpassed/>
        </testcase>
        """
        testcase = objectify.fromstring(xml_string)
        result_dict = {"result": None, "metadata": {}}

        result_dict, traceback = _process_result(result_dict, testcase)

        assert result_dict["result"] == "xpassed"
        assert traceback is None

    def test_process_result_passed(self):
        """Test processing successful result"""
        xml_string = "<testcase name='test'/>"
        testcase = objectify.fromstring(xml_string)
        result_dict = {"result": None, "metadata": {}}

        result_dict, traceback = _process_result(result_dict, testcase)

        assert result_dict["result"] == "passed"
        assert traceback is None


class TestPopulateCreatedTimes:
    """Tests for _populate_created_times helper function"""

    def test_populate_created_times_both_missing(self):
        """Test populating when both created and start_time are missing"""
        run_dict = {}
        start_time = datetime(2024, 1, 15, 10, 30, 0, tzinfo=UTC)

        _populate_created_times(run_dict, start_time)

        assert run_dict["created"] == start_time
        assert run_dict["start_time"] == start_time

    def test_populate_created_times_start_time_only(self):
        """Test when only start_time is present"""
        start_time = datetime(2024, 1, 15, 10, 30, 0, tzinfo=UTC)
        run_dict = {"start_time": start_time}

        _populate_created_times(run_dict, None)

        assert run_dict["created"] == start_time
        assert run_dict["start_time"] == start_time

    def test_populate_created_times_created_only(self):
        """Test when only created is present"""
        created_time = datetime(2024, 1, 15, 10, 30, 0, tzinfo=UTC)
        run_dict = {"created": created_time}

        _populate_created_times(run_dict, None)

        assert run_dict["start_time"] == created_time
        assert run_dict["created"] == created_time

    def test_populate_created_times_both_present(self):
        """Test when both are already present"""
        created = datetime(2024, 1, 15, 10, 0, 0, tzinfo=UTC)
        start = datetime(2024, 1, 15, 10, 30, 0, tzinfo=UTC)
        run_dict = {"created": created, "start_time": start}

        _populate_created_times(run_dict, None)

        # Should not modify existing values
        assert run_dict["created"] == created
        assert run_dict["start_time"] == start


class TestPopulateMetadata:
    """Tests for _populate_metadata helper function"""

    def test_populate_metadata_from_import_data(self, make_import):
        """Test populating metadata from import record data"""
        project_id = str(uuid4())
        import_record = make_import(data={"project_id": project_id, "source": "jenkins"})

        run_dict = {}
        _populate_metadata(run_dict, import_record)

        assert run_dict["project_id"] == project_id
        assert run_dict["source"] == "jenkins"

    def test_populate_metadata_from_run_dict(self, make_import):
        """Test populating from run_dict metadata"""
        import_record = make_import(data={})
        project_id = str(uuid4())

        run_dict = {
            "metadata": {"project": "test-project", "component": "backend", "env": "production"}
        }

        with patch("ibutsu_server.tasks.importers.get_project_id", return_value=project_id):
            _populate_metadata(run_dict, import_record)

        assert run_dict["project_id"] == project_id
        assert run_dict["component"] == "backend"
        assert run_dict["env"] == "production"

    def test_populate_metadata_import_overrides_run(self, make_import):
        """Test that import data overrides run dict values"""
        project_id = str(uuid4())
        import_record = make_import(data={"project_id": project_id, "source": "ci"})

        run_dict = {"project_id": "old-id", "metadata": {"project": "old-project"}}

        _populate_metadata(run_dict, import_record)

        # Import data should override
        assert run_dict["project_id"] == project_id
        assert run_dict["source"] == "ci"


class TestPopulateResultMetadata:
    """Tests for _populate_result_metadata helper function"""

    def test_populate_result_metadata_basic(self):
        """Test populating result metadata"""
        run_dict = {"env": "production", "component": "backend"}
        result_dict = {"metadata": {}}
        metadata = {"build": "123", "project_id": str(uuid4())}

        _populate_result_metadata(run_dict, result_dict, metadata)

        assert result_dict["metadata"]["build"] == "123"
        assert result_dict["env"] == "production"
        assert result_dict["component"] == "backend"
        assert "project_id" in result_dict

    def test_populate_result_metadata_with_source(self):
        """Test populating result metadata with source"""
        run_dict = {}
        result_dict = {"metadata": {}}
        metadata = {"source": "jenkins"}

        _populate_result_metadata(run_dict, result_dict, metadata)

        assert result_dict["source"] == "jenkins"

    def test_populate_result_metadata_empty_metadata(self):
        """Test with None metadata"""
        run_dict = {"env": "prod"}
        result_dict = {"metadata": {}}
        metadata = None

        # Should not raise error
        _populate_result_metadata(run_dict, result_dict, metadata)


class TestUpdateImportStatus:
    """Tests for _update_import_status helper function"""

    def test_update_import_status(self, make_import, flask_app):
        """Test updating import status"""
        client, _ = flask_app

        with client.application.app_context():
            import_record = make_import(status="pending")

            _update_import_status(import_record, "running")

            # Refresh from database
            updated = db.session.get(Import, import_record.id)
            assert updated.status == "running"

    def test_update_import_status_to_done(self, make_import, flask_app):
        """Test updating import status to done"""
        client, _ = flask_app

        with client.application.app_context():
            import_record = make_import(status="running")

            _update_import_status(import_record, "done")

            updated = db.session.get(Import, import_record.id)
            assert updated.status == "done"

    def test_update_import_status_to_error(self, make_import, flask_app):
        """Test updating import status to error"""
        client, _ = flask_app

        with client.application.app_context():
            import_record = make_import(status="running")

            _update_import_status(import_record, "error")

            updated = db.session.get(Import, import_record.id)
            assert updated.status == "error"


class TestAddArtifacts:
    """Tests for _add_artifacts helper function"""

    def test_add_artifacts_with_traceback(self, make_result, flask_app):
        """Test adding artifacts with traceback"""
        client, _ = flask_app

        with client.application.app_context():
            result = make_result()
            xml_string = "<testcase name='test'/>"
            testcase = objectify.fromstring(xml_string)
            traceback = b"Traceback content"

            _add_artifacts(result, testcase, traceback)

            # Check that artifact was created
            artifacts = Artifact.query.filter_by(result_id=result.id).all()
            assert len(artifacts) == 1
            assert artifacts[0].filename == "traceback.log"
            assert artifacts[0].content == traceback

    def test_add_artifacts_with_system_out(self, make_result, flask_app):
        """Test adding artifacts with system-out"""
        client, _ = flask_app

        with client.application.app_context():
            result = make_result()
            xml_string = """
            <testcase name="test">
                <system-out>Console output here</system-out>
            </testcase>
            """
            testcase = objectify.fromstring(xml_string)

            _add_artifacts(result, testcase, None)

            artifacts = Artifact.query.filter_by(result_id=result.id).all()
            assert len(artifacts) == 1
            assert artifacts[0].filename == "system-out.log"
            assert b"Console output here" in artifacts[0].content

    def test_add_artifacts_with_system_err(self, make_result, flask_app):
        """Test adding artifacts with system-err"""
        client, _ = flask_app

        with client.application.app_context():
            result = make_result()
            xml_string = """
            <testcase name="test">
                <system-err>Error output here</system-err>
            </testcase>
            """
            testcase = objectify.fromstring(xml_string)

            _add_artifacts(result, testcase, None)

            artifacts = Artifact.query.filter_by(result_id=result.id).all()
            assert len(artifacts) == 1
            assert artifacts[0].filename == "system-err.log"

    def test_add_artifacts_all_types(self, make_result, flask_app):
        """Test adding all artifact types together"""
        client, _ = flask_app

        with client.application.app_context():
            result = make_result()
            xml_string = """
            <testcase name="test">
                <system-out>Console output</system-out>
                <system-err>Error output</system-err>
            </testcase>
            """
            testcase = objectify.fromstring(xml_string)
            traceback = b"Traceback"

            _add_artifacts(result, testcase, traceback)

            artifacts = Artifact.query.filter_by(result_id=result.id).all()
            assert len(artifacts) == 3
            filenames = {a.filename for a in artifacts}
            assert filenames == {"traceback.log", "system-out.log", "system-err.log"}


class TestUpsertArtifact:
    """Tests for _upsert_artifact, _upsert_result_artifact, and _upsert_run_artifact"""

    @pytest.mark.parametrize("target_type", ["result", "run"])
    def test_upsert_artifact_insert_and_update(self, make_result, make_run, flask_app, target_type):
        """Test inserting a new artifact and updating it in-place."""
        client, _ = flask_app
        with client.application.app_context():
            if target_type == "result":
                target = make_result()
                target_col = Artifact.result_id
                meta_key = "resultId"
                filename = "log.txt"
                initial_content = b"initial content"
                updated_content = b"updated content"
                _upsert_result_artifact(target.id, filename, initial_content)
            else:
                target = make_run()
                target_col = Artifact.run_id
                meta_key = "runId"
                filename = "console.log"
                initial_content = b"console output"
                updated_content = b"new console output"
                _upsert_run_artifact(target.id, filename, initial_content)

            db.session.flush()

            art = db.session.execute(
                db.select(Artifact).where(target_col == target.id, Artifact.filename == filename)
            ).scalar_one()
            assert art.content == initial_content
            assert art.data[meta_key] == target.id

            if target_type == "result":
                _upsert_result_artifact(target.id, filename, updated_content)
            else:
                _upsert_run_artifact(target.id, filename, updated_content)
            db.session.flush()

            artifacts = (
                db.session.execute(
                    db.select(Artifact).where(
                        target_col == target.id, Artifact.filename == filename
                    )
                )
                .scalars()
                .all()
            )
            assert len(artifacts) == 1
            assert artifacts[0].id == art.id
            assert artifacts[0].content == updated_content

    def test_upsert_artifact_missing_target_raises(self, flask_app):
        """_upsert_artifact raises ValueError when neither result_id nor run_id is supplied."""
        client, _ = flask_app
        with (
            client.application.app_context(),
            pytest.raises(ValueError, match="Either result_id or run_id"),
        ):
            _upsert_artifact("test.txt", b"content")

    @pytest.mark.parametrize("target_type", ["result", "run"])
    def test_upsert_artifact_deduplicates_legacy_rows(
        self, make_run, make_result, flask_app, target_type
    ):
        """Test that _upsert_artifact removes multiple legacy duplicate rows."""
        client, _ = flask_app
        with client.application.app_context():
            d1 = datetime(2026, 1, 1, tzinfo=UTC)
            d2 = datetime(2026, 1, 2, tzinfo=UTC)
            d3 = datetime(2026, 1, 3, tzinfo=UTC)
            if target_type == "result":
                res = make_result()
                target_id = res.id
                kwargs1 = {
                    "result_id": target_id,
                    "filename": "dup.txt",
                    "content": b"v1",
                    "upload_date": d1,
                }
                kwargs2 = {
                    "result_id": target_id,
                    "filename": "dup.txt",
                    "content": b"v2",
                    "upload_date": d2,
                }
                kwargs3 = {
                    "result_id": target_id,
                    "filename": "dup.txt",
                    "content": b"v3",
                    "upload_date": d3,
                }
                query = db.select(Artifact).where(
                    Artifact.result_id == target_id, Artifact.filename == "dup.txt"
                )
            else:
                run = make_run()
                target_id = run.id
                kwargs1 = {
                    "run_id": target_id,
                    "filename": "dup.txt",
                    "content": b"v1",
                    "upload_date": d1,
                }
                kwargs2 = {
                    "run_id": target_id,
                    "filename": "dup.txt",
                    "content": b"v2",
                    "upload_date": d2,
                }
                kwargs3 = {
                    "run_id": target_id,
                    "filename": "dup.txt",
                    "content": b"v3",
                    "upload_date": d3,
                }
                query = db.select(Artifact).where(
                    Artifact.run_id == target_id, Artifact.filename == "dup.txt"
                )

            art1 = Artifact(**kwargs1)
            art2 = Artifact(**kwargs2)
            art3 = Artifact(**kwargs3)
            db.session.add_all([art1, art2, art3])
            db.session.commit()

            assert len(db.session.execute(query).scalars().all()) == 3

            if target_type == "result":
                _upsert_result_artifact(target_id, "dup.txt", b"deduped content")
            else:
                _upsert_run_artifact(target_id, "dup.txt", b"deduped content")
            db.session.commit()

            remaining = db.session.execute(query).scalars().all()
            assert len(remaining) == 1
            assert remaining[0].id == art1.id
            assert remaining[0].content == b"deduped content"


class TestRunJunitImport:
    """Integration tests for run_junit_import task"""

    def test_run_junit_import_basic(self, make_import, flask_app):
        """Test basic JUnit import"""
        client, _ = flask_app

        with client.application.app_context():
            junit_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
            <testsuite name="test-suite" tests="2" failures="1" errors="0" skipped="0" time="1.5">
                <testcase name="test_pass" classname="tests.test_module" time="0.5"/>
                <testcase name="test_fail" classname="tests.test_module" time="1.0">
                    <failure message="Test failed">Assertion error</failure>
                </testcase>
            </testsuite>
            """

            import_record = make_import(filename="test.xml", format="junit", status="pending")
            import_file = ImportFile(id=str(uuid4()), import_id=import_record.id, content=junit_xml)
            db.session.add(import_file)
            db.session.commit()

            # Run the import - mock clear_import_file_content to avoid Redis dependency
            with patch("ibutsu_server.tasks.importers.clear_import_file_content") as clear_mock:
                run_junit_import({"id": str(import_record.id)})

            # Ensure cleanup task is invoked
            clear_mock.delay.assert_called_once_with(import_record.id)

            # Verify run was created
            runs = Run.query.all()
            assert len(runs) > 0
            run = runs[-1]  # Get the latest run
            assert run.summary["tests"] == 2
            assert run.summary["failures"] == 1

            # Verify results were created
            results = Result.query.filter_by(run_id=run.id).order_by(Result.id).all()
            assert len(results) == 2

            # Verify per-test behavior: one passed and one failed result
            statuses = {r.result for r in results}
            assert statuses == {"passed", "failed"}

            # Check that test identifiers/names were correctly mapped from the XML
            test_ids = {r.test_id for r in results}
            # Test IDs should contain both test case names
            assert any("test_pass" in tid for tid in test_ids)
            assert any("test_fail" in tid for tid in test_ids)

            # Verify the failed test has a traceback artifact attached
            failed_result = next(r for r in results if r.result == "failed")
            failed_artifacts = Artifact.query.filter_by(result_id=failed_result.id).all()
            failed_filenames = {a.filename for a in failed_artifacts}

            # We expect a traceback artifact for the failed test
            assert "traceback.log" in failed_filenames

            # Verify import status updated
            updated_import = db.session.get(Import, import_record.id)
            assert updated_import.status == "done"

    def test_run_junit_import_with_properties(self, make_import, make_project, flask_app):
        """Test JUnit import with properties"""
        client, _ = flask_app

        with client.application.app_context():
            project = make_project(name="test-project")

            junit_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
            <testsuite name="test-suite" tests="1">
                <properties>
                    <property key="env" value="production"/>
                    <property key="build" value="123"/>
                </properties>
                <testcase name="test_with_props" classname="tests.test_module" time="1.0"/>
            </testsuite>
            """

            import_record = make_import(
                filename="test.xml",
                format="junit",
                status="pending",
                data={"project_id": project.id},
            )

            import_file = ImportFile(id=str(uuid4()), import_id=import_record.id, content=junit_xml)

            db.session.add(import_file)
            db.session.commit()

            # Mock clear_import_file_content to avoid Redis dependency
            with patch("ibutsu_server.tasks.importers.clear_import_file_content") as clear_mock:
                run_junit_import({"id": str(import_record.id)})

            # Ensure cleanup task is invoked
            clear_mock.delay.assert_called_once_with(import_record.id)

            # Verify run has metadata from properties
            runs = Run.query.filter_by(project_id=project.id).all()
            assert len(runs) > 0
            run = runs[-1]
            assert run.data.get("env") == "production"
            assert run.data.get("build") == "123"

    def test_run_junit_import_missing_file(self, make_import, flask_app):
        """Test JUnit import with missing import file"""
        client, _ = flask_app

        with client.application.app_context():
            import_record = make_import(filename="missing.xml", format="junit", status="pending")

            # Don't create import file
            run_junit_import({"id": str(import_record.id)})

            # Verify status updated to error
            updated = db.session.get(Import, import_record.id)
            assert updated.status == "error"

    def test_run_junit_import_no_duplicate_artifacts(self, make_import, flask_app):
        """A failing testcase should produce exactly one of each artifact, not duplicates"""
        client, _ = flask_app

        with client.application.app_context():
            junit_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
            <testsuite name="suite" tests="1" failures="1">
                <testcase name="test_fail" classname="tests.mod" time="1.0">
                    <failure message="boom">traceback text</failure>
                    <system-out>stdout text</system-out>
                    <system-err>stderr text</system-err>
                </testcase>
            </testsuite>
            """

            import_record = make_import(filename="dup.xml", format="junit", status="pending")
            import_file = ImportFile(id=str(uuid4()), import_id=import_record.id, content=junit_xml)
            db.session.add(import_file)
            db.session.commit()

            with patch("ibutsu_server.tasks.importers.clear_import_file_content"):
                run_junit_import({"id": str(import_record.id)})

            run = db.session.execute(db.select(Run).order_by(Run.id)).scalars().all()[-1]
            result = db.session.execute(db.select(Result).filter_by(run_id=run.id)).scalar_one()
            artifacts = (
                db.session.execute(db.select(Artifact).filter_by(result_id=result.id))
                .scalars()
                .all()
            )
            filenames = [a.filename for a in artifacts]

            # Each artifact type should appear exactly once (no duplication)
            assert sorted(filenames) == [
                "system-err.log",
                "system-out.log",
                "traceback.log",
            ]
            assert len(filenames) == len(set(filenames))

    def test_run_junit_import_error_rolls_back_and_marks_error(self, make_import, flask_app):
        """A failure during JUnit processing rolls back the run and marks the import errored"""
        client, _ = flask_app

        with client.application.app_context():
            junit_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
            <testsuite name="suite" tests="1" failures="0">
                <testcase name="test_rollback" classname="tests.mod" time="1.0" />
            </testsuite>
            """

            run_uuid = str(uuid4())
            import_record = make_import(
                filename=f"rollback-{run_uuid}.xml", format="junit", status="pending"
            )
            import_file = ImportFile(id=str(uuid4()), import_id=import_record.id, content=junit_xml)
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.clear_import_file_content") as clear_mock,
                patch(
                    "ibutsu_server.tasks.importers._process_result",
                    side_effect=RuntimeError("junit boom"),
                ),
                pytest.raises(RuntimeError, match="junit boom"),
            ):
                run_junit_import({"id": str(import_record.id)})

            # The run and results must not have been committed
            assert db.session.get(Run, run_uuid) is None
            assert (
                db.session.execute(db.select(Result).where(Result.run_id == run_uuid))
                .scalars()
                .all()
                == []
            )
            # The import must be marked error, not left stuck in "running"
            updated = db.session.get(Import, import_record.id)
            assert updated.status == "error"
            # Cleanup must not run on a failed import
            clear_mock.delay.assert_not_called()

            with (
                patch("ibutsu_server.tasks.importers.clear_import_file_content") as clear_mock,
                patch(
                    "ibutsu_server.tasks.importers._process_result",
                    side_effect=RuntimeError("junit boom"),
                ),
                pytest.raises(RuntimeError, match="junit boom"),
            ):
                run_junit_import({"id": str(import_record.id)})

            # The run and results must not have been committed
            assert db.session.get(Run, run_uuid) is None
            assert (
                db.session.execute(db.select(Result).where(Result.run_id == run_uuid))
                .scalars()
                .all()
                == []
            )
            # The import must be marked error, not left stuck in "running"
            updated = db.session.get(Import, import_record.id)
            assert updated.status == "error"
            # Cleanup must not run on a failed import
            clear_mock.delay.assert_not_called()

    def test_run_junit_import_with_none_filename(self, make_import, flask_app):
        """JUnit import succeeds even when import_record.filename is None"""
        client, _ = flask_app

        with client.application.app_context():
            junit_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
            <testsuite name="suite" tests="1">
                <testcase name="test_one" classname="tests.mod" time="0.5" />
            </testsuite>
            """
            import_record = make_import(filename=None, format="junit", status="pending")
            db.session.add(import_record)
            import_file = ImportFile(id=str(uuid4()), import_id=import_record.id, content=junit_xml)
            db.session.add(import_file)
            db.session.commit()

            with patch("ibutsu_server.tasks.importers.clear_import_file_content"):
                run_junit_import({"id": str(import_record.id)})

            updated = db.session.get(Import, import_record.id)
            assert updated.status == "done"
            assert "run_id" in updated.data

    def test_run_junit_import_with_none_data(self, make_import, flask_app):
        """JUnit import succeeds even when import_record.data is None"""
        client, _ = flask_app

        with client.application.app_context():
            junit_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
            <testsuite name="suite" tests="1">
                <testcase name="test_one" classname="tests.mod" time="0.5" />
            </testsuite>
            """
            import_record = make_import(filename="none_data.xml", format="junit", status="pending")
            import_record.data = None
            db.session.add(import_record)
            import_file = ImportFile(id=str(uuid4()), import_id=import_record.id, content=junit_xml)
            db.session.add(import_file)
            db.session.commit()

            with patch("ibutsu_server.tasks.importers.clear_import_file_content"):
                run_junit_import({"id": str(import_record.id)})

            updated = db.session.get(Import, import_record.id)
            assert updated.status == "done"
            assert "run_id" in updated.data

    def test_run_junit_import_missing_record_returns_none(self, flask_app):
        """JUnit import returns early when the import record is not found."""
        client, _ = flask_app
        with client.application.app_context():
            assert run_junit_import({"id": str(uuid4())}) is None

    def test_run_junit_import_with_string_run_id_in_data(self, make_import, flask_app):
        """JUnit import handles string run_id in import_record.data."""
        client, _ = flask_app
        with client.application.app_context():
            run_uuid = str(uuid4())
            junit_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
            <testsuite name="suite" tests="1">
                <testcase name="test_str_run_id" classname="tests.mod" time="0.5" />
            </testsuite>
            """
            import_record = make_import(filename="str_run_id.xml", format="junit", status="pending")
            import_record.data = {"run_id": run_uuid}
            db.session.add(import_record)
            import_file = ImportFile(id=str(uuid4()), import_id=import_record.id, content=junit_xml)
            db.session.add(import_file)
            db.session.commit()

            with patch("ibutsu_server.tasks.importers.clear_import_file_content"):
                run_junit_import({"id": str(import_record.id)})

            run = db.session.get(Run, run_uuid)
            assert run is not None
            updated = db.session.get(Import, import_record.id)
            assert updated.status == "done"
            assert updated.data["run_id"] == [run_uuid]

    def test_run_junit_import_with_metadata_project_and_source(
        self, make_import, make_project, flask_app
    ):
        """JUnit import correctly applies metadata, project, and source."""
        client, _ = flask_app
        with client.application.app_context():
            proj = make_project(name="junit-test-project")
            junit_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
            <testsuite name="suite-with-props" tests="1" errors="1" failures="1"
                       skipped="1" xfailures="1" xpasses="1">
                <properties>
                    <property key="project" value="{proj.name}" />
                    <property key="env" value="staging" />
                    <property key="component" value="api" />
                </properties>
                <testcase name="test_with_source" classname="tests.prop" time="0.3">
                    <error message="err">err msg</error>
                </testcase>
            </testsuite>
            """.encode()

            import_record = make_import(filename="props.xml", format="junit", status="pending")
            import_record.data = {
                "metadata": {"extra_tag": "v1"},
                "source": "custom_ci",
            }
            db.session.add(import_record)
            import_file = ImportFile(id=str(uuid4()), import_id=import_record.id, content=junit_xml)
            db.session.add(import_file)
            db.session.commit()

            with patch("ibutsu_server.tasks.importers.clear_import_file_content"):
                run_junit_import({"id": str(import_record.id)})

            run_id = import_record.data["run_id"][0]
            run = db.session.get(Run, run_id)
            assert run is not None
            assert run.project_id == proj.id
            assert run.source == "custom_ci"
            assert run.data.get("extra_tag") == "v1"

            result = db.session.execute(
                db.select(Result).where(Result.run_id == run_id)
            ).scalar_one()
            assert result.source == "custom_ci"

    @pytest.mark.parametrize("has_uuid_in_filename", [True, False])
    def test_run_junit_import_idempotent_retry(self, make_import, flask_app, has_uuid_in_filename):
        """Retrying JUnit import updates existing run/results without creating duplicates."""
        client, _ = flask_app

        with client.application.app_context():
            run_uuid = str(uuid4())
            junit_content = b"""<testsuites time="1.5">
                <testsuite name="my-suite" time="1.5" tests="1" errors="0" failures="0" skipped="0">
                    <testcase classname="pkg.TestFoo" name="test_bar" time="1.5" />
                </testsuite>
            </testsuites>"""

            filename = f"results-{run_uuid}.xml" if has_uuid_in_filename else "results.xml"
            import_record = make_import(filename=filename, format="junit", status="pending")
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=junit_content
            )
            db.session.add(import_file)
            db.session.commit()

            with patch("ibutsu_server.tasks.importers.clear_import_file_content"):
                run_junit_import({"id": str(import_record.id)})

            if has_uuid_in_filename:
                run = db.session.get(Run, run_uuid)
            else:
                run = db.session.get(Run, import_record.data["run_id"][0])
            assert run is not None
            run_count = db.session.execute(db.select(func.count(Run.id))).scalar()
            result_count = db.session.execute(db.select(func.count(Result.id))).scalar()

            # Re-run the import (simulating a retry)
            with patch("ibutsu_server.tasks.importers.clear_import_file_content"):
                run_junit_import({"id": str(import_record.id)})

            new_run_count = db.session.execute(db.select(func.count(Run.id))).scalar()
            new_result_count = db.session.execute(db.select(func.count(Result.id))).scalar()
            assert new_run_count == run_count
            assert new_result_count == result_count

    @pytest.mark.parametrize("n_testcases", [1, 3, 5])
    def test_run_junit_import_n_distinct_testcases_produces_n_results(
        self, make_import, flask_app, n_testcases
    ):
        """Assert that N distinct testcases in a JUnit XML file create exactly N Result records."""
        client, _ = flask_app

        with client.application.app_context():
            testcases_xml = "\n".join(
                f'<testcase classname="pkg.TestClass{i}" name="test_method_{i}" time="0.1"/>'
                for i in range(n_testcases)
            )
            junit_content = (
                f'<testsuites time="1.0">\n'
                f'  <testsuite name="suite" time="1.0" tests="{n_testcases}" '
                f'errors="0" failures="0" skipped="0">\n'
                f"    {testcases_xml}\n"
                f"  </testsuite>\n"
                f"</testsuites>"
            ).encode()

            import_record = make_import(
                filename="junit-multi.xml", format="junit", status="pending"
            )
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=junit_content
            )
            db.session.add(import_file)
            db.session.commit()

            with patch("ibutsu_server.tasks.importers.clear_import_file_content"):
                run_junit_import({"id": str(import_record.id)})

            run_id = import_record.data["run_id"][0]
            results = (
                db.session.execute(db.select(Result).where(Result.run_id == run_id)).scalars().all()
            )
            assert len(results) == n_testcases
            test_ids = {r.test_id for r in results}
            expected_test_ids = {f"TestClass{i}.test_method_{i}" for i in range(n_testcases)}
            assert test_ids == expected_test_ids

    def test_run_junit_import_duplicate_test_ids_in_same_file_not_collapsed(
        self, make_import, flask_app
    ):
        """Two testcases with same test_id in one file don't collapse; retry is idempotent."""
        client, _ = flask_app

        with client.application.app_context():
            run_uuid = str(uuid4())
            # Two testcases with the same classname and name
            junit_content = b"""<testsuites time="2.0">
                <testsuite name="suite" time="2.0" tests="2" errors="0" failures="0" skipped="0">
                    <testcase classname="pkg.TestDup" name="test_case" time="1.0"/>
                    <testcase classname="pkg.TestDup" name="test_case" time="1.0"/>
                </testsuite>
            </testsuites>"""

            import_record = make_import(
                filename=f"results-{run_uuid}.xml", format="junit", status="pending"
            )
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=junit_content
            )
            db.session.add(import_file)
            db.session.commit()

            with patch("ibutsu_server.tasks.importers.clear_import_file_content"):
                run_junit_import({"id": str(import_record.id)})

            run = db.session.get(Run, run_uuid)
            assert run is not None
            results = (
                db.session.execute(db.select(Result).where(Result.run_id == run.id)).scalars().all()
            )
            # Assert that the two testcases in the same file did NOT collapse into one result
            assert len(results) == 2
            assert all(r.test_id == "TestDup.test_case" for r in results)

            # Re-run the import (simulating a retry): must remain 2 results, updated in place
            with patch("ibutsu_server.tasks.importers.clear_import_file_content"):
                run_junit_import({"id": str(import_record.id)})

            retry_results = (
                db.session.execute(db.select(Result).where(Result.run_id == run.id)).scalars().all()
            )
            assert len(retry_results) == 2
            assert {r.id for r in results} == {r.id for r in retry_results}

    def test_run_junit_import_malformed_xml_rolls_back_and_marks_error(
        self, make_import, flask_app
    ):
        """Malformed XML syntax must roll back, mark import as error, and re-raise."""
        client, _ = flask_app
        with client.application.app_context():
            import_record = make_import(filename="bad.xml", format="junit", status="pending")
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=b"<testsuite><unclosed>"
            )
            db.session.add(import_file)
            db.session.commit()

            with pytest.raises(etree.XMLSyntaxError):
                run_junit_import({"id": str(import_record.id)})

            updated = db.session.get(Import, import_record.id)
            assert updated.status == "error"

    def test_run_junit_import_artifact_idempotency_on_retry(self, make_import, flask_app):
        """Re-importing JUnit XML with logs updates artifacts without duplicating."""
        client, _ = flask_app
        with client.application.app_context():
            run_uuid = str(uuid4())
            xml_v1 = """
            <testsuite name="suite" timestamp="2026-01-01T00:00:00" tests="1">
                <testcase name="test_art_idemp" classname="pkg.test">
                    <failure message="fail1">Traceback v1</failure>
                    <system-out>stdout v1</system-out>
                    <system-err>stderr v1</system-err>
                </testcase>
            </testsuite>
            """
            import_record = make_import(
                filename=f"junit-{run_uuid}.xml", format="junit", status="pending"
            )
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=xml_v1.encode()
            )
            db.session.add(import_file)
            db.session.commit()

            with patch("ibutsu_server.tasks.importers.clear_import_file_content"):
                run_junit_import({"id": str(import_record.id)})

            result = db.session.execute(
                db.select(Result).where(Result.run_id == run_uuid)
            ).scalar_one()
            arts_v1 = (
                db.session.execute(db.select(Artifact).where(Artifact.result_id == result.id))
                .scalars()
                .all()
            )
            assert len(arts_v1) == 3
            art_map = {a.filename: a for a in arts_v1}
            assert b"Traceback v1" in art_map["traceback.log"].content
            assert b"stdout v1" in art_map["system-out.log"].content

            # Second import with updated output
            xml_v2 = """
            <testsuite name="suite" timestamp="2026-01-01T00:00:00" tests="1">
                <testcase name="test_art_idemp" classname="pkg.test">
                    <failure message="fail2">Traceback v2</failure>
                    <system-out>stdout v2</system-out>
                    <system-err>stderr v2</system-err>
                </testcase>
            </testsuite>
            """
            import_file.content = xml_v2.encode()
            import_record.status = "pending"
            db.session.add_all([import_record, import_file])
            db.session.commit()

            with patch("ibutsu_server.tasks.importers.clear_import_file_content"):
                run_junit_import({"id": str(import_record.id)})

            arts_v2 = (
                db.session.execute(db.select(Artifact).where(Artifact.result_id == result.id))
                .scalars()
                .all()
            )
            assert len(arts_v2) == 3
            art_map2 = {a.filename: a for a in arts_v2}
            assert b"Traceback v2" in art_map2["traceback.log"].content
            assert b"stdout v2" in art_map2["system-out.log"].content

    def test_run_junit_import_preserves_existing_env_and_component(self, make_import, flask_app):
        """Re-importing JUnit XML without env/component preserves existing values."""
        client, _ = flask_app
        with client.application.app_context():
            run_uuid = str(uuid4())
            xml_v1 = """
            <testsuite name="suite" timestamp="2026-01-01T00:00:00" tests="1">
                <properties>
                    <property key="env" value="staging"/>
                    <property key="component" value="backend"/>
                </properties>
                <testcase name="test_env" classname="pkg.test"/>
            </testsuite>
            """
            import_record = make_import(
                filename=f"junit-{run_uuid}.xml", format="junit", status="pending"
            )
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=xml_v1.encode()
            )
            db.session.add(import_file)
            db.session.commit()

            with patch("ibutsu_server.tasks.importers.clear_import_file_content"):
                run_junit_import({"id": str(import_record.id)})

            run = db.session.get(Run, run_uuid)
            assert run.env == "staging"
            assert run.component == "backend"
            result = db.session.execute(
                db.select(Result).where(Result.run_id == run_uuid)
            ).scalar_one()
            assert result.env == "staging"
            assert result.component == "backend"

            # Re-import without env and component
            xml_v2 = """
            <testsuite name="suite" timestamp="2026-01-01T00:00:00" tests="1">
                <testcase name="test_env" classname="pkg.test"/>
            </testsuite>
            """
            import_file.content = xml_v2.encode()
            import_record.status = "pending"
            db.session.add_all([import_record, import_file])
            db.session.commit()

            with patch("ibutsu_server.tasks.importers.clear_import_file_content"):
                run_junit_import({"id": str(import_record.id)})

            run_reloaded = db.session.get(Run, run_uuid)
            assert run_reloaded.env == "staging"
            assert run_reloaded.component == "backend"
            result_reloaded = db.session.execute(
                db.select(Result).where(Result.run_id == run_uuid)
            ).scalar_one()
            assert result_reloaded.env == "staging"
            assert result_reloaded.component == "backend"


class TestRunArchiveImport:
    """Integration tests for run_archive_import task"""

    def test_run_archive_import_basic(self, make_import, flask_app):
        """Test basic archive import"""
        client, _ = flask_app

        with client.application.app_context():
            run_id = str(uuid4())
            result_id = str(uuid4())

            run_data = {
                "id": run_id,
                "metadata": {"build": "100"},
                "summary": {"tests": 1, "passed": 1},
            }

            result_data = {
                "id": result_id,
                "test_id": "test.example",
                "result": "passed",
                "duration": 1.5,
                "start_time": datetime.now(UTC).isoformat(),
            }

            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{result_id}/result.json": result_data,
                }
            )

            import_record = make_import(
                filename="archive.tar.gz", format="ibutsu", status="pending"
            )

            import_file = ImportFile(
                id=str(uuid4()),
                import_id=import_record.id,
                content=tar_content,
            )

            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content") as clear_mock,
            ):
                run_archive_import({"id": str(import_record.id)})

            clear_mock.delay.assert_called_once_with(import_record.id)

            run = db.session.get(Run, run_id)
            assert run is not None

            result = db.session.get(Result, result_id)
            assert result is not None
            assert result.test_id == "test.example"
            assert result.run_id == run.id

            updated = db.session.get(Import, import_record.id)
            assert updated.status == "done"

    def test_run_archive_import_idempotency_no_duplicate_results(self, make_import, flask_app):
        """Test that re-importing the same archive updates results without creating duplicates"""
        client, _ = flask_app

        with client.application.app_context():
            run_id = str(uuid4())
            result_id = str(uuid4())

            run_data = {
                "id": run_id,
                "metadata": {"build": "101", "component": "backend", "env": "stage"},
                "summary": {"tests": 1, "passed": 1},
            }

            result_data = {
                "id": result_id,
                "test_id": "test.idempotent",
                "result": "passed",
                "duration": 2.0,
                "start_time": datetime.now(UTC).isoformat(),
                "metadata": {"component": "backend", "env": "stage"},
            }

            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{result_id}/result.json": result_data,
                    f"{run_id}/{result_id}/traceback.log": b"log output line",
                }
            )

            # First import
            import_record1 = make_import(
                filename="archive1.tar.gz", format="ibutsu", status="pending"
            )
            import_file1 = ImportFile(
                id=str(uuid4()), import_id=import_record1.id, content=tar_content
            )
            db.session.add(import_file1)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record1.id)})

            all_results = (
                db.session.execute(db.select(Result).where(Result.run_id == run_id)).scalars().all()
            )
            assert len(all_results) == 1
            assert all_results[0].id == result_id
            assert all_results[0].component == "backend"
            assert all_results[0].env == "stage"

            all_artifacts = (
                db.session.execute(db.select(Artifact).where(Artifact.result_id == result_id))
                .scalars()
                .all()
            )
            assert len(all_artifacts) == 1

            # Second import of the same archive
            import_record2 = make_import(
                filename="archive2.tar.gz", format="ibutsu", status="pending"
            )
            import_file2 = ImportFile(
                id=str(uuid4()), import_id=import_record2.id, content=tar_content
            )
            db.session.add(import_file2)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record2.id)})

            all_results_after = (
                db.session.execute(db.select(Result).where(Result.run_id == run_id)).scalars().all()
            )
            assert len(all_results_after) == 1
            assert all_results_after[0].id == result_id

            all_artifacts_after = (
                db.session.execute(db.select(Artifact).where(Artifact.result_id == result_id))
                .scalars()
                .all()
            )
            assert len(all_artifacts_after) == 1

    def test_run_archive_import_existing_run_different_result_id_no_duplicate(
        self, make_import, flask_app
    ):
        """Test that importing an archive into an existing run with different result IDs
        updates existing results by test_id and avoids creating duplicate results.

        Replicates staging bug where an archive imported twice (or into a run whose
        existing results have different IDs) resulted in duplicate result rows and
        doubled run summary counts (e.g. 20,490 passes for 10,312 collected tests).
        """
        client, _ = flask_app

        with client.application.app_context():
            run_id = str(uuid4())
            existing_result_id = "4ba7c6ed-4dae-41a6-9034-fc6658842061"
            archive_result_id = "e4e5fcc9-0e27-4b87-8a72-72886f267755"
            test_id = "test_api_all_data_retention_saas_date_query_limits"

            # Pre-existing run and result in the database (e.g. from an earlier import or API run)
            run = Run(
                id=run_id,
                duration=10.0,
                summary={
                    "tests": 1,
                    "passes": 1,
                    "failures": 0,
                    "errors": 0,
                    "skips": 0,
                    "collected": 1,
                },
            )
            existing_result = Result(
                id=existing_result_id,
                run_id=run_id,
                test_id=test_id,
                result="passed",
                duration=10.0,
                start_time=datetime.now(UTC),
            )
            db.session.add(run)
            db.session.add(existing_result)
            db.session.commit()

            # Archive has the same run_id and test_id, but with archive_result_id
            run_data = {
                "id": run_id,
                "summary": {"tests": 1, "collected": 1, "skips": 0, "failures": 0, "errors": 0},
            }
            result_data = {
                "id": archive_result_id,
                "test_id": test_id,
                "result": "passed",
                "duration": 16.6,
                "start_time": datetime.now(UTC).isoformat(),
            }
            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{archive_result_id}/result.json": result_data,
                }
            )

            import_record = make_import(
                filename="archive.tar.gz", format="ibutsu", status="pending"
            )
            import_file = ImportFile(
                id=str(uuid4()),
                import_id=import_record.id,
                content=tar_content,
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
                patch("ibutsu_server.tasks.importers.update_run"),
            ):
                run_archive_import({"id": str(import_record.id)})

            all_results = (
                db.session.execute(db.select(Result).where(Result.run_id == run_id)).scalars().all()
            )
            assert len(all_results) == 1, (
                f"Expected 1 result for run {run_id}, but found {len(all_results)}"
            )
            assert all_results[0].id == existing_result_id
            assert all_results[0].test_id == test_id
            assert all_results[0].duration == 16.6

            # Verify update_run computes accurate summary without duplicate counts
            with (
                patch("ibutsu_server.tasks.runs.lock"),
                patch("ibutsu_server.tasks.runs.is_locked", return_value=False),
            ):
                update_run(run_id)

            updated_run = db.session.get(Run, run_id)
            assert updated_run.summary["tests"] == 1
            assert updated_run.summary["passes"] == 1
            assert updated_run.summary["skips"] == 0
            assert updated_run.summary["collected"] == 1

    def test_run_archive_import_multi_result_with_artifacts_existing_run_no_duplicate(
        self, make_import, flask_app
    ):
        """Test that importing an archive with multiple results and artifacts into an existing run
        does not create duplicate results.
        """
        client, _ = flask_app

        with client.application.app_context():
            run_id = "d599fb77-53a3-4492-a176-d2de0761cfec"

            # Pre-populate DB with the run and 3 results with different IDs (matching archive tests)
            test_ids = [
                "test_access_valid_token",
                "test_access_banned_token",
                "test_plugin_accessible",
            ]
            run = Run(
                id=run_id,
                duration=1.22,
                summary={
                    "tests": 3,
                    "passes": 3,
                    "skips": 0,
                    "failures": 0,
                    "errors": 0,
                    "collected": 3,
                },
            )
            db.session.add(run)
            existing_result_ids = []
            for tid in test_ids:
                res_id = str(uuid4())
                existing_result_ids.append(res_id)
                db.session.add(
                    Result(
                        id=res_id,
                        run_id=run_id,
                        test_id=tid,
                        result="passed",
                        duration=0.1,
                        start_time=datetime.now(UTC),
                    )
                )
            db.session.commit()

            archive_res_ids = [str(uuid4()) for _ in test_ids]
            run_data = {
                "id": run_id,
                "duration": 1.22,
                "summary": {
                    "tests": 3,
                    "passes": 3,
                    "skips": 0,
                    "failures": 0,
                    "errors": 0,
                    "collected": 3,
                },
            }
            tar_members = {
                f"{run_id}/run.json": run_data,
                f"{run_id}/requirements_report.md": "# Requirements Report\nAll passed",
            }
            for i, (tid, aid) in enumerate(zip(test_ids, archive_res_ids, strict=False)):
                tar_members[f"{run_id}/{aid}/result.json"] = {
                    "id": aid,
                    "test_id": tid,
                    "result": "passed",
                    "duration": 0.5 + i,
                    "start_time": datetime.now(UTC).isoformat(),
                }
                tar_members[f"{run_id}/{aid}/test.log"] = f"Log output for {tid}"

            tar_bytes = make_archive_bytes(tar_members)

            import_record = make_import(
                filename="d599fb77.tar.gz", format="ibutsu", status="pending"
            )
            import_file = ImportFile(
                id=str(uuid4()),
                import_id=import_record.id,
                content=tar_bytes,
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
                patch("ibutsu_server.tasks.importers.update_run"),
            ):
                run_archive_import({"id": str(import_record.id)})

            all_results = (
                db.session.execute(db.select(Result).where(Result.run_id == run_id)).scalars().all()
            )
            assert len(all_results) == 3, (
                f"Expected 3 results for run {run_id}, but found {len(all_results)}"
            )

            # Verify existing IDs are retained and durations updated
            result_map = {r.test_id: r for r in all_results}
            for i, tid in enumerate(test_ids):
                assert tid in result_map
                assert result_map[tid].id in existing_result_ids
                assert result_map[tid].duration == 0.5 + i

            # Verify artifacts were uploaded without duplication
            run_artifacts = (
                db.session.execute(db.select(Artifact).where(Artifact.run_id == run_id))
                .scalars()
                .all()
            )
            assert len(run_artifacts) == 1
            assert run_artifacts[0].filename == "requirements_report.md"

            # Verify update_run computes accurate summary without duplicate counts
            with (
                patch("ibutsu_server.tasks.runs.lock"),
                patch("ibutsu_server.tasks.runs.is_locked", return_value=False),
            ):
                update_run(run_id)

            updated_run = db.session.get(Run, run_id)
            assert updated_run.summary["tests"] == 3
            assert updated_run.summary["passes"] == 3
            assert updated_run.summary["skips"] == 0
            assert updated_run.summary["collected"] == 3

    def test_run_archive_import_multiple_same_test_id_no_duplicate(self, make_import, flask_app):
        """Test that multiple results with same test_id (e.g. retries) match 1:1 without dupes."""
        client, _ = flask_app

        with client.application.app_context():
            run_id = str(uuid4())
            existing_res_id1 = str(uuid4())
            existing_res_id2 = str(uuid4())
            archive_res_id1 = str(uuid4())
            archive_res_id2 = str(uuid4())
            test_id = "test.flaky_retry"

            t1 = datetime(2025, 6, 25, 12, 0, 0, tzinfo=UTC)
            t2 = datetime(2025, 6, 25, 12, 5, 0, tzinfo=UTC)

            # Pre-existing run with 2 results for the same test_id (retry scenario)
            run = Run(
                id=run_id,
                duration=15.0,
                summary={
                    "tests": 2,
                    "passes": 1,
                    "failures": 1,
                    "errors": 0,
                    "skips": 0,
                    "collected": 2,
                },
            )
            r1 = Result(
                id=existing_res_id1,
                run_id=run_id,
                test_id=test_id,
                result="failed",
                duration=5.0,
                start_time=t1,
            )
            r2 = Result(
                id=existing_res_id2,
                run_id=run_id,
                test_id=test_id,
                result="passed",
                duration=10.0,
                start_time=t2,
            )
            db.session.add(run)
            db.session.add(r1)
            db.session.add(r2)
            db.session.commit()

            # Archive has 2 results for that test_id with new archive IDs
            run_data = {
                "id": run_id,
                "summary": {"tests": 2, "collected": 2, "skips": 0, "failures": 1, "errors": 0},
            }
            res_data1 = {
                "id": archive_res_id1,
                "test_id": test_id,
                "result": "failed",
                "duration": 5.2,
                "start_time": t1.isoformat(),
            }
            res_data2 = {
                "id": archive_res_id2,
                "test_id": test_id,
                "result": "passed",
                "duration": 9.8,
                "start_time": t2.isoformat(),
            }
            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{archive_res_id1}/result.json": res_data1,
                    f"{run_id}/{archive_res_id2}/result.json": res_data2,
                }
            )

            import_record = make_import(
                filename="retry_archive.tar.gz", format="ibutsu", status="pending"
            )
            import_file = ImportFile(
                id=str(uuid4()),
                import_id=import_record.id,
                content=tar_content,
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
                patch("ibutsu_server.tasks.importers.update_run"),
            ):
                run_archive_import({"id": str(import_record.id)})

            all_results = (
                db.session.execute(db.select(Result).where(Result.run_id == run_id)).scalars().all()
            )
            assert len(all_results) == 2, (
                f"Expected 2 results for run {run_id}, but found {len(all_results)}"
            )

            # Verify chronological 1:1 match preserved: attempt 1 updated r1, attempt 2 updated r2
            res_1 = db.session.get(Result, existing_res_id1)
            res_2 = db.session.get(Result, existing_res_id2)
            assert res_1.result == "failed"
            assert res_1.duration == 5.2
            assert res_2.result == "passed"
            assert res_2.duration == 9.8

            with (
                patch("ibutsu_server.tasks.runs.lock"),
                patch("ibutsu_server.tasks.runs.is_locked", return_value=False),
            ):
                update_run(run_id)

            updated_run = db.session.get(Run, run_id)
            assert updated_run.summary["tests"] == 2
            assert updated_run.summary["passes"] == 1
            assert updated_run.summary["failures"] == 1

    def test_run_archive_import_duplicate_result_id_in_archive_updates_without_error(
        self, make_import, flask_app
    ):
        """Test that importing an archive containing duplicate result IDs updates existing records
        without raising an IntegrityError.
        """
        client, _ = flask_app

        with client.application.app_context():
            run_id = str(uuid4())
            res_id = str(uuid4())
            test_id = "test_duplicate_id"

            run_data = {
                "id": run_id,
                "summary": {"tests": 1, "collected": 1, "skips": 0, "failures": 0, "errors": 0},
            }
            res_data1 = {
                "id": res_id,
                "test_id": test_id,
                "result": "passed",
                "duration": 5.0,
                "start_time": datetime.now(UTC).isoformat(),
            }
            res_data2 = {
                "id": res_id,
                "test_id": test_id,
                "result": "passed",
                "duration": 6.5,
                "start_time": datetime.now(UTC).isoformat(),
            }
            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{res_id}/result.json": res_data1,
                }
            )

            import_record = make_import(
                filename="archive1.tar.gz", format="ibutsu", status="pending"
            )
            import_file = ImportFile(
                id=str(uuid4()),
                import_id=import_record.id,
                content=tar_content,
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
                patch("ibutsu_server.tasks.importers.update_run"),
            ):
                run_archive_import({"id": str(import_record.id)})

            # Second import with the same result_id but updated duration
            tar_content2 = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{res_id}/result.json": res_data2,
                }
            )
            import_record2 = make_import(
                filename="archive2.tar.gz", format="ibutsu", status="pending"
            )
            import_file2 = ImportFile(
                id=str(uuid4()),
                import_id=import_record2.id,
                content=tar_content2,
            )
            db.session.add(import_file2)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
                patch("ibutsu_server.tasks.importers.update_run"),
            ):
                run_archive_import({"id": str(import_record2.id)})

            all_results = (
                db.session.execute(db.select(Result).where(Result.run_id == run_id)).scalars().all()
            )
            assert len(all_results) == 1
            assert all_results[0].id == res_id
            assert all_results[0].duration == 6.5

    def test_run_archive_import_missing_file(self, make_import, flask_app):
        """Test archive import with missing file"""
        client, _ = flask_app

        with client.application.app_context():
            import_record = make_import(
                filename="missing.tar.gz", format="ibutsu", status="pending"
            )

            run_archive_import({"id": str(import_record.id)})

            updated = db.session.get(Import, import_record.id)
            assert updated.status == "error"

    def test_run_archive_import_corrupt_archive_rolls_back_and_marks_error(
        self, make_import, flask_app
    ):
        """A corrupt/non-tar archive must roll back, mark import error, and re-raise ReadError."""
        client, _ = flask_app
        with client.application.app_context():
            import_record = make_import(
                filename="corrupt.tar.gz", format="ibutsu", status="pending"
            )
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=b"not a valid tar archive"
            )
            db.session.add(import_file)
            db.session.commit()

            with pytest.raises(tarfile.ReadError):
                run_archive_import({"id": str(import_record.id)})

            updated = db.session.get(Import, import_record.id)
            assert updated.status == "error"

    def test_run_archive_import_nested_artifact_paths(self, make_import, flask_app):
        """Archive with nested artifact paths (e.g. subdir/nested.png) imports successfully."""
        client, _ = flask_app
        with client.application.app_context():
            run_id = str(uuid4())
            result_id = str(uuid4())

            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": {"id": run_id, "summary": {"tests": 1}},
                    f"{run_id}/{result_id}/result.json": {
                        "id": result_id,
                        "test_id": "test.nested_art",
                        "result": "passed",
                    },
                    f"{run_id}/{result_id}/subfolder/screenshot.png": b"image-data",
                }
            )

            import_record = make_import(filename="nested.tar.gz", format="ibutsu", status="pending")
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=tar_content
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record.id)})

            art = db.session.execute(
                db.select(Artifact).where(Artifact.result_id == result_id)
            ).scalar_one()
            assert art.filename == "screenshot.png"
            assert art.content == b"image-data"

    def test_run_archive_import_error_rolls_back_and_marks_error(self, make_import, flask_app):
        """A failure during processing rolls back the run and marks the import errored"""
        client, _ = flask_app

        with client.application.app_context():
            run_id = str(uuid4())
            result_id = str(uuid4())

            run_data = {"id": run_id, "metadata": {}, "summary": {"tests": 1}}
            result_data = {
                "id": result_id,
                "test_id": "test.boom",
                "result": "passed",
                "start_time": datetime.now(UTC).isoformat(),
            }

            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{result_id}/result.json": result_data,
                }
            )

            import_record = make_import(filename="boom.tar.gz", format="ibutsu", status="pending")
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=tar_content
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content") as clear_mock,
                patch(
                    "ibutsu_server.tasks.importers._create_result",
                    side_effect=RuntimeError("boom"),
                ),
                pytest.raises(RuntimeError, match="boom"),
            ):
                run_archive_import({"id": str(import_record.id)})

            assert db.session.get(Run, run_id) is None
            updated = db.session.get(Import, import_record.id)
            assert updated.status == "error"
            clear_mock.delay.assert_not_called()

    def test_run_archive_import_with_none_data(self, make_import, flask_app):
        """Archive import succeeds even when import_record.data is None"""
        client, _ = flask_app

        with client.application.app_context():
            run_id = str(uuid4())
            result_id = str(uuid4())

            run_data = {"id": run_id, "metadata": {}, "summary": {"tests": 1}}
            result_data = {
                "id": result_id,
                "test_id": "test.none_data",
                "result": "passed",
                "start_time": datetime.now(UTC).isoformat(),
            }

            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{result_id}/result.json": result_data,
                }
            )

            import_record = make_import(
                filename="none_data.tar.gz", format="ibutsu", status="pending"
            )
            import_record.data = None
            db.session.add(import_record)
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=tar_content
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record.id)})

            updated = db.session.get(Import, import_record.id)
            assert updated.status == "done"
            assert "run_id" in updated.data
            assert updated.data["run_id"] == [run_id]

    def test_run_archive_import_preserves_existing_result_metadata(
        self, make_import, make_run, make_result, flask_app
    ):
        """Re-importing must not discard metadata keys set on the result outside the archive"""
        client, _ = flask_app

        with client.application.app_context():
            run_id = str(uuid4())
            result_id = str(uuid4())

            make_run(id=run_id, metadata={"build": "1"})
            make_result(
                id=result_id,
                run_id=run_id,
                test_id="test.keep",
                result="passed",
                metadata={"classification": "product_failure", "component": "backend"},
            )

            run_data = {"id": run_id, "metadata": {}, "summary": {"tests": 1}}
            result_data = {
                "id": result_id,
                "test_id": "test.keep",
                "result": "failed",
                "start_time": datetime.now(UTC).isoformat(),
                "metadata": {"component": "backend", "env": "stage"},
            }

            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{result_id}/result.json": result_data,
                }
            )

            import_record = make_import(filename="keep.tar.gz", format="ibutsu", status="pending")
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=tar_content
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record.id)})

            result = db.session.get(Result, result_id)
            assert result.data["classification"] == "product_failure"
            assert result.data["env"] == "stage"
            assert result.result == "failed"

    @pytest.mark.parametrize("null_target", ["result", "run", "both"])
    def test_run_archive_import_with_null_metadata(
        self, make_import, make_run, make_result, flask_app, null_target
    ):
        """Archive where run.json or result.json has metadata: null must import gracefully."""
        client, _ = flask_app
        with client.application.app_context():
            run_id = str(uuid4())
            result_id = str(uuid4())

            make_run(id=run_id, metadata={"build": "1"})
            make_result(
                id=result_id,
                run_id=run_id,
                test_id="test.null_meta",
                result="passed",
                metadata={"component": "backend"},
            )

            run_data = {
                "id": run_id,
                "metadata": None if null_target in ("run", "both") else {"build": "1"},
                "summary": {"tests": 1},
            }
            result_data = {
                "id": result_id,
                "test_id": "test.null_meta",
                "result": "passed",
                "start_time": datetime.now(UTC).isoformat(),
                "metadata": None if null_target in ("result", "both") else {"component": "backend"},
            }

            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{result_id}/result.json": result_data,
                }
            )

            import_record = make_import(
                filename="null_meta.tar.gz", format="ibutsu", status="pending"
            )
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=tar_content
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record.id)})

            run = db.session.get(Run, run_id)
            result = db.session.get(Result, result_id)
            assert run is not None
            assert result is not None

    def test_run_archive_import_preserves_existing_env_and_component(
        self, make_import, make_run, make_result, flask_app
    ):
        """Re-importing must not wipe out existing env and component when omitted in archive."""
        client, _ = flask_app

        with client.application.app_context():
            run_id = str(uuid4())
            result_id = str(uuid4())

            make_run(id=run_id, metadata={"build": "1"})
            make_result(
                id=result_id,
                run_id=run_id,
                test_id="test.preserve_env_comp",
                result="passed",
                env="staging",
                component="backend",
            )

            run_data = {"id": run_id, "metadata": {}, "summary": {"tests": 1}}
            result_data = {
                "id": result_id,
                "test_id": "test.preserve_env_comp",
                "result": "passed",
                "start_time": datetime.now(UTC).isoformat(),
                "metadata": {},
            }

            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{result_id}/result.json": result_data,
                }
            )

            import_record = make_import(
                filename="preserve.tar.gz", format="ibutsu", status="pending"
            )
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=tar_content
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record.id)})

            result = db.session.get(Result, result_id)
            assert result is not None
            assert result.env == "staging"
            assert result.component == "backend"

    def test_run_archive_import_without_run_json_is_idempotent(self, make_import, flask_app):
        """Archive without run.json should use the directory run_id
        and be idempotent on re-import.
        """
        client, _ = flask_app

        with client.application.app_context():
            run_id = str(uuid4())
            result_id = str(uuid4())

            result_data = {
                "id": result_id,
                "test_id": "test.no_run_json",
                "result": "passed",
                "start_time": datetime.now(UTC).isoformat(),
                "metadata": {"env": "prod"},
            }

            tar_content = make_archive_bytes(
                {
                    f"{run_id}/{result_id}/result.json": result_data,
                }
            )

            import_record = make_import(filename="no_run.tar.gz", format="ibutsu", status="pending")
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=tar_content
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record.id)})

            run = db.session.get(Run, run_id)
            assert run is not None
            run_count = db.session.execute(db.select(func.count(Run.id))).scalar()

            # Second import using same archive content should update, not create duplicate
            import_record_2 = make_import(
                filename="no_run.tar.gz", format="ibutsu", status="pending"
            )
            import_file_2 = ImportFile(
                id=str(uuid4()), import_id=import_record_2.id, content=tar_content
            )
            db.session.add(import_file_2)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record_2.id)})

            new_run_count = db.session.execute(db.select(func.count(Run.id))).scalar()
            assert new_run_count == run_count

    @pytest.mark.parametrize("id_in_json", [None, "non-uuid-1234"])
    def test_run_archive_import_result_without_id_field(self, make_import, flask_app, id_in_json):
        """Archive where result.json omits or has non-UUID 'id' uses the directory result_id and
        preserves artifacts.
        """
        client, _ = flask_app

        with client.application.app_context():
            run_id = str(uuid4())
            result_id = str(uuid4())

            run_data = {"id": run_id, "summary": {"tests": 1}}
            result_data = {
                "test_id": "test.missing_id_key",
                "result": "passed",
                "start_time": datetime.now(UTC).isoformat(),
                "metadata": {"env": "prod"},
            }
            if id_in_json:
                result_data["id"] = id_in_json

            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{result_id}/result.json": result_data,
                    f"{run_id}/{result_id}/log.txt": b"artifact log",
                }
            )

            import_record = make_import(
                filename="missing_res_id.tar.gz", format="ibutsu", status="pending"
            )
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=tar_content
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record.id)})

            result = db.session.get(Result, result_id)
            assert result is not None
            assert result.test_id == "test.missing_id_key"
            artifact = db.session.execute(
                db.select(Artifact).where(
                    Artifact.result_id == result_id, Artifact.filename == "log.txt"
                )
            ).scalar_one_or_none()
            assert artifact is not None

    def test_run_archive_import_missing_record_returns_none(self, flask_app):
        """Archive import returns early when the import record is not found."""
        client, _ = flask_app
        with client.application.app_context():
            assert run_archive_import({"id": str(uuid4())}) is None

    def test_run_archive_import_with_run_level_artifact(self, make_import, flask_app):
        """Archive import upserts run-level artifacts without duplication."""
        client, _ = flask_app
        with client.application.app_context():
            run_id = str(uuid4())
            result_id = str(uuid4())

            run_data = {"id": run_id, "summary": {"tests": 1}}
            result_data = {
                "id": result_id,
                "test_id": "test.with_run_art",
                "result": "passed",
                "start_time": datetime.now(UTC).isoformat(),
            }

            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{result_id}/result.json": result_data,
                    f"{run_id}/console.log": b"run-level log content",
                }
            )

            import_record = make_import(
                filename="run_art.tar.gz", format="ibutsu", status="pending"
            )
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=tar_content
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record.id)})

            art = db.session.execute(
                db.select(Artifact).where(
                    Artifact.run_id == run_id, Artifact.filename == "console.log"
                )
            ).scalar_one_or_none()
            assert art is not None
            assert art.content == b"run-level log content"
            assert art.data["runId"] == run_id

            # Re-import should update the run artifact in-place without duplicating
            import_record2 = make_import(
                filename="run_art.tar.gz", format="ibutsu", status="pending"
            )
            import_file2 = ImportFile(
                id=str(uuid4()), import_id=import_record2.id, content=tar_content
            )
            db.session.add(import_file2)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record2.id)})

            run_arts = (
                db.session.execute(
                    db.select(Artifact).where(
                        Artifact.run_id == run_id, Artifact.filename == "console.log"
                    )
                )
                .scalars()
                .all()
            )
            assert len(run_arts) == 1
            assert run_arts[0].id == art.id

    def test_run_archive_import_run_json_without_id_field(self, make_import, flask_app):
        """Archive where run.json omits the 'id' field sets run_id from directory."""
        client, _ = flask_app
        with client.application.app_context():
            run_id = str(uuid4())
            result_id = str(uuid4())

            run_data = {"summary": {"tests": 1}}
            result_data = {
                "id": result_id,
                "test_id": "test.run_without_id",
                "result": "passed",
                "start_time": datetime.now(UTC).isoformat(),
            }

            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{result_id}/result.json": result_data,
                }
            )

            import_record = make_import(
                filename="no_run_id_field.tar.gz", format="ibutsu", status="pending"
            )
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=tar_content
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record.id)})

            run = db.session.get(Run, run_id)
            assert run is not None
            assert run.id == run_id

    def test_run_archive_import_with_user_properties_and_importer_metadata(
        self, make_import, make_project, flask_app
    ):
        """Archive import promotes user_properties and merges importer metadata and project."""
        client, _ = flask_app
        with client.application.app_context():
            proj = make_project(name="archive-user-props-project")
            run_id = str(uuid4())
            result_id = str(uuid4())

            run_data = {"id": run_id, "summary": {"tests": 1}}
            result_data = {
                "id": result_id,
                "test_id": "test.user_properties",
                "result": "passed",
                "start_time": datetime.now(UTC).isoformat(),
                "metadata": {
                    "user_properties": {"team": "qe", "tier": "smoke"},
                },
            }

            tar_content = make_archive_bytes(
                {
                    f"{run_id}/run.json": run_data,
                    f"{run_id}/{result_id}/result.json": result_data,
                }
            )

            import_record = make_import(
                filename="user_props.tar.gz", format="ibutsu", status="pending"
            )
            import_record.data = {
                "metadata": {"imported_by": "automation"},
                "project_id": proj.id,
            }
            db.session.add(import_record)
            import_file = ImportFile(
                id=str(uuid4()), import_id=import_record.id, content=tar_content
            )
            db.session.add(import_file)
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record.id)})

            result = db.session.get(Result, result_id)
            assert result is not None
            assert result.project_id == proj.id
            assert result.data.get("team") == "qe"
            assert result.data.get("tier") == "smoke"
            assert result.data.get("imported_by") == "automation"
            assert "user_properties" not in result.data

    def test_run_archive_import_skips_directories(self, make_import, flask_app):
        """Archive import gracefully skips directory members in the tarball."""
        client, _ = flask_app
        with client.application.app_context():
            run_id = str(uuid4())
            result_id = str(uuid4())

            tar_content = make_archive_bytes(
                {
                    f"{run_id}/": "dir",
                    f"{run_id}/{result_id}/": "dir",
                    f"{run_id}/{result_id}/result.json": {
                        "id": result_id,
                        "test_id": "test.dir",
                        "result": "passed",
                    },
                }
            )

            import_record = make_import(filename="dir.tar.gz", format="ibutsu", status="pending")
            db.session.add(
                ImportFile(id=str(uuid4()), import_id=import_record.id, content=tar_content)
            )
            db.session.commit()

            with (
                patch("ibutsu_server.tasks.importers.update_run"),
                patch("ibutsu_server.tasks.importers.clear_import_file_content"),
            ):
                run_archive_import({"id": str(import_record.id)})

            assert db.session.get(Import, import_record.id).status == "done"

    @pytest.mark.parametrize(
        ("bad_member_name", "error_match"),
        [
            ("not-a-uuid/run.json", "Invalid run ID not-a-uuid"),
            (
                "00000000-0000-4000-8000-000000000001/not-a-uuid/result.json",
                "Invalid result ID not-a-uuid",
            ),
            (
                "507f1f77bcf86cd799439011/run.json",
                "Invalid run ID 507f1f77bcf86cd799439011",
            ),
            (
                "00000000-0000-4000-8000-000000000001/507f1f77bcf86cd799439011/result.json",
                "Invalid result ID 507f1f77bcf86cd799439011",
            ),
            (
                "507f1f77bcf86cd799439011/507f191e810c19729de860ea/result.json",
                "Invalid run ID 507f1f77bcf86cd799439011",
            ),
            (
                "507f1f77bcf86cd799439011/artifact.log",
                "Invalid run ID 507f1f77bcf86cd799439011",
            ),
            (
                "00000000-0000-4000-8000-000000000001/507f1f77bcf86cd799439011/traceback.log",
                "Invalid result ID 507f1f77bcf86cd799439011",
            ),
        ],
    )
    def test_run_archive_import_invalid_uuids_raise_value_error(
        self, make_import, flask_app, bad_member_name, error_match
    ):
        """Archive import raises ValueError and marks import as error on bad UUIDs/ObjectIds."""
        client, _ = flask_app
        with client.application.app_context():
            tar_content = make_archive_bytes({bad_member_name: b"{}"})

            import_record = make_import(
                filename="bad_uuid.tar.gz", format="ibutsu", status="pending"
            )
            db.session.add(
                ImportFile(id=str(uuid4()), import_id=import_record.id, content=tar_content)
            )
            db.session.commit()

            with pytest.raises(ValueError, match=error_match):
                run_archive_import({"id": str(import_record.id)})

            assert db.session.get(Import, import_record.id).status == "error"

    @pytest.mark.parametrize(
        ("run_dir", "result_dir", "error_match"),
        [
            (
                "507f1f77bcf86cd799439011",
                "00000000-0000-4000-8000-000000000002",
                "Invalid run ID 507f1f77bcf86cd799439011",
            ),
            (
                "00000000-0000-4000-8000-000000000001",
                "507f1f77bcf86cd799439011",
                "Invalid result ID 507f1f77bcf86cd799439011",
            ),
        ],
    )
    def test_run_archive_import_objectid_rolls_back_and_marks_error(
        self, make_import, flask_app, run_dir, result_dir, error_match
    ):
        """Archive with legacy ObjectId fails cleanly, rolls back, and marks import error."""
        client, _ = flask_app
        with client.application.app_context():
            tar_content = make_archive_bytes(
                {
                    f"{run_dir}/run.json": {"id": run_dir},
                    f"{run_dir}/{result_dir}/result.json": {
                        "id": result_dir,
                        "test_id": "test.legacy",
                        "result": "passed",
                    },
                }
            )

            import_record = make_import(
                filename="legacy_oid.tar.gz", format="ibutsu", status="pending"
            )
            db.session.add(
                ImportFile(id=str(uuid4()), import_id=import_record.id, content=tar_content)
            )
            db.session.commit()

            with pytest.raises(ValueError, match=error_match):
                run_archive_import({"id": str(import_record.id)})

            assert db.session.get(Import, import_record.id).status == "error"
            if is_uuid(run_dir):
                assert db.session.get(Run, run_dir) is None
            if is_uuid(result_dir):
                assert db.session.get(Result, result_dir) is None


class TestExtractRunId:
    """Tests for _extract_run_id helper function"""

    def test_extract_run_id_from_data_list(self):
        rec = Import(data={"run_id": ["550e8400-e29b-41d4-a716-446655440000"]})
        assert _extract_run_id(rec) == "550e8400-e29b-41d4-a716-446655440000"

    def test_extract_run_id_from_data_str(self):
        rec = Import(data={"run_id": "550e8400-e29b-41d4-a716-446655440000"})
        assert _extract_run_id(rec) == "550e8400-e29b-41d4-a716-446655440000"

    def test_extract_run_id_from_filename(self):
        rec = Import(filename="junit-550e8400-e29b-41d4-a716-446655440000.xml")
        assert _extract_run_id(rec) == "550e8400-e29b-41d4-a716-446655440000"

    def test_extract_run_id_none(self):
        rec = Import(filename="plain.xml")
        assert _extract_run_id(rec) is None


class TestUpdateRunSummary:
    """Tests for _update_run_summary helper function"""

    def test_update_run_summary_populates_empty(self):
        run = Run(duration=0, summary={"errors": 0, "failures": 0})
        run_data = {
            "duration": 12.5,
            "errors": 1,
            "failures": 2,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
            "tests": 3,
        }
        _update_run_summary(run, run_data)
        assert run.duration == 12.5
        assert run.summary["errors"] == 1
        assert run.summary["failures"] == 2
