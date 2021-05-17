""" Tasks for DB related things"""
from datetime import datetime
from datetime import timedelta

from ibutsu_server.db.base import session
from ibutsu_server.db.models import Artifact
from ibutsu_server.db.models import Result
from ibutsu_server.db.models import Run
from ibutsu_server.tasks import task

DAYS_IN_MONTH = 30


@task
def prune_old_files(months=5):
    """Delete artifact files older than specified months (here defined as 30 days)."""
    try:
        if isinstance(months, str):
            months = int(months)

        if months < 2:
            # we don't want to remove files more recent than 2 months
            return

        max_date = datetime.utcnow() - timedelta(days=months * DAYS_IN_MONTH)
        # delete artifact files older than max_date
        delete_statement = Artifact.__table__.delete().where(Artifact.upload_date < max_date)
        session.execute(delete_statement)
        session.commit()
    except Exception:
        # we don't want to continually retry this task
        return


@task
def prune_old_results(months=6):
    """
    Remove results older than specified months (here defined as 30 days).

    IMPORTANT NOTE: to avoid primary key errors, 'months' must be greater than what is used
                    in 'prune_old_files'
    """
    try:
        if isinstance(months, str):
            months = int(months)

        if months < 4:
            # we don't want to remove files more recent than 4 months
            return

        max_date = datetime.utcnow() - timedelta(days=months * DAYS_IN_MONTH)
        # delete artifact files older than max_date
        delete_statement = Result.__table__.delete().where(Result.start_time < max_date)
        session.execute(delete_statement)
        session.commit()
    except Exception:
        # we don't want to continually retry this task
        return


@task
def prune_old_runs(months=12):
    """
    Remove runs older than specified months (here defined as 30 days).

    IMPORTANT NOTE: to avoid primary key errors, 'months' must be greater than what is used
                    in 'prune_old_results'
    """
    try:
        if isinstance(months, str):
            months = int(months)

        if months < 10:
            # we don't want to remove files more recent than 10 months
            return

        max_date = datetime.utcnow() - timedelta(days=months * DAYS_IN_MONTH)
        # delete artifact files older than max_date
        delete_statement = Run.__table__.delete().where(Run.start_time < max_date)
        session.execute(delete_statement)
        session.commit()
    except Exception:
        # we don't want to continually retry this task
        return
