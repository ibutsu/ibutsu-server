from http import HTTPStatus

import connexion

from ibutsu_server.constants import RESPONSE_JSON_REQ
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Portal, User
from ibutsu_server.filters import convert_filter
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import convert_objectid_to_uuid, is_uuid, validate_uuid


def add_portal(portal=None, token_info=None, user=None) -> dict:
    """Create a portal

    :param body: Portal
    :type body: dict | bytes

    :rtype: Portal
    """
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    portal = Portal.from_dict(**connexion.request.get_json())
    # check if portal already exists
    if portal.id and Portal.query.get(portal.id):
        return f"Portal id {portal.id} already exists.", HTTPStatus.CONFLICT
    user = User.query.get(user)
    if user:
        portal.owner = user
    session.add(portal)
    session.commit()
    return portal.to_dict(), HTTPStatus.CREATED


@validate_uuid
def get_portal(id_, token_info=None, user=None) -> dict:
    """Get a single portal by ID

    :param id: ID of test portal
    :type id: str

    :rtype: Portal
    """
    if not is_uuid(id_):
        id_ = convert_objectid_to_uuid(id_)
    portal = Portal.query.filter(Portal.name == id_).first()
    if not portal:
        portal = Portal.query.get(id_)
    # any user can get portals
    if not portal:
        return "Portal not found", HTTPStatus.NOT_FOUND
    return portal.to_dict()


def get_portal_list(
    filter_=None,
    owner_id=None,
    page=1,
    page_size=25,
    token_info=None,
    user=None,
) -> dict[list[dict], dict]:
    """Get a list of portals

    :param owner_id: Filter portals by owner ID
    :type owner_id: str
    :param limit: Limit the portals
    :type limit: int
    :param offset: Offset the portals
    :type offset: int

    :rtype: List[Portal]
    """
    # TODO evaluate and test this filter need
    query = Portal.query
    if owner_id:
        query = query.filter(Portal.owner_id == owner_id)

    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, Portal)
            if filter_clause is not None:
                query = query.filter(filter_clause)

    offset = get_offset(page, page_size)
    total_items = query.count()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    portals = query.offset(offset).limit(page_size).all()
    return {
        "portals": [portal.to_dict() for portal in portals],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


@validate_uuid
def update_portal(id_, portal=None, token_info=None, user=None, **kwargs) -> dict:
    """Update a portal

    :param id: ID of portal
    :type id: str
    :param body: Portal
    :type body: dict | bytes

    :rtype: Portal
    """
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    if not is_uuid(id_):
        id_ = convert_objectid_to_uuid(id_)
    portal = Portal.query.get(id_)

    if not portal:
        return "Portal not found", HTTPStatus.NOT_FOUND

    user = User.query.get(user)
    if not user.is_superadmin and (not portal.owner or portal.owner.id != user.id):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN

    # update the portal info
    updates = connexion.request.get_json()
    portal.update(updates)
    session.add(portal)
    session.commit()
    return portal.to_dict()
