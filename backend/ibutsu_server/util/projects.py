from ibutsu_server.db.models import Project
from ibutsu_server.db.models import User
from ibutsu_server.util.uuid import is_uuid


def get_project(project_name):
    """Perform a lookup to return the actual project record"""
    if is_uuid(project_name):
        project = Project.query.get(project_name)
    else:
        project = Project.query.filter(Project.name == project_name).first()
    return project


def get_project_id(project_name):
    """Shorthand function for a repeated piece of code"""
    project = get_project(project_name)
    return str(project.id) if project else None


def project_has_user(project, user):
    """A helper method to check if a user exists in the project"""
    if isinstance(user, str):
        user = User.query.get(user)
    if user.is_superadmin:
        return True
    if isinstance(project, str):
        project = get_project(project)
    return user in project.users or project.owner.id == user.id


def add_user_filter(query, user, model=None):
    """Filter a list of projects by user"""
    if isinstance(user, str):
        user = User.query.get(user)
    if user.is_superadmin:
        return query
    # filter the query by the list of user projects
    if model:
        if model == Project:
            attr = "id"
        else:
            attr = "project_id"
        query = query.filter(getattr(model, attr).in_([p.id for p in user.projects]))

    return query
