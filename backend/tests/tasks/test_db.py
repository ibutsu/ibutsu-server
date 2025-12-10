"""Tests for ibutsu_server.tasks.db module"""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from ibutsu_server.tasks.db import (
    prune_old_files,
    prune_old_results,
    prune_old_runs,
)


def test_prune_old_files(make_artifact, flask_app):
    """Test prune_old_files deletes old artifacts."""
    client, _ = flask_app

    with client.application.app_context():
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
        from ibutsu_server.db.models import Artifact

        artifacts = Artifact.query.all()
        artifact_ids = [a.id for a in artifacts]
        assert old_artifact_id not in artifact_ids
        assert recent_artifact_id in artifact_ids


def test_prune_old_files_minimum_months(make_artifact, flask_app):
    """Test prune_old_files doesn't delete files if months < 2."""
    client, _ = flask_app

    with client.application.app_context():
        old_date = datetime.now(UTC) - timedelta(days=180)
        old_artifact = make_artifact(upload_date=old_date)

        # Try to run with less than 2 months - should do nothing
        prune_old_files(months=1)

        from ibutsu_server.db import db
        from ibutsu_server.db.models import Artifact

        artifact = db.session.get(Artifact, old_artifact.id)
        assert artifact is not None


def test_prune_old_files_with_string_months(make_artifact, flask_app):
    """Test prune_old_files with string input for months."""
    client, _ = flask_app

    with client.application.app_context():
        old_date = datetime.now(UTC) - timedelta(days=180)
        old_artifact = make_artifact(upload_date=old_date)
        old_artifact_id = old_artifact.id

        # Pass months as string
        prune_old_files(months="5")

        from ibutsu_server.db.models import Artifact

        artifacts = Artifact.query.all()
        artifact_ids = [a.id for a in artifacts]
        assert old_artifact_id not in artifact_ids


def test_prune_old_results(make_result, flask_app):
    """Test prune_old_results deletes old results."""
    client, _ = flask_app

    with client.application.app_context():
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

        from ibutsu_server.db.models import Result

        results = Result.query.all()
        result_ids = [r.id for r in results]
        assert old_result_id not in result_ids
        assert recent_result_id in result_ids


def test_prune_old_results_minimum_months(make_result, flask_app):
    """Test prune_old_results doesn't delete if months < 4."""
    client, _ = flask_app

    with client.application.app_context():
        old_date = datetime.now(UTC) - timedelta(days=210)
        old_result = make_result(start_time=old_date, result="passed")

        prune_old_results(months=3)

        from ibutsu_server.db import db
        from ibutsu_server.db.models import Result

        result = db.session.get(Result, old_result.id)
        assert result is not None


def test_prune_old_runs(make_run, flask_app):
    """Test prune_old_runs deletes old runs."""
    client, _ = flask_app

    with client.application.app_context():
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

        from ibutsu_server.db.models import Run

        runs = Run.query.all()
        run_ids = [r.id for r in runs]
        assert old_run_id not in run_ids
        assert recent_run_id in run_ids


def test_prune_old_runs_minimum_months(make_run, flask_app):
    """Test prune_old_runs doesn't delete if months < 10."""
    client, _ = flask_app

    with client.application.app_context():
        old_date = datetime.now(UTC) - timedelta(days=400)
        old_run = make_run(start_time=old_date)

        prune_old_runs(months=9)

        from ibutsu_server.db import db
        from ibutsu_server.db.models import Run

        run = db.session.get(Run, old_run.id)
        assert run is not None


# Tests for seed_users


def test_seed_users_create_new_users_and_add_to_project(make_project, flask_app):
    """Test seed_users creates new users and adds them to project"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db.models import User
        from ibutsu_server.tasks.db import seed_users

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


def test_seed_users_with_owner(make_project, flask_app):
    """Test seed_users sets project owner"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db import db
        from ibutsu_server.db.models import Project, User
        from ibutsu_server.tasks.db import seed_users

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


def test_seed_users_existing_user(make_project, make_user, flask_app):
    """Test seed_users handles existing users"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db.models import User
        from ibutsu_server.tasks.db import seed_users

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


def test_seed_users_user_already_in_project(make_project, make_user, flask_app):
    """Test seed_users doesn't duplicate project membership"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db.models import User
        from ibutsu_server.tasks.db import seed_users

        project = make_project(name="test-project")
        project_id = project.id
        user = make_user(email="user@example.com")

        # Manually add user to project first
        user.projects.append(project)
        from ibutsu_server.db.base import session

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


def test_seed_users_nonexistent_project(flask_app):
    """Test seed_users handles non-existent project"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.tasks.db import seed_users

        projects_data = {
            "nonexistent-project": {
                "users": ["user@example.com"],
            }
        }

        # Should not raise error
        seed_users(projects_data)

        # Verify user was not created since project doesn't exist
        from ibutsu_server.db.models import User

        user = User.query.filter_by(email="user@example.com").first()
        assert user is None


def test_seed_users_empty_projects(flask_app):
    """Test seed_users with empty projects dict"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.tasks.db import seed_users

        # Should not raise error
        result = seed_users({})
        assert result is None


def test_seed_users_none_projects(flask_app):
    """Test seed_users with None projects"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.tasks.db import seed_users

        # Should not raise error
        result = seed_users(None)
        assert result is None


def test_seed_users_multiple_projects(make_project, flask_app):
    """Test seed_users with multiple projects"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db.models import User
        from ibutsu_server.tasks.db import seed_users

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


def test_seed_users_owner_is_also_user(make_project, flask_app):
    """Test seed_users when owner is also in users list"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db import db
        from ibutsu_server.db.models import Project, User
        from ibutsu_server.tasks.db import seed_users

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


def test_seed_users_updates_existing_owner(make_project, make_user, flask_app):
    """Test seed_users updates project owner if already exists"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db.models import Project
        from ibutsu_server.tasks.db import seed_users

        project = make_project(name="test-project")
        project_id = project.id
        old_owner = make_user(email="old@example.com")
        old_owner_email = old_owner.email
        project.owner = old_owner
        from ibutsu_server.db import db
        from ibutsu_server.db.base import session

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


def test_seed_users_empty_users_list(make_project, flask_app):
    """Test seed_users with empty users list"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.tasks.db import seed_users

        make_project(name="test-project")

        projects_data = {
            "test-project": {
                "users": [],
            }
        }

        # Should not raise error
        seed_users(projects_data)


def test_seed_users_no_users_key(make_project, flask_app):
    """Test seed_users when users key is missing"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.db import db
        from ibutsu_server.db.models import Project
        from ibutsu_server.tasks.db import seed_users

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


def test_seed_users_exception_handling(make_project, flask_app):
    """Test seed_users handles exceptions gracefully"""
    client, _ = flask_app

    with client.application.app_context():
        from ibutsu_server.tasks.db import seed_users

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
