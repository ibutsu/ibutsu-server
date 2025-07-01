"""
Various utility DB functions
"""

from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.expression import ClauseElement, Executable

from ibutsu_server.db import db, models


class Explain(Executable, ClauseElement):
    """
    EXPLAIN a SQLAlchemy query (only for PSQL)
    e.g.
        query = db.select(Run)
        session.execute(Explain(query)).fetchall()

    cf. http://www.wmmi.net/documents/SQLAlchemy.pdf for more info
    """

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
def pg_explain(element, compiler, **kw):
    text = "EXPLAIN "
    if element.analyze:
        text += "ANALYZE "
    text += compiler.process(element.statement)
    return text


def add_superadmin(
    session,
    *,
    name: str = "Ibutsu Admin",
    email: str,
    password: Optional[str] = None,
    own_project: Optional[str] = None,
):
    """
    Adds a superadmin user to Ibutsu.
    """

    user = db.session.execute(db.select(models.User).filter_by(email=email)).scalar_one_or_none()
    if user and user.is_superadmin:
        return user
    elif user and not user.is_superadmin:
        user.is_superadmin = True
    else:
        user = models.User(
            email=email,
            name=name,
            is_superadmin=True,
            is_active=True,
        )
        user.password = password

        session.add(user)

    session.commit()

    if own_project is not None:
        project = db.session.execute(
            db.select(models.Project).filter_by(name=own_project, owner=user)
        ).scalar_one_or_none()
        if project is None:
            project = models.Project(name=own_project, owner=user)
        session.add(project)
        session.commit()
