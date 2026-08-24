"""Tests for ibutsu_server.tasks.results module"""

from unittest.mock import patch

import pytest
from redis.exceptions import LockError

from ibutsu_server.db import db
from ibutsu_server.db.models import Result
from ibutsu_server.tasks.results import add_result_start_time


def test_add_result_start_time_with_locked_run(make_project, make_run, flask_app):
    """Test that the task returns early -- and never touches the DB -- when the
    per-run lock is already held.

    Regression test for the is_locked()/lock() key mismatch: is_locked() must
    be called with the *same* key ("update-run-lock-{run_id}") that lock()
    acquires, not the bare run_id.
    """
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")
        run = make_run(project_id=project.id)

        with (
            patch("ibutsu_server.tasks.results.is_locked", return_value=True) as mock_is_locked,
            patch("ibutsu_server.tasks.results.lock") as mock_lock,
        ):
            result = add_result_start_time(str(run.id))

        mock_is_locked.assert_called_once_with(f"update-run-lock-{run.id}")
        mock_lock.assert_not_called()
        assert result is None


def test_add_result_start_time_with_nonexistent_run(flask_app):
    """Test that the task returns early when the run doesn't exist.

    The run existence check happens inside the lock to avoid TOCTOU races.
    The lock is acquired, the run is checked, and if it doesn't exist,
    the function returns early without processing.
    """
    client, _ = flask_app
    run_id = "12345678-1234-5678-1234-567812345678"

    # Track whether db.session.get was called inside the lock context
    lock_entered = False
    db_queried_inside_lock = False

    def track_lock_entry(*args, **kwargs):
        nonlocal lock_entered
        lock_entered = True

    def track_lock_exit(*args, **kwargs):
        nonlocal lock_entered
        lock_entered = False

    def track_db_query(model, run_id):
        """Track when db.session.get is called"""
        nonlocal db_queried_inside_lock
        if lock_entered:
            db_queried_inside_lock = True
        return None  # Simulate nonexistent run

    with (
        client.application.app_context(),
        patch("ibutsu_server.tasks.results.is_locked", return_value=False),
        patch("ibutsu_server.tasks.results.lock") as mock_lock,
        patch("ibutsu_server.tasks.results.db.session.get", side_effect=track_db_query),
    ):
        # Configure the mock to track context manager entry/exit
        mock_lock.return_value.__enter__ = track_lock_entry
        mock_lock.return_value.__exit__ = track_lock_exit

        result = add_result_start_time(run_id)

        # Verify lock was called with the correct key
        mock_lock.assert_called_once_with(f"update-run-lock-{run_id}")

        # Verify the database query happened inside the lock context
        assert db_queried_inside_lock, "db.session.get must be called inside the lock context"

        assert result is None


def test_add_result_start_time_discards_on_lock_error_race(make_project, make_run, flask_app):
    """If is_locked() races and lock() still raises LockError, the task should
    discard cleanly instead of letting the exception propagate (which would
    otherwise trip the global task_failure auto-retry handler)."""
    client, _ = flask_app

    with client.application.app_context():
        project = make_project(name="test-project")
        run = make_run(project_id=project.id)

        with (
            patch("ibutsu_server.tasks.results.is_locked", return_value=False),
            patch("ibutsu_server.tasks.results.lock", side_effect=LockError("busy")),
        ):
            # Should not raise
            result = add_result_start_time(str(run.id))

        assert result is None


def test_add_result_start_time_updates_results_with_start_time(
    flask_app, make_project, make_run, make_result
):
    """Test that the task updates results with start_time field"""
    client, _ = flask_app

    with client.application.app_context():
        # Create test data
        project = make_project(name="test-project")
        run = make_run(project_id=project.id)

        # Create results with starttime but no start_time
        # Note: We need to set data directly to have starttime without start_time
        result1 = Result(
            project_id=project.id,
            data={
                "metadata": {"run": str(run.id)},
                "starttime": "2024-01-01T10:00:00",
            },
        )
        result2 = Result(
            project_id=project.id,
            data={
                "metadata": {"run": str(run.id)},
                "starttime": "2024-01-01T11:00:00",
            },
        )

        db.session.add(result1)
        db.session.add(result2)
        db.session.commit()

        result1_id = result1.id
        result2_id = result2.id

        # Mock the lock functions
        with (
            patch("ibutsu_server.tasks.results.is_locked", return_value=False),
            patch("ibutsu_server.tasks.results.lock") as mock_lock,
        ):
            # Configure the mock to actually enter the context
            mock_lock.return_value.__enter__ = lambda _: None
            mock_lock.return_value.__exit__ = lambda *_: None

            # Run the task
            add_result_start_time(str(run.id))

            # Verify results were updated
            updated_result1 = db.session.get(Result, result1_id)
            updated_result2 = db.session.get(Result, result2_id)

            # Check that start_time was added from starttime
            assert updated_result1.data.get("start_time") == "2024-01-01T10:00:00"
            assert updated_result2.data.get("start_time") == "2024-01-01T11:00:00"


def test_add_result_start_time_skips_results_with_existing_start_time(
    flask_app, make_project, make_run
):
    """Test that the task skips results that already have start_time"""
    client, _ = flask_app

    with client.application.app_context():
        # Create test data
        project = make_project(name="test-project")
        run = make_run(project_id=project.id)

        # Create a result that already has start_time
        result = Result(
            project_id=project.id,
            data={
                "metadata": {"run": str(run.id)},
                "starttime": "2024-01-01T10:00:00",
                "start_time": "2024-01-01T09:00:00",  # Already has start_time
            },
        )
        db.session.add(result)
        db.session.commit()

        result_id = result.id
        original_start_time = result.data.get("start_time")

        # Mock the lock functions
        with (
            patch("ibutsu_server.tasks.results.is_locked", return_value=False),
            patch("ibutsu_server.tasks.results.lock") as mock_lock,
        ):
            # Configure the mock to actually enter the context
            mock_lock.return_value.__enter__ = lambda _: None
            mock_lock.return_value.__exit__ = lambda *_: None

            # Run the task
            add_result_start_time(str(run.id))

            # Verify the start_time was not changed
            updated_result = db.session.get(Result, result_id)
            assert updated_result.data.get("start_time") == original_start_time


def test_add_result_start_time_handles_results_without_starttime(flask_app, make_project, make_run):
    """Test that the task handles results that don't have starttime field"""
    client, _ = flask_app

    with client.application.app_context():
        # Create test data
        project = make_project(name="test-project")
        run = make_run(project_id=project.id)

        # Create a result without starttime
        result = Result(
            project_id=project.id,
            data={
                "metadata": {"run": str(run.id)},
                # No starttime field
            },
        )
        db.session.add(result)
        db.session.commit()

        result_id = result.id

        # Mock the lock functions
        with (
            patch("ibutsu_server.tasks.results.is_locked", return_value=False),
            patch("ibutsu_server.tasks.results.lock") as mock_lock,
        ):
            # Configure the mock to actually enter the context
            mock_lock.return_value.__enter__ = lambda _: None
            mock_lock.return_value.__exit__ = lambda *_: None

            # Run the task - should not crash
            add_result_start_time(str(run.id))

            # Verify the result still exists and wasn't modified
            updated_result = db.session.get(Result, result_id)
            assert updated_result is not None
            assert updated_result.data.get("start_time") is None


@pytest.mark.parametrize(
    "run_id",
    [
        "12345678-1234-5678-1234-567812345678",
        "abcdefab-abcd-abcd-abcd-abcdefabcdef",
        "00000000-0000-0000-0000-000000000000",
    ],
)
def test_add_result_start_time_with_various_run_ids(flask_app, run_id):
    """Test that the task handles various UUID formats for run_id.

    None of these correspond to a real Run, so the task will acquire the lock,
    check for the run inside the lock, and return early when not found.
    """
    client, _ = flask_app

    # Track whether db.session.get was called inside the lock context
    lock_entered = False
    db_queried_inside_lock = False

    def track_lock_entry(*args, **kwargs):
        nonlocal lock_entered
        lock_entered = True

    def track_lock_exit(*args, **kwargs):
        nonlocal lock_entered
        lock_entered = False

    def track_db_query(model, run_id_param):
        """Track when db.session.get is called"""
        nonlocal db_queried_inside_lock
        if lock_entered:
            db_queried_inside_lock = True
        return None  # Simulate nonexistent run

    with (
        client.application.app_context(),
        patch("ibutsu_server.tasks.results.is_locked", return_value=False),
        patch("ibutsu_server.tasks.results.lock") as mock_lock,
        patch("ibutsu_server.tasks.results.db.session.get", side_effect=track_db_query),
    ):
        # Configure the mock to track context manager entry/exit
        mock_lock.return_value.__enter__ = track_lock_entry
        mock_lock.return_value.__exit__ = track_lock_exit

        result = add_result_start_time(run_id)

        # Verify lock was called with the correct key
        mock_lock.assert_called_once_with(f"update-run-lock-{run_id}")

        # Verify the database query happened inside the lock context
        assert db_queried_inside_lock, "db.session.get must be called inside the lock context"

        assert result is None
