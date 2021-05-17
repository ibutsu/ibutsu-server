import connexion
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Project
from ibutsu_server.db.models import User
from ibutsu_server.util.projects import add_user_filter
from ibutsu_server.util.projects import project_has_user
from ibutsu_server.util.uuid import convert_objectid_to_uuid
from ibutsu_server.util.uuid import is_uuid


def add_project(project=None, token_info=None, user=None):
    """Create a project



    :param body: Project
    :type body: dict | bytes

    :rtype: Project
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    project = Project.from_dict(**connexion.request.get_json())
    user = User.query.get(user)
    if user:
        project.owner = user
    session.add(project)
    session.commit()
    return project.to_dict(), 201


def get_project(id_, token_info=None, user=None):
    """Get a single project by ID

    :param id: ID of test project
    :type id: str

    :rtype: Project
    """
    if not is_uuid(id_):
        id_ = convert_objectid_to_uuid(id_)
    project = Project.query.filter(Project.name == id_).first()
    if not project:
        project = Project.query.get(id_)
    if project and not project_has_user(project, user):
        return "Unauthorized", 401
    if not project:
        return "Project not found", 404
    return project.to_dict()


def get_project_list(
    owner_id=None, group_id=None, page=1, page_size=25, token_info=None, user=None
):
    """Get a list of projects

    :param owner_id: Filter projects by owner ID
    :type owner_id: str
    :param group_id: Filter projects by group ID
    :type group_id: str
    :param limit: Limit the projects
    :type limit: int
    :param offset: Offset the projects
    :type offset: int

    :rtype: List[Project]
    """
    query = add_user_filter(Project.query, user)
    if owner_id:
        query = query.filter(Project.owner_id == owner_id)
    if group_id:
        query = query.filter(Project.group_id == group_id)
    offset = (page * page_size) - page_size
    total_items = query.count()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    projects = query.offset(offset).limit(page_size).all()
    return {
        "projects": [project.to_dict() for project in projects],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


def update_project(id_, project=None, token_info=None, user=None):
    """Update a project

    :param id: ID of test project
    :type id: str
    :param body: Project
    :type body: dict | bytes

    :rtype: Project
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    if not is_uuid(id_):
        id_ = convert_objectid_to_uuid(id_)
    project = Project.query.get(id_)
    if project and not project_has_user(project, user):
        return "Forbidden", 403
    if not project:
        return "Project not found", 404
    project.update(connexion.request.get_json())
    session.add(project)
    session.commit()
    return project.to_dict()
