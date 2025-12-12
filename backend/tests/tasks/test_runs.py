"""Tests for ibutsu_server.tasks.runs module"""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from ibutsu_server.db import db
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Run
from ibutsu_server.tasks.runs import sync_aborted_runs, update_run


def test_update_run(make_project, make_run, make_result, flask_app, fixed_time):
    """Test update_run updates run summary from results."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")
        run = make_run(
            project_id=project.id,
            summary={"collected": 10, "tests": 0, "failures": 0, "errors": 0},
        )

        # Create results for the run
        make_result(
            run_id=run.id,
            project_id=project.id,
            result="passed",
            duration=1.5,
            start_time=fixed_time,
        )
        make_result(
            run_id=run.id,
            project_id=project.id,
            result="failed",
            duration=2.0,
            start_time=fixed_time,
        )
        make_result(
            run_id=run.id,
            project_id=project.id,
            result="error",
            duration=1.0,
            start_time=fixed_time,
        )

        # Mock the lock to prevent Redis dependency
        with patch("ibutsu_server.tasks.runs.lock"):
            update_run(str(run.id))

        # Refresh run from database
        session.expire_all()
        updated_run = db.session.get(Run, run.id)

        assert updated_run.summary["tests"] == 3
        assert updated_run.summary["passes"] == 1
        assert updated_run.summary["failures"] == 1
        assert updated_run.summary["errors"] == 1
        assert updated_run.duration == 4.5


def test_update_run_nonexistent(flask_app):
    """Test update_run with non-existent run ID."""
    client, _ = flask_app

    with client.application.app_context(), patch("ibutsu_server.tasks.runs.lock"):
        # Should not raise an error
        result = update_run("00000000-0000-0000-0000-000000000000")
        assert result is None


def test_sync_aborted_runs(make_project, make_run, make_result, flask_app):
    """Test sync_aborted_runs finds and syncs runs with mismatched result counts."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")

        # Create a recent run with summary.tests not matching actual results
        recent_time = datetime.now(UTC) - timedelta(minutes=30)
        run = make_run(
            project_id=project.id,
            start_time=recent_time,
            summary={"tests": 10, "collected": 10},  # Says 10 tests
        )

        # But only create 5 results
        for _i in range(5):
            make_result(
                run_id=run.id, project_id=project.id, result="passed", start_time=recent_time
            )

        # Mock the task's apply_async to verify it's called
        with patch.object(update_run, "apply_async") as mock_apply:
            sync_aborted_runs()

            # Verify update_run was scheduled for this run
            mock_apply.assert_called_once()
            call_args = mock_apply.call_args
            assert call_args[0][0][0] == run.id


def test_sync_aborted_runs_with_none_summary(make_project, make_run, flask_app):
    """Test sync_aborted_runs handles runs with None summary gracefully."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")
        recent_time = datetime.now(UTC) - timedelta(minutes=30)

        # Create a run with None summary (bypassing make_run to force None)
        run = Run(
            project_id=project.id,
            start_time=recent_time,
            summary=None,
        )
        db.session.add(run)
        db.session.commit()

        # Should not crash
        try:
            with patch.object(update_run, "apply_async"):
                sync_aborted_runs()
                # May or may not be called depending on how None is handled
        except (KeyError, TypeError) as e:
            # This would indicate a bug in the implementation
            msg = f"sync_aborted_runs should handle None summary gracefully: {e}"
            raise AssertionError(msg) from e


def test_sync_aborted_runs_with_empty_summary(make_project, make_run, flask_app):
    """Test sync_aborted_runs handles runs with empty summary dict gracefully."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")
        recent_time = datetime.now(UTC) - timedelta(minutes=30)

        # Create a run with empty summary dict
        run = Run(
            project_id=project.id,
            start_time=recent_time,
            summary={},
        )
        db.session.add(run)
        db.session.commit()

        # Should not crash
        try:
            with patch.object(update_run, "apply_async"):
                sync_aborted_runs()
                # May or may not be called depending on default value handling
        except (KeyError, TypeError) as e:
            # This would indicate a bug in the implementation
            msg = f"sync_aborted_runs should handle empty summary dict gracefully: {e}"
            raise AssertionError(msg) from e


def test_sync_aborted_runs_with_missing_tests_key(make_project, make_run, flask_app):
    """Test sync_aborted_runs handles runs with summary missing 'tests' key."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")
        recent_time = datetime.now(UTC) - timedelta(minutes=30)

        # Create a run with summary that has some keys but not 'tests'
        run = Run(
            project_id=project.id,
            start_time=recent_time,
            summary={"collected": 5, "errors": 0},  # Has other keys but not 'tests'
        )
        db.session.add(run)
        db.session.commit()

        # Should not crash
        try:
            with patch.object(update_run, "apply_async"):
                sync_aborted_runs()
                # Should handle missing 'tests' key gracefully
        except KeyError as e:
            # This would indicate a bug - should use .get() instead of direct access
            msg = f"sync_aborted_runs should handle missing 'tests' key gracefully: {e}"
            raise AssertionError(msg) from e


def test_update_run_with_none_summary(make_project, make_run, make_result, flask_app):
    """Test update_run handles and fixes runs with None summary."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")

        # Create a run with None summary
        run = Run(
            project_id=project.id,
            summary=None,
        )
        db.session.add(run)
        db.session.commit()
        run_id = run.id

        # Add some results
        make_result(
            run_id=run_id,
            project_id=project.id,
            result="passed",
        )
        make_result(
            run_id=run_id,
            project_id=project.id,
            result="failed",
        )

        # Mock the lock to prevent Redis dependency
        with patch("ibutsu_server.tasks.runs.lock"):
            update_run(str(run_id))

        # Refresh run from database
        session.expire_all()
        updated_run = db.session.get(Run, run_id)

        # Should have created a proper summary
        assert updated_run.summary is not None
        assert updated_run.summary["tests"] == 2
        assert updated_run.summary["passes"] == 1
        assert updated_run.summary["failures"] == 1


def test_update_run_with_empty_summary(make_project, make_run, make_result, flask_app):
    """Test update_run handles and fixes runs with empty summary dict."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")

        # Create a run with empty summary
        run = Run(
            project_id=project.id,
            summary={},
        )
        db.session.add(run)
        db.session.commit()
        run_id = run.id

        # Add some results
        make_result(
            run_id=run_id,
            project_id=project.id,
            result="passed",
        )

        # Mock the lock to prevent Redis dependency
        with patch("ibutsu_server.tasks.runs.lock"):
            update_run(str(run_id))

        # Refresh run from database
        session.expire_all()
        updated_run = db.session.get(Run, run_id)

        # Should have created a proper summary
        assert updated_run.summary is not None
        assert "tests" in updated_run.summary
        assert updated_run.summary["tests"] == 1
        assert updated_run.summary["passes"] == 1
