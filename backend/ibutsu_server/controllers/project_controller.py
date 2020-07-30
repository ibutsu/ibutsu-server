import connexion
from ibutsu_server.db.models import Project
from ibutsu_server.db.base import session
from ibutsu_server.util.json import jsonify
from ibutsu_server.util.projects import get_project as get_project_record


def add_project(project=None):
    """Create a project



    :param body: Project
    :type body: dict | bytes

    :rtype: Project
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    project = Project.from_dict(connexion.request.get_json())
    session.add(project)
    session.commit()
    return project.to_dict(), 201


def get_project(id_):
    """Get a single project by ID

    :param id: ID of test project
    :type id: str

    :rtype: Project
    """
    project = get_project_record(id_)
    if not project:
        return "Project not found", 404
    return project.to_dict()


def get_project_list(owner_id=None, group_id=None, page=1, page_size=25):
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
    query = Project.query
    if owner_id:
        query = query.filter(Project.data["ownerId"] == jsonify(owner_id))
    if group_id:
        query = query.filter(Project.data["groupId"] == jsonify(group_id))
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


def update_project(id_, project=None):
    """Update a project

    :param id: ID of test project
    :type id: str
    :param body: Project
    :type body: dict | bytes

    :rtype: Project
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    project = Project.query.get(id_)
    if not project:
        return "Project not found", 404
    project.update(connexion.request.get_json())
    session.add(project)
    session.commit()
    return project.to_dict()
