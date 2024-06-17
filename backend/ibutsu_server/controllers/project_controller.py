import connexion
import flatdict

from ibutsu_server.db.base import session
from ibutsu_server.db.models import Project, Result, User
from ibutsu_server.filters import convert_filter
from ibutsu_server.util.projects import add_user_filter, project_has_user
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import convert_objectid_to_uuid, is_uuid, validate_uuid
from ibutsu_server.constants import RESPONSE_JSON_REQ


def add_project(project=None, token_info=None, user=None):
    """Create a project

    :param body: Project
    :type body: dict | bytes

    :rtype: Project
    """
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    project = Project.from_dict(**connexion.request.get_json())
    # check if project already exists
    if project.id and Project.query.get(project.id):
        return f"Project id {project.id} already exist", 400
    user = User.query.get(user)
    if user:
        project.owner = user
        project.users.append(user)
    session.add(project)
    session.commit()
    return project.to_dict(), 201


@validate_uuid
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
    filter_=None,
    owner_id=None,
    group_id=None,
    page=1,
    page_size=25,
    token_info=None,
    user=None,
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
    query = add_user_filter(Project.query, user, model=Project)
    if owner_id:
        query = query.filter(Project.owner_id == owner_id)
    if group_id:
        query = query.filter(Project.group_id == group_id)

    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, Project)
            if filter_clause is not None:
                query = query.filter(filter_clause)

    offset = get_offset(page, page_size)
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


@validate_uuid
def update_project(id_, project=None, token_info=None, user=None, **kwargs):
    """Update a project

    :param id: ID of test project
    :type id: str
    :param body: Project
    :type body: dict | bytes

    :rtype: Project
    """
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    if not is_uuid(id_):
        id_ = convert_objectid_to_uuid(id_)
    project = Project.query.get(id_)

    if not project:
        return "Project not found", 404

    user = User.query.get(user)
    if not user.is_superadmin and (not project.owner or project.owner.id != user.id):
        return "Forbidden", 403

    # handle updating users separately
    updates = connexion.request.get_json()
    for username in updates.pop("users", []):
        user_to_add = User.query.filter_by(email=username).first()
        if user_to_add and user_to_add not in project.users:
            project.users.append(user_to_add)

    # update the rest of the project info
    project.update(updates)
    session.add(project)
    session.commit()
    return project.to_dict()


@validate_uuid
def get_filter_params(id_, user=None, token_info=None):
    """Get a list of filter parameters for a project

    :param id_: ID of project
    :type id_: str

    :rtype: List
    """
    project = Project.query.get(id_)

    if not project:
        return "Project not found", 404
    if project and not project_has_user(project, user):
        return "Unauthorized", 401

    result = (
        session.query(Result)
        .filter(Result.project_id == id_)
        .order_by(Result.start_time.desc())
        .first()
    )

    fields = flatdict.FlatDict(result.__dict__, delimiter=".").keys()
    fields.remove("_sa_instance_state")

    return fields
