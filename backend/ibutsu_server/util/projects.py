from ibutsu_server.db import db
from ibutsu_server.db.models import Project, User
from ibutsu_server.util.uuid import is_uuid


def get_project(project_name):
    """Perform a lookup to return the actual project record"""
    if is_uuid(project_name):
        project = db.session.get(Project, project_name)
    else:
        project = db.session.execute(
            db.select(Project).where(Project.name == project_name)
        ).scalar_one_or_none()
    return project


def get_project_id(project_name):
    """Shorthand function for a repeated piece of code"""
    project = get_project(project_name)
    return str(project.id) if project else None


def project_has_user(project, user):
    """A helper method to check if a user exists in the project"""
    if isinstance(user, str):
        user = db.session.get(User, user)
    if user.is_superadmin:
        return True
    if isinstance(project, str):
        project = get_project(project)
    return user in project.users or project.owner.id == user.id


def add_user_filter(query, user, model=None):
    """Filter a list of projects by user"""
    if isinstance(user, str):
        user = db.session.get(User, user)
    if user.is_superadmin:
        return query
    # filter the query by the list of user projects
    if model:
        attr = "id" if model == Project else "project_id"
        # SQLAlchemy 2.0+ pattern: use .where() instead of .filter()
        query = query.where(getattr(model, attr).in_([p.id for p in user.projects]))

    return query
