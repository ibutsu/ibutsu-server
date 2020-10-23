""" Tasks for DB related things"""
from datetime import datetime
from datetime import timedelta

from ibutsu_server.db.base import session
from ibutsu_server.db.models import Artifact
from ibutsu_server.tasks import task


@task
def prune_old_files(months=5):
    """ Delete artifact files older than specified months (here defined as 4 weeks). """
    try:
        if isinstance(months, str):
            months = int(months)

        if months < 2:
            # we don't want to remove files more recent than 3 months
            return

        max_date = datetime.utcnow() - timedelta(days=months * 4)
        # delete artifact files older than max_date
        delete_statement = Artifact.__table__.delete().where(Artifact.upload_date < max_date)
        session.execute(delete_statement)
        session.commit()
    except Exception:
        # we don't want to continually retry this task
        return
