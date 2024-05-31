from datetime import datetime, timedelta

from ibutsu_server.db.base import session
from ibutsu_server.db.models import Artifact, Project, Result, Run, User
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


@task
def seed_users(projects):
    """
    Add users and add users to projects in database.

    Schema for the request to /admin/run-task in JSON should be:
    .. code-block:: json

        {
          "task": "db.seed_users",
          "token": "<admin-token>",
          "params": {
            "projects": {
              "my-project": {
                "owner": "jdoe@example.com",
                "users": [
                    "jdoe@example.com",
                    "nflanders@example.com",
                    ...
                ],
              },
              "new-project": {
                "users": [
                  "hsimpson@example.com",
                  "batman@gotham.com",
                  ...
                ]
              }
            }
          }
        }
    """
    try:
        if not projects:
            print("No users to add, exiting...")
            return

        for project_name, project_info in projects.items():
            project = Project.query.filter_by(name=project_name).first()
            if not project:
                print(f"Project with name {project_name} not found.")
                continue

            # create/set the project owner
            if project_info.get("owner"):
                project_owner = User.query.filter_by(email=project_info["owner"]).first()
                if not project_owner:
                    project_owner = User(
                        email=project_info["owner"],
                        name=project_info["owner"].split("@")[0],
                        is_active=True,
                    )
                project.owner = project_owner
                session.add(project)
                session.commit()

            # add the users
            for user_email in project_info.get("users", []):
                user = User.query.filter_by(email=user_email).first()
                # create the user if they don't exist
                if not user:
                    user = User(email=user_email, name=user_email.split("@")[0], is_active=True)

                # add the project if the user needs to be added to the project
                if project not in user.projects:
                    user.projects.append(project)

                session.add(user)
            session.commit()
    except Exception as e:
        # we don't want to continually retry this task
        print(e)
        return
