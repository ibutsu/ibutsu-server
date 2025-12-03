"""Tests for ibutsu_server.tasks.importers module"""

import json
import tarfile
from datetime import datetime, timezone
from io import BytesIO
from unittest.mock import patch
from uuid import uuid4

from lxml import objectify

from ibutsu_server.db.models import Artifact, ImportFile, Result, Run
from ibutsu_server.tasks.importers import (
    _add_artifacts,
    _get_properties,
    _get_test_name_path,
    _get_ts_element,
    _parse_timestamp,
    _populate_created_times,
    _populate_metadata,
    _populate_result_metadata,
    _process_result,
    _update_import_status,
    run_archive_import,
    run_junit_import,
)


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
        delta_seconds = abs((datetime.now(timezone.utc) - result).total_seconds())
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
        start_time = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)

        _populate_created_times(run_dict, start_time)

        assert run_dict["created"] == start_time
        assert run_dict["start_time"] == start_time

    def test_populate_created_times_start_time_only(self):
        """Test when only start_time is present"""
        start_time = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        run_dict = {"start_time": start_time}

        _populate_created_times(run_dict, None)

        assert run_dict["created"] == start_time
        assert run_dict["start_time"] == start_time

    def test_populate_created_times_created_only(self):
        """Test when only created is present"""
        created_time = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        run_dict = {"created": created_time}

        _populate_created_times(run_dict, None)

        assert run_dict["start_time"] == created_time
        assert run_dict["created"] == created_time

    def test_populate_created_times_both_present(self):
        """Test when both are already present"""
        created = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        start = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
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
            from ibutsu_server.db import db
            from ibutsu_server.db.models import Import

            updated = db.session.get(Import, import_record.id)
            assert updated.status == "running"

    def test_update_import_status_to_done(self, make_import, flask_app):
        """Test updating import status to done"""
        client, _ = flask_app

        with client.application.app_context():
            import_record = make_import(status="running")

            _update_import_status(import_record, "done")

            from ibutsu_server.db import db
            from ibutsu_server.db.models import Import

            updated = db.session.get(Import, import_record.id)
            assert updated.status == "done"

    def test_update_import_status_to_error(self, make_import, flask_app):
        """Test updating import status to error"""
        client, _ = flask_app

        with client.application.app_context():
            import_record = make_import(status="running")

            _update_import_status(import_record, "error")

            from ibutsu_server.db import db
            from ibutsu_server.db.models import Import

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

        # Create import file
        import_file = ImportFile(id=str(uuid4()), import_id=import_record.id, content=junit_xml)
        from ibutsu_server.db.base import session

        session.add(import_file)
        session.commit()

        # Run the import
        run_junit_import({"id": str(import_record.id)})

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
        from ibutsu_server.db import db
        from ibutsu_server.db.models import Import

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
            from ibutsu_server.db.base import session

            session.add(import_file)
            session.commit()

            run_junit_import({"id": str(import_record.id)})

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
            from ibutsu_server.db import db
            from ibutsu_server.db.models import Import

            updated = db.session.get(Import, import_record.id)
            assert updated.status == "error"


class TestRunArchiveImport:
    """Integration tests for run_archive_import task"""

    def test_run_archive_import_basic(self, make_import, flask_app):
        """Test basic archive import"""
        client, _ = flask_app

        with client.application.app_context():
            # Create a simple tarball with run and result
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
                "start_time": datetime.now(timezone.utc).isoformat(),
            }

            # Create tarball
            tar_buffer = BytesIO()
            with tarfile.open(fileobj=tar_buffer, mode="w:gz") as tar:
                # Add run.json
                run_json = json.dumps(run_data).encode()
                run_info = tarfile.TarInfo(name=f"{run_id}/run.json")
                run_info.size = len(run_json)
                tar.addfile(run_info, BytesIO(run_json))

                # Add result.json
                result_json = json.dumps(result_data).encode()
                result_info = tarfile.TarInfo(name=f"{run_id}/{result_id}/result.json")
                result_info.size = len(result_json)
                tar.addfile(result_info, BytesIO(result_json))

            tar_buffer.seek(0)
            tar_content = tar_buffer.read()

            import_record = make_import(
                filename="archive.tar.gz", format="ibutsu", status="pending"
            )

            # Create import file
            import_file = ImportFile(
                id=str(uuid4()),
                import_id=import_record.id,
                content=tar_content,
            )
            from ibutsu_server.db import db
            from ibutsu_server.db.base import session

            session.add(import_file)
            session.commit()

            # Mock the update_run task to avoid Redis dependency
            with patch("ibutsu_server.tasks.importers.update_run"):
                run_archive_import({"id": str(import_record.id)})

            # Verify run was created or updated
            run = db.session.get(Run, run_id)
            assert run is not None

            # Verify result was created (archive import creates new IDs for results)
            result = db.session.execute(
                db.select(Result).filter_by(test_id="test.example", run_id=run.id)
            ).scalar_one_or_none()
            assert result is not None
            assert result.test_id == "test.example"

            # Verify import status
            from ibutsu_server.db.models import Import

            updated = db.session.get(Import, import_record.id)
            assert updated.status == "done"

    def test_run_archive_import_missing_file(self, make_import, flask_app):
        """Test archive import with missing file"""
        client, _ = flask_app

        with client.application.app_context():
            import_record = make_import(
                filename="missing.tar.gz", format="ibutsu", status="pending"
            )

            # Don't create import file
            run_archive_import({"id": str(import_record.id)})

            # Verify status updated to error
            from ibutsu_server.db import db
            from ibutsu_server.db.models import Import

            updated = db.session.get(Import, import_record.id)
            assert updated.status == "error"
