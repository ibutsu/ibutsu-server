"""Tests for ibutsu_server.db.util module."""

from sqlalchemy import text

from ibutsu_server.db import db
from ibutsu_server.db.models import Project, User
from ibutsu_server.db.util import Explain, add_superadmin


class TestExplain:
    """Tests for Explain class."""

    def test_explain_basic_query(self, flask_app):
        """Test Explain with a basic SQLAlchemy query."""
        client, _ = flask_app
        with client.application.app_context():
            query = db.select(User)
            explain_query = Explain(query)
            # Check that the explain object was created
            assert explain_query.statement is not None
            assert explain_query.analyze is False

    def test_explain_with_analyze(self, flask_app):
        """Test Explain with analyze=True."""
        client, _ = flask_app
        with client.application.app_context():
            query = db.select(User)
            explain_query = Explain(query, analyze=True)
            assert explain_query.statement is not None
            assert explain_query.analyze is True

    def test_explain_with_text_string(self, flask_app):
        """Test Explain with a text string query."""
        client, _ = flask_app
        with client.application.app_context():
            query_string = "SELECT * FROM users"
            explain_query = Explain(query_string)
            assert explain_query.statement is not None
            # Statement should be wrapped in text()
            assert isinstance(explain_query.statement, type(text("")))

    def test_explain_inherit_cache(self):
        """Test that Explain has inherit_cache set for SQLAlchemy 2.x compatibility."""
        assert hasattr(Explain, "inherit_cache")
        assert Explain.inherit_cache is True


class TestAddSuperadmin:
    """Tests for add_superadmin function."""

    def test_add_superadmin_new_user(self, flask_app):
        """Test adding a new superadmin user."""
        client, _ = flask_app
        with client.application.app_context():
            from ibutsu_server.db.base import session

            # Add new superadmin
            result = add_superadmin(
                session, name="New Admin", email="newadmin@test.com", password="secret123"
            )

            # Verify user was created
            user = session.execute(
                db.select(User).where(User.email == "newadmin@test.com")
            ).scalar_one_or_none()
            assert user is not None
            assert user.name == "New Admin"
            assert user.is_superadmin is True
            assert user.is_active is True
            # Result should be None for new user
            assert result is None

    def test_add_superadmin_existing_superadmin(self, flask_app, make_user):
        """Test adding an existing superadmin returns the user."""
        client, _ = flask_app
        with client.application.app_context():
            from ibutsu_server.db.base import session

            # Create existing superadmin
            existing_user = make_user(
                email="existing@test.com", name="Existing Admin", is_superadmin=True
            )

            # Try to add again
            result = add_superadmin(
                session, name="Should Not Change", email="existing@test.com", password="newpass"
            )

            # Should return the existing user
            assert result is not None
            assert result.id == existing_user.id
            # Name should not be changed
            assert result.name == "Existing Admin"

    def test_add_superadmin_upgrade_regular_user(self, flask_app, make_user):
        """Test upgrading a regular user to superadmin."""
        client, _ = flask_app
        with client.application.app_context():
            from ibutsu_server.db.base import session

            # Create regular user
            regular_user = make_user(
                email="regular@test.com", name="Regular User", is_superadmin=False
            )
            user_id = regular_user.id

            # Upgrade to superadmin
            result = add_superadmin(
                session, name="Regular User", email="regular@test.com", password="newpass"
            )

            # User should now be superadmin
            user = session.execute(db.select(User).where(User.id == user_id)).scalar_one_or_none()
            assert user is not None
            assert user.is_superadmin is True
            assert result is None

    def test_add_superadmin_with_project(self, flask_app):
        """Test adding a superadmin with their own project."""
        client, _ = flask_app
        with client.application.app_context():
            from ibutsu_server.db.base import session

            # Add superadmin with project
            add_superadmin(
                session,
                name="Admin With Project",
                email="adminproject@test.com",
                password="secret",
                own_project="admin-project",
            )

            # Verify user was created
            user = session.execute(
                db.select(User).where(User.email == "adminproject@test.com")
            ).scalar_one_or_none()
            assert user is not None
            assert user.is_superadmin is True

            # Verify project was created
            project = session.execute(
                db.select(Project).where(
                    Project.name == "admin-project", Project.owner_id == user.id
                )
            ).scalar_one_or_none()
            assert project is not None
            assert project.name == "admin-project"
            assert project.owner_id == user.id

    def test_add_superadmin_with_existing_project(self, flask_app, make_user, make_project):
        """Test adding superadmin when their project already exists."""
        client, _ = flask_app
        with client.application.app_context():
            from ibutsu_server.db.base import session

            # Create user and project first
            user = make_user(email="projowner@test.com", name="Project Owner")
            make_project(name="existing-project", owner_id=user.id)

            # Try to add superadmin again with same project
            add_superadmin(
                session,
                name="Project Owner",
                email="projowner@test.com",
                password="pass",
                own_project="existing-project",
            )

            # Should not create duplicate project
            projects = (
                session.execute(
                    db.select(Project).where(
                        Project.name == "existing-project", Project.owner_id == user.id
                    )
                )
                .scalars()
                .all()
            )
            assert len(projects) == 1

    def test_add_superadmin_without_password(self, flask_app):
        """Test adding a superadmin with a password."""
        client, _ = flask_app
        with client.application.app_context():
            from ibutsu_server.db.base import session

            # Add superadmin with password (password is required by User model)
            add_superadmin(session, name="Pass Admin", email="pass@test.com", password="secret123")

            # Verify user was created
            user = session.execute(
                db.select(User).where(User.email == "pass@test.com")
            ).scalar_one_or_none()
            assert user is not None
            assert user.is_superadmin is True
            # Verify password was set (will be hashed)
            assert user._password is not None
