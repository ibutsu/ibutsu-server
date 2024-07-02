from http import HTTPStatus

import connexion
from flask import abort

from ibutsu_server.constants import RESPONSE_JSON_REQ
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Group, Project, User
from ibutsu_server.filters import convert_filter
from ibutsu_server.util.admin import check_user_is_admin
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import convert_objectid_to_uuid, is_uuid, validate_uuid


def admin_add_project(project=None, token_info=None, user=None):
    """Create a project

    :param body: Project
    :type body: dict | bytes

    :rtype: Project
    """
    check_user_is_admin(user)
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    project = Project.from_dict(**connexion.request.get_json())
    # check if project already exists
    if project.id and Project.query.get(project.id):
        return f"Project id {project.id} already exist", HTTPStatus.BAD_REQUEST
    user = User.query.get(user)
    if project.group_id:
        # check if the group exists
        group = Group.query.get(project.group_id)
        if not group:
            return f"Group id {project.group_id} doesn't exist", HTTPStatus.BAD_REQUEST
    if user:
        project.owner = user
        project.users.append(user)
    session.add(project)
    session.commit()
    return project.to_dict(), HTTPStatus.CREATED


@validate_uuid
def admin_get_project(id_, token_info=None, user=None):
    """Get a single project by ID

    :param id: ID of test project
    :type id: str

    :rtype: Project
    """
    check_user_is_admin(user)
    project = Project.query.get(id_)
    if not project:
        project = Project.query.filter(Project.name == id_).first()
    if not project:
        abort(HTTPStatus.NOT_FOUND)
    return project.to_dict(with_owner=True)


def admin_get_project_list(
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
    check_user_is_admin(user)
    query = Project.query

    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, Project)
            if filter_clause is not None:
                query = query.filter(filter_clause)
    if owner_id:
        query = query.filter(Project.owner_id == owner_id)
    if group_id:
        query = query.filter(Project.group_id == group_id)

    offset = get_offset(page, page_size)
    total_items = query.count()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    if offset > 9223372036854775807:  # max value of bigint
        return "The page number is too big.", HTTPStatus.BAD_REQUEST
    projects = query.offset(offset).limit(page_size).all()
    return {
        "projects": [project.to_dict(with_owner=True) for project in projects],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


@validate_uuid
def admin_update_project(id_, project=None, body=None, token_info=None, user=None):
    """Update a project

    :param id: ID of test project
    :type id: str
    :param body: Project
    :type body: dict | bytes

    :rtype: Project
    """
    check_user_is_admin(user)
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    if not is_uuid(id_):
        id_ = convert_objectid_to_uuid(id_)
    project = Project.query.get(id_)

    if not project:
        abort(HTTPStatus.NOT_FOUND)

    # Grab the fields from the request
    project_dict = connexion.request.get_json()

    # If the "owner" field is set, ignore it
    project_dict.pop("owner", None)

    # handle updating users separately
    for username in project_dict.pop("users", []):
        user_to_add = User.query.filter_by(email=username).first()
        if user_to_add and user_to_add not in project.users:
            project.users.append(user_to_add)

    # Make sure the project owner is in the list of users
    if project_dict.get("owner_id"):
        owner = User.query.get(project_dict["owner_id"])
        if owner and owner not in project.users:
            project.users.append(owner)

    # update the rest of the project info
    project.update(project_dict)
    session.add(project)
    session.commit()
    return project.to_dict()


@validate_uuid
def admin_delete_project(id_, token_info=None, user=None):
    """Delete a single project"""
    check_user_is_admin(user)
    if not is_uuid(id_):
        return f"Project ID {id_} is not in UUID format", HTTPStatus.BAD_REQUEST

    if project := Project.query.get(id_):
        session.delete(project)
        session.commit()
        return HTTPStatus.OK.phrase, HTTPStatus.OK
    else:
        abort(HTTPStatus.NOT_FOUND)
    session.delete(project)
    session.commit()
    return HTTPStatus.OK.phrase, HTTPStatus.OK
