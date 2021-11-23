"""
Various utility DB functions
"""
from ibutsu_server.db.models import User
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


def add_superadmin(session, admin_user):
    """
    Adds a superadmin user to Ibutsu.
    """
    user = User.query.filter_by(email=admin_user["email"]).first()
    if user and user.is_superadmin:
        return
    elif user and not user.is_superadmin:
        user.is_superadmin = True
    else:
        user = User(
            email=admin_user["email"],
            name=admin_user.get("name") or "Ibutsu Admin",
            password=admin_user["password"],
            is_superadmin=True,
            is_active=True,
        )

    session.add(user)
    session.commit()
