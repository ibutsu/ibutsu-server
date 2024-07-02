from http import HTTPStatus

import connexion
from flask import abort

from ibutsu_server.constants import RESPONSE_JSON_REQ
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Portal, User
from ibutsu_server.filters import convert_filter
from ibutsu_server.util.admin import check_user_is_admin
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import convert_objectid_to_uuid, is_uuid, validate_uuid


def admin_add_portal(portal=None, token_info=None, user=None) -> tuple[dict, int]:
    """Create a portal

    :param body: Portal
    :type body: dict | bytes

    :rtype: Portal
    """
    check_user_is_admin(user)
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    portal = Portal.from_dict(**connexion.request.get_json())
    # check if portal already exists
    if portal.id and Portal.query.get(portal.id):
        return f"Portal id {portal.id} already exist", HTTPStatus.BAD_REQUEST
    if user := User.query.get(user):
        portal.owner = user
    session.add(portal)
    session.commit()
    return portal.to_dict(), HTTPStatus.CREATED


@validate_uuid
def admin_get_portal(id_, token_info=None, user=None) -> dict:
    """Get a single portal by ID

    :param id: ID of test portal
    :type id: str

    :rtype: Portal
    """
    check_user_is_admin(user)

    # get by ID or check if the portal name matches the passed ID
    if portal := Portal.query.get(id_) or Portal.query.filter(Portal.name == id_).first():
        return portal.to_dict(with_owner=True)
    else:
        abort(HTTPStatus.NOT_FOUND)


def admin_get_portal_list(
    filter_=None,
    owner_id=None,
    group_id=None,
    page=1,
    page_size=25,
    token_info=None,
    user=None,
) -> dict[list[dict], dict]:
    """Get a list of portals

    :param owner_id: Filter portals by owner ID
    :type owner_id: str
    :param group_id: Filter portals by group ID
    :type group_id: str
    :param limit: Limit the portals
    :type limit: int
    :param offset: Offset the portals
    :type offset: int

    :rtype: List[Portal]
    """
    check_user_is_admin(user)
    query = Portal.query

    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, Portal)
            if filter_clause is not None:
                query = query.filter(filter_clause)
    if owner_id:
        query = query.filter(Portal.owner_id == owner_id)
    if group_id:
        query = query.filter(Portal.group_id == group_id)

    offset = get_offset(page, page_size)
    total_items = query.count()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    if offset > 9223372036854775807:  # max value of bigint
        return "The page number is too big.", HTTPStatus.BAD_REQUEST
    portals = query.offset(offset).limit(page_size).all()
    return {
        "portals": [portal.to_dict(with_owner=True) for portal in portals],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


@validate_uuid
def admin_update_portal(id_, portal=None, body=None, token_info=None, user=None):
    """Update a portal

    :param id: ID of portal
    :type id: str
    :param body: Portal
    :type body: dict | bytes

    :rtype: Portal
    """
    check_user_is_admin(user)
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    if not is_uuid(id_):
        id_ = convert_objectid_to_uuid(id_)

    if portal := Portal.query.get(id_):
        # Grab the fields from the request
        portal_dict = connexion.request.get_json()

        # If the "owner" field is set, ignore it
        portal_dict.pop("owner", None)

        # update the portal info
        portal.update(portal_dict)
        session.add(portal)
        session.commit()
        return portal.to_dict()
    else:
        abort(HTTPStatus.NOT_FOUND)


@validate_uuid
def admin_delete_portal(id_, token_info=None, user=None):
    """Delete a single portal"""
    check_user_is_admin(user)
    if not is_uuid(id_):
        return f"Portal ID {id_} is not in UUID format", HTTPStatus.BAD_REQUEST
    if portal := Portal.query.get(id_):
        session.delete(portal)
        session.commit()
        return HTTPStatus.OK.phrase, HTTPStatus.OK
    else:
        abort(HTTPStatus.NOT_FOUND)
