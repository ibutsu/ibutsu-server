"""Tests for ibutsu_server.tasks.runs module"""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

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
        from ibutsu_server.db import db
        from ibutsu_server.db.base import session
        from ibutsu_server.db.models import Run

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
