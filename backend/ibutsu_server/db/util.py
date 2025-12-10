"""
Various utility DB functions
"""

from sqlalchemy import inspect, text
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.expression import ClauseElement, Executable

from ibutsu_server.db import db, models


class Explain(Executable, ClauseElement):
    """
    EXPLAIN a SQLAlchemy query (only for PSQL)
    e.g.
        query = db.select(Run)
        db.session.execute(Explain(query)).fetchall()

    cf. http://www.wmmi.net/documents/SQLAlchemy.pdf for more info
    """

    # Enable SQL compilation caching for better performance in SQLAlchemy 2.x
    inherit_cache = True

    def __init__(self, stmt, analyze=False):
        # SQLAlchemy 2.0+ compatibility: use text() for string conversion
        if hasattr(stmt, "statement"):
            # If it's a query object, get the statement
            self.statement = stmt.statement
        elif isinstance(stmt, str):
            # If it's a string, wrap in text()
            self.statement = text(stmt)
        else:
            # Otherwise assume it's already a valid statement
            self.statement = stmt
        self.analyze = analyze


@compiles(Explain, "postgresql")
def pg_explain(element, compiler, **_kw):
    text = "EXPLAIN "
    if element.analyze:
        text += "ANALYZE "
    text += compiler.process(element.statement)
    return text


def add_superadmin(
    *,
    name: str = "Ibutsu Admin",
    email: str,
    password: str | None = None,
    own_project: str | None = None,
):
    """
    Adds a superadmin user to Ibutsu.

    Uses Flask-SQLAlchemy's db.session proxy directly, which is the proper
    approach for Flask-SQLAlchemy 3.x.

    Returns:
        None on success, or if tables don't exist yet (e.g., before migrations run).

    Note:
        This function checks if the required tables exist before attempting to
        create the superadmin. This is important on fresh databases where the
        schema hasn't been created yet.
    """
    # Check if the User table exists before attempting to query it
    # This prevents failures on fresh databases before Alembic migrations run
    # In Flask-SQLAlchemy 3.0+, use db.engine to get the engine
    engine = db.engine

    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        # Tables don't exist yet - likely a fresh database before migrations
        # This is expected and not an error condition
        return None

    user = db.session.execute(db.select(models.User).filter_by(email=email)).scalar_one_or_none()
    if user and user.is_superadmin:
        return user
    if user and not user.is_superadmin:
        user.is_superadmin = True
    else:
        user = models.User(
            email=email,
            name=name,
            is_superadmin=True,
            is_active=True,
        )
        user.password = password

        db.session.add(user)

    db.session.commit()

    if own_project is not None:
        project = db.session.execute(
            db.select(models.Project).filter_by(name=own_project, owner=user)
        ).scalar_one_or_none()
        if project is None:
            project = models.Project(name=own_project, owner=user)
        db.session.add(project)
        db.session.commit()
    return None
