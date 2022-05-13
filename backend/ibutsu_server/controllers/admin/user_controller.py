import connexion
from flask import abort
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Project
from ibutsu_server.db.models import User
from ibutsu_server.filters import convert_filter
from ibutsu_server.util.admin import check_user_is_admin
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
def admin_get_user(id_, token_info=None, user=None):
    """Return the current user"""
    check_user_is_admin(user)
    requested_user = User.query.get(id_)
    if not requested_user:
        abort(404)
    return _hide_sensitive_fields(requested_user.to_dict(with_projects=True))


def admin_get_user_list(filter_=None, page=1, page_size=25, token_info=None, user=None):
    """
    Return a list of users (only superadmins can run this function)
    """
    check_user_is_admin(user)
    query = User.query

    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, User)
            if filter_clause is not None:
                query = query.filter(filter_clause)

    offset = (page * page_size) - page_size
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


def admin_add_user(new_user=None, token_info=None, user=None):
    """Create a new user in the system"""
    check_user_is_admin(user)
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    new_user = User.from_dict(**connexion.request.get_json())
    session.add(new_user)
    session.commit()
    return _hide_sensitive_fields(new_user.to_dict()), 201


def admin_update_user(id_, user_info=None, token_info=None, user=None):
    """Update a single user in the system"""
    check_user_is_admin(user)
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    user_dict = connexion.request.get_json()
    projects = user_dict.pop("projects", [])
    requested_user = User.query.get(id_)
    if not requested_user:
        abort(404)
    requested_user.update(user_dict)
    requested_user.projects = [Project.query.get(project["id"]) for project in projects]
    session.add(requested_user)
    session.commit()
    return _hide_sensitive_fields(requested_user.to_dict())


def admin_delete_user(id_, token_info=None, user=None):
    """Delete a single user"""
    check_user_is_admin(user)
    requested_user = User.query.get(id_)
    if not requested_user:
        abort(404)
    session.delete(requested_user)
    session.commit()
    return "OK", 200
