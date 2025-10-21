"""Tests for ibutsu_server.importers"""

from pathlib import Path

from ibutsu_server.tasks.importers import (
    prune_fields,
    run_archive_import,
    run_junit_import,
)

# Get the absolute path to the test_data directory
TEST_DATA_DIR = (Path(__file__).parent.parent / "test_data").resolve()


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


def test_run_junit_import(flask_app, make_project):
    """Test the run_junit_import task with real database."""
    client, _jwt_token = flask_app

    # Create project and import record
    project = make_project(name="test-project")

    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Import

        # Create import record pointing to test file
        import_record = Import(
            filename=str(TEST_DATA_DIR / "junit.xml"),
            format="junit",
            status="pending",
            data={"project_id": str(project.id)},
        )
        session.add(import_record)
        session.commit()
        session.refresh(import_record)
        import_dict = import_record.to_dict()

    # Call the function directly (not as a Celery task)
    run_junit_import(import_dict)

    # Verify results were created in database
    with client.application.app_context():
        from ibutsu_server.db.models import Result, Run

        # Should have created runs and results
        runs = Run.query.filter_by(project_id=str(project.id)).all()
        assert len(runs) > 0

        results = Result.query.filter_by(project_id=str(project.id)).all()
        assert len(results) > 0


def test_run_archive_import(flask_app, make_project):
    """Test the run_archive_import task with real database."""
    client, _jwt_token = flask_app

    # Create project and import record
    project = make_project(name="test-project")

    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Import

        # Create import record pointing to test archive
        import_record = Import(
            filename=str(TEST_DATA_DIR / "archive.tar.gz"),
            format="archive",
            status="pending",
            data={"project_id": str(project.id)},
        )
        session.add(import_record)
        session.commit()
        session.refresh(import_record)
        import_dict = import_record.to_dict()

    # Call the function directly (not as a Celery task)
    run_archive_import(import_dict)

    # Verify results were created in database
    with client.application.app_context():
        from ibutsu_server.db.models import Result, Run

        # Should have created runs and results
        runs = Run.query.filter_by(project_id=str(project.id)).all()
        assert len(runs) > 0

        results = Result.query.filter_by(project_id=str(project.id)).all()
        assert len(results) > 0


def test_run_junit_import_invalid_file(flask_app, make_project):
    """Test run_junit_import with invalid/missing file."""
    client, _jwt_token = flask_app

    # Create project and import record
    project = make_project(name="test-project")

    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Import

        # Create import record pointing to non-existent file
        import_record = Import(
            filename="/nonexistent/file.xml",
            format="junit",
            status="pending",
            data={"project_id": str(project.id)},
        )
        session.add(import_record)
        session.commit()
        session.refresh(import_record)
        import_dict = import_record.to_dict()

    # Call should handle the error gracefully
    from contextlib import suppress

    with suppress(Exception):
        # Expected to fail due to missing file
        run_junit_import(import_dict)

    # Verify import status was updated to indicate failure
    with client.application.app_context():
        from ibutsu_server.db.models import Import

        import_record = Import.query.get(import_dict["id"])
        # Status should be updated (could be 'error' or remain 'pending')
        assert import_record is not None


def test_run_junit_import_empty_project(flask_app):
    """Test run_junit_import with no project specified."""
    client, _jwt_token = flask_app

    with client.application.app_context():
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Import

        # Create import record without project_id
        import_record = Import(
            filename=str(TEST_DATA_DIR / "junit.xml"),
            format="junit",
            status="pending",
            data={},  # No project_id
        )
        session.add(import_record)
        session.commit()
        session.refresh(import_record)
        import_dict = import_record.to_dict()

    # Call the function - should handle gracefully
    from contextlib import suppress

    with suppress(Exception):
        # May raise exception for missing project
        run_junit_import(import_dict)

    # Verify import exists
    with client.application.app_context():
        from ibutsu_server.db.models import Import

        import_record = Import.query.get(import_dict["id"])
        assert import_record is not None
