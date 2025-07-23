from http import HTTPStatus

import connexion
from flask import abort

from ibutsu_server.constants import RESPONSE_JSON_REQ
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Project, User
from ibutsu_server.filters import convert_filter
from ibutsu_server.util.admin import validate_admin
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import validate_uuid

HIDDEN_FIELDS = ["_password", "password", "activation_code"]


def _hide_sensitive_fields(user_dict):
    """
    Hide certain fields in the user dict
    """
    for field in HIDDEN_FIELDS:
        if field in user_dict:
            user_dict.pop(field)
    return user_dict


@validate_uuid
@validate_admin
def admin_get_user(id_, token_info=None, user=None):
    """Return the current user"""
    requested_user = User.query.get(id_)
    if not requested_user:
        abort(HTTPStatus.NOT_FOUND)
    return _hide_sensitive_fields(requested_user.to_dict(with_projects=True))


@validate_admin
def admin_get_user_list(filter_=None, page=1, page_size=25, token_info=None, user=None):
    """
    Return a list of users (only superadmins can run this function)
    """
    query = User.query

    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, User)
            if filter_clause is not None:
                query = query.filter(filter_clause)

    offset = get_offset(page, page_size)
    total_items = query.count()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    users = query.order_by(User.email.asc()).offset(offset).limit(page_size).all()
    return {
        "users": [_hide_sensitive_fields(user.to_dict(with_projects=True)) for user in users],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


@validate_admin
def admin_add_user(body=None, token_info=None, user=None):
    """Create a new user in the system"""
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    new_user = User.from_dict(**connexion.request.get_json())
    user_exists = User.query.filter_by(email=new_user.email).first()
    if user_exists:
        return f"The user with email {new_user.email} already exists", HTTPStatus.BAD_REQUEST
    session.add(new_user)
    session.commit()
    return _hide_sensitive_fields(new_user.to_dict()), HTTPStatus.CREATED


@validate_uuid
@validate_admin
def admin_update_user(id_, body=None, user_info=None, token_info=None, user=None):
    """Update a single user in the system"""
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    user_dict = connexion.request.get_json()
    projects = user_dict.pop("projects", [])
    requested_user = User.query.get(id_)
    if not requested_user:
        abort(HTTPStatus.NOT_FOUND)
    requested_user.update(user_dict)
    requested_user.projects = [Project.query.get(project["id"]) for project in projects]
    session.add(requested_user)
    session.commit()
    return _hide_sensitive_fields(requested_user.to_dict())


@validate_uuid
@validate_admin
def admin_delete_user(id_, token_info=None, user=None):
    """Delete a single user and handle all related records"""
    user_to_delete = User.query.get(id_)
    if not user_to_delete:
        abort(HTTPStatus.NOT_FOUND)

    user = User.query.get(user)
    # prevent deletion of self
    # TODO just block in the frontend?
    if id_ == user.id:
        abort(HTTPStatus.BAD_REQUEST, description="Cannot delete yourself")

    # Prevent deletion of the last superadmin
    if user_to_delete.is_superadmin and (User.query.filter_by(is_superadmin=True).count() <= 1):
        abort(HTTPStatus.BAD_REQUEST, description="Cannot delete the last superadmin user")

    # Handle user deletion with proper cleanup of related records
    try:
        user_to_delete.user_cleanup(new_owner=user, session=session)

        # 5. Finally delete the user
        session.delete(user_to_delete)
        session.commit()

        return HTTPStatus.OK.phrase, HTTPStatus.OK

    except Exception as e:
        session.rollback()
        # Log the actual error for debugging
        print(f"Error deleting user {id_}: {str(e)}")
        abort(HTTPStatus.INTERNAL_SERVER_ERROR)
