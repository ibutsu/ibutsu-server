"""
Various utility DB functions
"""
from typing import Optional

from ibutsu_server.db import models
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.expression import _literal_as_text
from sqlalchemy.sql.expression import ClauseElement
from sqlalchemy.sql.expression import Executable


class Explain(Executable, ClauseElement):
    """
    EXPLAIN a SQLAlchemy query (only for PSQL)
    e.g.
        query = Run.query
        session.execute(Explain(query)).fetchall()

    cf. http://www.wmmi.net/documents/SQLAlchemy.pdf for more info
    """

    def __init__(self, stmt, analyze=False):
        self.statement = _literal_as_text(stmt)
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

    user = models.User.query.filter_by(email=email).first()
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
        user.set_password(password)
        session.add(user)

    session.commit()

    if own_project is not None:
        project = models.Project.query.filter_by(name=own_project, owner=user).first()
        if project is None:
            project = models.Project(name=own_project, owner=user)
        session.add(project)
        session.commit()
