from http import HTTPStatus

import flatdict
from flask import request

from ibutsu_server.constants import RESPONSE_JSON_REQ
from ibutsu_server.db import db
from ibutsu_server.db.models import Project, Result, User
from ibutsu_server.filters import convert_filter
from ibutsu_server.util.app_context import with_app_context
from ibutsu_server.util.projects import add_user_filter, project_has_user
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import convert_objectid_to_uuid, is_uuid, validate_uuid


@with_app_context
def add_project(project=None, token_info=None, user=None):
    """Create a project

    :param body: Project
    :type body: dict | bytes

    :rtype: Project
    """
    if not request.is_json:
        return RESPONSE_JSON_REQ
    project = Project.from_dict(**request.get_json())
    # check if project already exists
    if project.id and db.session.get(Project, project.id):
        return f"Project id {project.id} already exist", HTTPStatus.BAD_REQUEST
    user = db.session.get(User, user)
    if user:
        project.owner = user
        project.users.append(user)
    db.session.add(project)
    db.session.commit()
    return project.to_dict(), HTTPStatus.CREATED


@validate_uuid
@with_app_context
def get_project(id_, token_info=None, user=None):
    """Get a single project by ID

    :param id: ID of test project
    :type id: str

    :rtype: Project
    """
    if not is_uuid(id_):
        id_ = convert_objectid_to_uuid(id_)
    project = db.session.execute(db.select(Project).where(Project.name == id_)).scalar_one_or_none()
    if not project:
        project = db.session.get(Project, id_)
    if project and not project_has_user(project, user):
        return HTTPStatus.UNAUTHORIZED.phrase, HTTPStatus.UNAUTHORIZED
    if not project:
        return "Project not found", HTTPStatus.NOT_FOUND
    return project.to_dict()


@with_app_context
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
    query = db.select(Project)
    query = add_user_filter(query, user, model=Project)
    if owner_id:
        query = query.where(Project.owner_id == owner_id)
    if group_id:
        query = query.where(Project.group_id == group_id)

    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, Project)
            if filter_clause is not None:
                query = query.where(filter_clause)

    offset = get_offset(page, page_size)
    total_items = db.session.execute(db.select(db.func.count()).select_from(query)).scalar()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    projects = db.session.execute(query.offset(offset).limit(page_size)).scalars().all()
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
@with_app_context
def update_project(id_, project=None, token_info=None, user=None, **kwargs):
    """Update a project

    :param id: ID of test project
    :type id: str
    :param body: Project
    :type body: dict | bytes

    :rtype: Project
    """
    if not request.is_json:
        return RESPONSE_JSON_REQ
    if not is_uuid(id_):
        id_ = convert_objectid_to_uuid(id_)
    project = db.session.get(Project, id_)

    if not project:
        return "Project not found", HTTPStatus.NOT_FOUND

    user = db.session.get(User, user)
    if not user.is_superadmin and (not project.owner or project.owner.id != user.id):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN

    # handle updating users separately
    updates = request.get_json()
    for username in updates.pop("users", []):
        user_to_add = db.session.execute(
            db.select(User).filter_by(email=username)
        ).scalar_one_or_none()
        if user_to_add and user_to_add not in project.users:
            project.users.append(user_to_add)

    # update the rest of the project info
    project.update(updates)
    db.session.add(project)
    db.session.commit()
    return project.to_dict()


@validate_uuid
@with_app_context
def get_filter_params(id_, user=None, token_info=None):
    """Get a list of filter parameters for a project

    :param id_: ID of project
    :type id_: str

    :rtype: List
    """
    project = db.session.get(Project, id_)

    if not project:
        return "Project not found", HTTPStatus.NOT_FOUND
    if project and not project_has_user(project, user):
        return HTTPStatus.UNAUTHORIZED.phrase, HTTPStatus.UNAUTHORIZED

    query = db.select(Result).filter(Result.project_id == id_).order_by(Result.start_time.desc())

    result = db.session.execute(query).scalar_one_or_none()

    fields = flatdict.FlatDict(result.__dict__, delimiter=".").keys()
    fields.remove("_sa_instance_state")

    return fields
