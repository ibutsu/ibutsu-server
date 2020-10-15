from ibutsu_server.db.models import Project
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
