import logging
from datetime import UTC, datetime, timedelta

from ibutsu_server.db import db
from ibutsu_server.db.models import Artifact, Import, ImportFile, Project, Result, Run, User
from ibutsu_server.tasks import shared_task

logger = logging.getLogger(__name__)
DAYS_IN_MONTH = 30


@shared_task
def prune_old_files(months=5):
    """Delete artifact files older than specified months (here defined as 30 days)."""
    try:
        if isinstance(months, str):
            months = int(months)

        if months < 2:
            # we don't want to remove files more recent than 2 months
            return

        max_date = datetime.now(UTC) - timedelta(days=months * DAYS_IN_MONTH)
        # delete artifact files older than max_date
        delete_statement = Artifact.__table__.delete().where(Artifact.upload_date < max_date)
        db.session.execute(delete_statement)
        db.session.commit()
    except Exception:
        # we don't want to continually retry this task
        return


@shared_task
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

        max_date = datetime.now(UTC) - timedelta(days=months * DAYS_IN_MONTH)
        # delete artifact files older than max_date
        delete_statement = Result.__table__.delete().where(Result.start_time < max_date)
        db.session.execute(delete_statement)
        db.session.commit()
    except Exception:
        # we don't want to continually retry this task
        return


@shared_task
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

        max_date = datetime.now(UTC) - timedelta(days=months * DAYS_IN_MONTH)
        # delete artifact files older than max_date
        delete_statement = Run.__table__.delete().where(Run.start_time < max_date)
        db.session.execute(delete_statement)
        db.session.commit()
    except Exception:
        # we don't want to continually retry this task
        return


@shared_task
def prune_old_import_files(days=7):
    """
    Delete import records older than specified days, with CASCADE handling import_files.

    Import files contain the raw uploaded content (XML, tar.gz) which can be large.
    After the import task completes, this data is no longer needed. This task removes
    old import records and relies on ON DELETE CASCADE to automatically remove their
    associated import_files records, saving database space.

    :param days: Delete import records older than this many days (default: 7)
    :type days: int
    """
    try:
        days = int(days)
    except ValueError:
        logger.exception(
            "Invalid 'days' value provided to prune_old_import_files", extra={"days": days}
        )
        # Fail fast so configuration errors are not silently ignored
        raise

    if days < 1:
        logger.warning(
            "prune_old_import_files called with days < 1, skipping deletion", extra={"days": days}
        )
        return f"Skipped: days parameter ({days}) must be >= 1"

    max_date = datetime.now(UTC) - timedelta(days=days)

    # Delete import records older than max_date
    # The ON DELETE CASCADE foreign key constraint automatically removes associated import_files
    delete_statement = Import.__table__.delete().where(Import.created < max_date)
    result = db.session.execute(delete_statement)
    deleted_count = result.rowcount
    db.session.commit()

    return f"Deleted {deleted_count} import records older than {days} days"


@shared_task
def clear_import_file_content(import_id):
    """
    Clear the content field of an import_file after successful import.

    This saves database space by removing the large binary content field while
    keeping the import record for audit/history purposes.

    :param import_id: The ID of the import whose file content should be cleared
    :type import_id: str
    """
    try:
        # Get the import record to check status
        import_record = db.session.get(Import, import_id)
        if not import_record:
            return f"Import {import_id} not found"

        # Only clear content if import is done or error (not pending/running)
        if import_record.status not in ("done", "error"):
            return f"Import {import_id} status is {import_record.status}, not clearing content"

        # Find and clear the import file content
        import_file = db.session.execute(
            db.select(ImportFile).where(ImportFile.import_id == import_id)
        ).scalar_one_or_none()

        if import_file and import_file.content:
            content_size = len(import_file.content)
            import_file.content = None
            db.session.add(import_file)
            db.session.commit()
            return f"Cleared {content_size} bytes from import_file for import {import_id}"

        return f"No content to clear for import {import_id}"
    except Exception as e:
        # Log the error but don't retry
        db.session.rollback()
        logger.exception(f"Error in clear_import_file_content: {e}", extra={"import_id": import_id})
        return None


@shared_task
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
            project = db.session.execute(
                db.select(Project).filter_by(name=project_name)
            ).scalar_one_or_none()
            if not project:
                print(f"Project with name {project_name} not found.")
                continue

            # create/set the project owner
            if project_info.get("owner"):
                project_owner = db.session.execute(
                    db.select(User).filter_by(email=project_info["owner"])
                ).scalar_one_or_none()
                if not project_owner:
                    project_owner = User(
                        email=project_info["owner"],
                        name=project_info["owner"].split("@")[0],
                        is_active=True,
                    )
                project.owner = project_owner
                db.session.add(project)
                db.session.commit()

            # add the users
            for user_email in project_info.get("users", []):
                user = db.session.execute(
                    db.select(User).filter_by(email=user_email)
                ).scalar_one_or_none()
                # create the user if they don't exist
                if not user:
                    user = User(email=user_email, name=user_email.split("@")[0], is_active=True)

                # add the project if the user needs to be added to the project
                if project not in user.projects:
                    user.projects.append(project)

                db.session.add(user)
            db.session.commit()

    except Exception as e:
        # we don't want to continually retry this task
        print(e)
        return
