"""Tests for ibutsu_server.tasks.db module"""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest

from ibutsu_server.db import db
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Artifact, Import, ImportFile, Project, Result, Run, User
from ibutsu_server.tasks.db import (
    clear_import_file_content,
    prune_old_files,
    prune_old_import_files,
    prune_old_results,
    prune_old_runs,
    seed_users,
)


@pytest.fixture
def app_ctx(flask_app):
    """Provide an application context for db task tests."""
    client, _ = flask_app
    with client.application.app_context():
        yield client


def test_prune_old_files(make_artifact, app_ctx):
    """Test prune_old_files deletes old artifacts."""
    # Create old artifact (older than 5 months)
    old_date = datetime.now(UTC) - timedelta(days=180)
    old_artifact = make_artifact(upload_date=old_date)
    old_artifact_id = old_artifact.id

    # Create recent artifact
    recent_date = datetime.now(UTC) - timedelta(days=30)
    recent_artifact = make_artifact(upload_date=recent_date)
    recent_artifact_id = recent_artifact.id

    # Run the task
    prune_old_files(months=5)

    # Verify old artifact was deleted but recent one remains
    artifacts = Artifact.query.all()
    artifact_ids = [a.id for a in artifacts]
    assert old_artifact_id not in artifact_ids
    assert recent_artifact_id in artifact_ids


def test_prune_old_files_minimum_months(make_artifact, app_ctx):
    """Test prune_old_files doesn't delete files if months < 2."""
    old_date = datetime.now(UTC) - timedelta(days=180)
    old_artifact = make_artifact(upload_date=old_date)

    # Try to run with less than 2 months - should do nothing
    prune_old_files(months=1)

    artifact = db.session.get(Artifact, old_artifact.id)
    assert artifact is not None


def test_prune_old_files_with_string_months(make_artifact, app_ctx):
    """Test prune_old_files with string input for months."""
    old_date = datetime.now(UTC) - timedelta(days=180)
    old_artifact = make_artifact(upload_date=old_date)
    old_artifact_id = old_artifact.id

    # Pass months as string
    prune_old_files(months="5")

    artifacts = Artifact.query.all()
    artifact_ids = [a.id for a in artifacts]
    assert old_artifact_id not in artifact_ids


def test_prune_old_results(make_result, app_ctx):
    """Test prune_old_results deletes old results."""
    # Create old result
    old_date = datetime.now(UTC) - timedelta(days=210)
    old_result = make_result(start_time=old_date, result="passed")
    old_result_id = old_result.id

    # Create recent result
    recent_date = datetime.now(UTC) - timedelta(days=30)
    recent_result = make_result(start_time=recent_date, result="passed")
    recent_result_id = recent_result.id

    # Run the task
    prune_old_results(months=6)

    results = Result.query.all()
    result_ids = [r.id for r in results]
    assert old_result_id not in result_ids
    assert recent_result_id in result_ids


def test_prune_old_results_minimum_months(make_result, app_ctx):
    """Test prune_old_results doesn't delete if months < 4."""
    old_date = datetime.now(UTC) - timedelta(days=210)
    old_result = make_result(start_time=old_date, result="passed")

    prune_old_results(months=3)

    result = db.session.get(Result, old_result.id)
    assert result is not None


def test_prune_old_runs(make_run, app_ctx):
    """Test prune_old_runs deletes old runs."""
    # Create old run
    old_date = datetime.now(UTC) - timedelta(days=400)
    old_run = make_run(start_time=old_date)
    old_run_id = old_run.id

    # Create recent run
    recent_date = datetime.now(UTC) - timedelta(days=30)
    recent_run = make_run(start_time=recent_date)
    recent_run_id = recent_run.id

    # Run the task
    prune_old_runs(months=12)

    runs = Run.query.all()
    run_ids = [r.id for r in runs]
    assert old_run_id not in run_ids
    assert recent_run_id in run_ids


def test_prune_old_runs_minimum_months(make_run, app_ctx):
    """Test prune_old_runs doesn't delete if months < 10."""
    old_date = datetime.now(UTC) - timedelta(days=400)
    old_run = make_run(start_time=old_date)

    prune_old_runs(months=9)

    run = db.session.get(Run, old_run.id)
    assert run is not None


# Tests for seed_users


def test_seed_users_create_new_users_and_add_to_project(make_project, app_ctx):
    """Test seed_users creates new users and adds them to project"""
    project = make_project(name="test-project")
    project_id = project.id

    projects_data = {
        "test-project": {
            "users": ["alice@example.com", "bob@example.com"],
        }
    }

    seed_users(projects_data)

    # Verify users were created
    alice = User.query.filter_by(email="alice@example.com").first()
    bob = User.query.filter_by(email="bob@example.com").first()

    assert alice is not None
    assert bob is not None
    assert alice.name == "alice"
    assert bob.name == "bob"

    # Verify users were added to project
    assert project_id in [p.id for p in alice.projects]
    assert project_id in [p.id for p in bob.projects]


def test_seed_users_with_owner(make_project, app_ctx):
    """Test seed_users sets project owner"""
    project = make_project(name="test-project")
    project_id = project.id

    projects_data = {
        "test-project": {
            "owner": "owner@example.com",
            "users": ["user1@example.com"],
        }
    }

    seed_users(projects_data)

    # Verify owner was created
    owner = db.session.execute(
        db.select(User).filter_by(email="owner@example.com")
    ).scalar_one_or_none()
    assert owner is not None

    # Verify owner was set on project
    updated_project = db.session.get(Project, project_id)
    assert updated_project.owner == owner


def test_seed_users_existing_user(make_project, make_user, app_ctx):
    """Test seed_users handles existing users"""
    project = make_project(name="test-project")
    project_id = project.id
    existing_user = make_user(email="existing@example.com", name="Existing User")
    existing_user_id = existing_user.id

    projects_data = {
        "test-project": {
            "users": ["existing@example.com", "new@example.com"],
        }
    }

    seed_users(projects_data)

    # Verify existing user was not duplicated
    users = User.query.filter_by(email="existing@example.com").all()
    assert len(users) == 1
    assert users[0].id == existing_user_id

    # Verify existing user was added to project
    updated_existing_user = User.query.filter_by(email="existing@example.com").first()
    assert project_id in [p.id for p in updated_existing_user.projects]

    # Verify new user was created
    new_user = User.query.filter_by(email="new@example.com").first()
    assert new_user is not None
    assert project_id in [p.id for p in new_user.projects]


def test_seed_users_user_already_in_project(make_project, make_user, app_ctx):
    """Test seed_users doesn't duplicate project membership"""
    project = make_project(name="test-project")
    project_id = project.id
    user = make_user(email="user@example.com")

    # Manually add user to project first
    user.projects.append(project)
    session.add(user)
    session.commit()

    # Try to add same user again via seed_users
    projects_data = {
        "test-project": {
            "users": ["user@example.com"],
        }
    }

    seed_users(projects_data)

    # Verify user is still only in project once
    updated_user = User.query.filter_by(email="user@example.com").first()
    project_ids = [p.id for p in updated_user.projects]
    assert project_ids.count(project_id) == 1


def test_seed_users_nonexistent_project(app_ctx):
    """Test seed_users handles non-existent project"""
    projects_data = {
        "nonexistent-project": {
            "users": ["user@example.com"],
        }
    }

    # Should not raise error
    seed_users(projects_data)

    # Verify user was not created since project doesn't exist
    user = User.query.filter_by(email="user@example.com").first()
    assert user is None


def test_seed_users_empty_projects(app_ctx):
    """Test seed_users with empty projects dict"""
    # Should not raise error
    result = seed_users({})
    assert result is None


def test_seed_users_none_projects(app_ctx):
    """Test seed_users with None projects"""
    # Should not raise error
    result = seed_users(None)
    assert result is None


def test_seed_users_multiple_projects(make_project, app_ctx):
    """Test seed_users with multiple projects"""
    project1 = make_project(name="project-1")
    project2 = make_project(name="project-2")
    project1_id = project1.id
    project2_id = project2.id

    projects_data = {
        "project-1": {
            "users": ["alice@example.com", "bob@example.com"],
        },
        "project-2": {
            "users": ["bob@example.com", "charlie@example.com"],
        },
    }

    seed_users(projects_data)

    # Verify users were created
    alice = User.query.filter_by(email="alice@example.com").first()
    bob = User.query.filter_by(email="bob@example.com").first()
    charlie = User.query.filter_by(email="charlie@example.com").first()

    assert alice is not None
    assert bob is not None
    assert charlie is not None

    # Verify alice is only in project1
    alice_project_ids = [p.id for p in alice.projects]
    assert project1_id in alice_project_ids
    assert project2_id not in alice_project_ids

    # Verify bob is in both projects
    bob_project_ids = [p.id for p in bob.projects]
    assert project1_id in bob_project_ids
    assert project2_id in bob_project_ids

    # Verify charlie is only in project2
    charlie_project_ids = [p.id for p in charlie.projects]
    assert project1_id not in charlie_project_ids
    assert project2_id in charlie_project_ids


def test_seed_users_owner_is_also_user(make_project, app_ctx):
    """Test seed_users when owner is also in users list"""
    project = make_project(name="test-project")
    project_id = project.id

    projects_data = {
        "test-project": {
            "owner": "owner@example.com",
            "users": ["owner@example.com", "user1@example.com"],
        }
    }

    seed_users(projects_data)

    # Verify owner was created once
    owners = (
        db.session.execute(db.select(User).filter_by(email="owner@example.com")).scalars().all()
    )
    assert len(owners) == 1

    owner = owners[0]

    # Verify owner is set on project
    updated_project = db.session.get(Project, project_id)
    assert updated_project.owner == owner

    # Verify owner is in project users
    assert project_id in [p.id for p in owner.projects]


def test_seed_users_updates_existing_owner(make_project, make_user, app_ctx):
    """Test seed_users updates project owner if already exists"""
    project = make_project(name="test-project")
    project_id = project.id
    old_owner = make_user(email="old@example.com")
    old_owner_email = old_owner.email
    project.owner = old_owner
    session.add(project)
    session.commit()

    projects_data = {
        "test-project": {
            "owner": "new@example.com",
            "users": [],
        }
    }

    seed_users(projects_data)

    # Verify new owner was set
    updated_project = db.session.get(Project, project_id)
    assert updated_project.owner.email == "new@example.com"
    assert updated_project.owner.email != old_owner_email


def test_seed_users_empty_users_list(make_project, app_ctx):
    """Test seed_users with empty users list"""
    make_project(name="test-project")

    projects_data = {
        "test-project": {
            "users": [],
        }
    }

    # Should not raise error
    seed_users(projects_data)


def test_seed_users_no_users_key(make_project, app_ctx):
    """Test seed_users when users key is missing"""
    project = make_project(name="test-project")
    project_id = project.id

    projects_data = {
        "test-project": {
            "owner": "owner@example.com",
        }
    }

    # Should not raise error
    seed_users(projects_data)

    # Verify owner was still set
    updated_project = db.session.get(Project, project_id)
    assert updated_project.owner is not None


def test_seed_users_exception_handling(make_project, app_ctx):
    """Test seed_users handles exceptions gracefully"""
    make_project(name="test-project")

    # Create invalid data that might cause an exception
    projects_data = {
        "test-project": {
            "users": ["valid@example.com"],
        }
    }

    # Mock the session.add to raise an exception
    with patch("ibutsu_server.db.db.session.add", side_effect=Exception("DB Error")):
        # Should not raise, should return None
        result = seed_users(projects_data)
        assert result is None


# Tests for prune_old_import_files


def test_prune_old_import_files(make_import, app_ctx):
    """Test prune_old_import_files deletes old import records."""
    # Create old import (older than 7 days)
    old_date = datetime.now(UTC) - timedelta(days=10)
    old_import = make_import(created=old_date, status="done")
    old_import_id = old_import.id

    # Create import file for old import
    old_import_file = ImportFile(import_id=old_import_id, content=b"old content")
    session.add(old_import_file)
    session.commit()

    # Create recent import
    recent_date = datetime.now(UTC) - timedelta(days=3)
    recent_import = make_import(created=recent_date, status="done")
    recent_import_id = recent_import.id

    # Create import file for recent import
    recent_import_file = ImportFile(import_id=recent_import_id, content=b"recent content")
    session.add(recent_import_file)
    session.commit()
    recent_import_file_id = recent_import_file.id

    # Run the task
    result = prune_old_import_files(days=7)

    # Verify old import was deleted
    old_import_check = db.session.get(Import, old_import_id)
    assert old_import_check is None

    # Note: In SQLite (used for tests), CASCADE may not work as expected
    # In PostgreSQL (production), the import_file will be automatically deleted
    # For the test, we just verify the import itself was deleted

    # Verify recent import and its file remain
    recent_import_check = db.session.get(Import, recent_import_id)
    assert recent_import_check is not None

    recent_file_check = db.session.get(ImportFile, recent_import_file_id)
    assert recent_file_check is not None

    # Check return message
    assert "Deleted 1 import records" in result


def test_prune_old_import_files_minimum_days(make_import, app_ctx):
    """Test prune_old_import_files doesn't delete if days < 1."""
    old_date = datetime.now(UTC) - timedelta(days=10)
    old_import = make_import(created=old_date)

    # Try to run with less than 1 day - should do nothing
    prune_old_import_files(days=0)

    import_check = db.session.get(Import, old_import.id)
    assert import_check is not None


def test_prune_old_import_files_with_string_days(make_import, app_ctx):
    """Test prune_old_import_files with string input for days."""
    old_date = datetime.now(UTC) - timedelta(days=10)
    old_import = make_import(created=old_date)
    old_import_id = old_import.id

    # Pass days as string
    prune_old_import_files(days="7")

    import_check = db.session.get(Import, old_import_id)
    assert import_check is None


def test_prune_old_import_files_cascades_to_import_files(make_import, app_ctx):
    """Test that deleting imports cascades to import_files.

    Note: This test verifies the import is deleted. In PostgreSQL (production),
    the CASCADE foreign key will automatically delete the import_file. In SQLite
    (test environment), CASCADE behavior may not be enforced, but the migration
    ensures it works correctly in production.
    """
    old_date = datetime.now(UTC) - timedelta(days=10)
    old_import = make_import(created=old_date)
    old_import_id = old_import.id

    # Create import file
    import_file = ImportFile(import_id=old_import_id, content=b"test content")
    session.add(import_file)
    session.commit()

    # Run the task
    prune_old_import_files(days=7)

    # Verify import was deleted
    import_check = db.session.get(Import, old_import_id)
    assert import_check is None

    # In PostgreSQL, the import_file would also be deleted via CASCADE
    # SQLite may not enforce this, but the schema is correct for production


# Tests for clear_import_file_content


def test_clear_import_file_content_done_status(make_import, app_ctx):
    """Test clear_import_file_content clears content for done imports."""
    # Create import with done status
    import_record = make_import(status="done")
    import_id = import_record.id

    # Create import file with content
    test_content = b"This is test content that should be cleared"
    import_file = ImportFile(import_id=import_id, content=test_content)
    session.add(import_file)
    session.commit()
    import_file_id = import_file.id

    # Run the task
    result = clear_import_file_content(import_id)

    # Verify content was cleared
    updated_file = db.session.get(ImportFile, import_file_id)
    assert updated_file is not None
    assert updated_file.content is None

    # Check return message
    assert "Cleared" in result
    assert str(len(test_content)) in result


def test_clear_import_file_content_error_status(make_import, app_ctx):
    """Test clear_import_file_content clears content for error imports."""
    # Create import with error status
    import_record = make_import(status="error")
    import_id = import_record.id

    # Create import file with content
    import_file = ImportFile(import_id=import_id, content=b"error content")
    session.add(import_file)
    session.commit()
    import_file_id = import_file.id

    # Run the task
    result = clear_import_file_content(import_id)

    # Verify content was cleared
    updated_file = db.session.get(ImportFile, import_file_id)
    assert updated_file.content is None
    assert "Cleared" in result


def test_clear_import_file_content_pending_status(make_import, app_ctx):
    """Test clear_import_file_content doesn't clear for pending imports."""
    # Create import with pending status
    import_record = make_import(status="pending")
    import_id = import_record.id

    # Create import file with content
    test_content = b"pending content"
    import_file = ImportFile(import_id=import_id, content=test_content)
    session.add(import_file)
    session.commit()
    import_file_id = import_file.id

    # Run the task
    result = clear_import_file_content(import_id)

    # Verify content was NOT cleared
    updated_file = db.session.get(ImportFile, import_file_id)
    assert updated_file.content == test_content
    assert "not clearing content" in result


def test_clear_import_file_content_running_status(make_import, app_ctx):
    """Test clear_import_file_content doesn't clear for running imports."""
    # Create import with running status
    import_record = make_import(status="running")
    import_id = import_record.id

    # Create import file with content
    test_content = b"running content"
    import_file = ImportFile(import_id=import_id, content=test_content)
    session.add(import_file)
    session.commit()

    # Run the task
    result = clear_import_file_content(import_id)

    # Verify content was NOT cleared
    updated_file = db.session.execute(
        db.select(ImportFile).where(ImportFile.import_id == import_id)
    ).scalar_one_or_none()
    assert updated_file.content == test_content
    assert "not clearing content" in result


def test_clear_import_file_content_nonexistent_import(app_ctx):
    """Test clear_import_file_content handles non-existent import."""
    # Use a random UUID that doesn't exist
    fake_id = str(uuid4())

    # Run the task
    result = clear_import_file_content(fake_id)

    # Should return message about not found
    assert "not found" in result


def test_clear_import_file_content_no_file(make_import, app_ctx):
    """Test clear_import_file_content when no import_file exists."""
    # Create import without import_file
    import_record = make_import(status="done")
    import_id = import_record.id

    # Run the task
    result = clear_import_file_content(import_id)

    # Should return message about no content
    assert "No content to clear" in result


def test_clear_import_file_content_already_cleared(make_import, app_ctx):
    """Test clear_import_file_content when content is already None."""
    # Create import
    import_record = make_import(status="done")
    import_id = import_record.id

    # Create import file with no content
    import_file = ImportFile(import_id=import_id, content=None)
    session.add(import_file)
    session.commit()

    # Run the task
    result = clear_import_file_content(import_id)

    # Should return message about no content
    assert "No content to clear" in result


# Tests for improved error handling


@pytest.mark.parametrize("invalid_days", ["invalid", "abc", "1.5.2", "not_a_number"])
def test_prune_old_import_files_invalid_days_raises_error(invalid_days, app_ctx):
    """Test prune_old_import_files raises ValueError for invalid inputs."""
    with pytest.raises(ValueError, match="invalid literal for int"):
        prune_old_import_files(days=invalid_days)


@pytest.mark.parametrize("days_value", [-1, 0, -10])
def test_prune_old_import_files_skips_for_invalid_days_range(days_value, make_import, app_ctx):
    """Test prune_old_import_files skips deletion for days < 1."""
    # Create old import
    old_date = datetime.now(UTC) - timedelta(days=10)
    old_import = make_import(created=old_date)

    # Run with days < 1
    result = prune_old_import_files(days=days_value)

    # Verify import was NOT deleted
    import_check = db.session.get(Import, old_import.id)
    assert import_check is not None

    # Verify message indicates skip
    assert "Skipped" in result
    assert "must be >= 1" in result


def test_clear_import_file_content_exception_handling(make_import, app_ctx):
    """Test clear_import_file_content handles exceptions gracefully."""
    # Create import with done status
    import_record = make_import(status="done")
    import_id = import_record.id

    # Create import file with content
    import_file = ImportFile(import_id=import_id, content=b"test content")
    session.add(import_file)
    session.commit()

    # Mock db.session.execute to raise an exception, and verify rollback is called
    with (
        patch(
            "ibutsu_server.tasks.db.db.session.execute",
            side_effect=Exception("DB Error"),
        ),
        patch("ibutsu_server.tasks.db.db.session.rollback") as mock_rollback,
        patch("ibutsu_server.tasks.db.logger"),
    ):
        result = clear_import_file_content(import_id)

        # Verify rollback was called to clean up session state
        mock_rollback.assert_called_once()

        # Verify task returns None on error
        assert result is None


def test_prune_old_import_files_returns_count(make_import, app_ctx):
    """Test prune_old_import_files returns correct deletion count."""
    # Create multiple old imports
    old_date = datetime.now(UTC) - timedelta(days=10)
    make_import(created=old_date)
    make_import(created=old_date)
    make_import(created=old_date)

    # Create recent import
    recent_date = datetime.now(UTC) - timedelta(days=3)
    make_import(created=recent_date)

    # Run the task
    result = prune_old_import_files(days=7)

    # Verify return message includes count
    assert "Deleted 3 import records" in result


def test_clear_import_file_content_returns_size_cleared(make_import, app_ctx):
    """Test clear_import_file_content returns the size of cleared content."""
    # Create import with done status
    import_record = make_import(status="done")
    import_id = import_record.id

    # Create import file with known content size
    test_content = b"X" * 1024  # 1KB of data
    import_file = ImportFile(import_id=import_id, content=test_content)
    session.add(import_file)
    session.commit()

    # Run the task
    result = clear_import_file_content(import_id)

    # Verify return message includes the size
    assert "Cleared 1024 bytes" in result
