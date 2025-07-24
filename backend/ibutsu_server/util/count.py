"""Utility functions for counting rows in large tables"""

from contextlib import contextmanager

from ibutsu_server.constants import COUNT_ESTIMATE_LIMIT, COUNT_TIMEOUT
from ibutsu_server.db import db
from ibutsu_server.db.util import Explain


def _get_count_from_explain(query):
    explain_result = db.session.execute(Explain(query)).fetchall()[0][0]
    rows = int(explain_result.split("rows")[-1].split("=")[1].split(" ")[0])
    return rows


def get_count_estimate(query, no_filter=False, **kwargs):
    """
    Given tablename, return an estimated count of the number of rows in the table.
    """
    if no_filter:
        tablename = kwargs.get("tablename")
        sql = f"SELECT reltuples as approx_count FROM pg_class WHERE relname='{tablename}'"
        return int(db.session.execute(sql).fetchall()[0][0])
    else:
        estimate = _get_count_from_explain(query)
        # if the estimate is < COUNT_ESTIMATE_LIMIT
        # then probably there aren't too many rows, just regularly count them
        if estimate < COUNT_ESTIMATE_LIMIT:
            return db.session.execute(
                db.select(db.func.count()).select_from(query.select_from())
            ).scalar()
        return estimate


@contextmanager
def time_limited_db_operation(timeout=None):
    """
    Context manager for performing some time limited DB operation.

    timeout: timeout for the operation in 's'
    """
    timeout = int(timeout * 1000) if timeout else int(COUNT_TIMEOUT * 1000)

    db.session.execute(f"SET statement_timeout TO {timeout}; commit;")
    yield
    db.session.execute("SET statement_timeout TO 0; commit;")
