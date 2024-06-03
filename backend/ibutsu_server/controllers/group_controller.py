import connexion

from ibutsu_server.db.base import session
from ibutsu_server.db.models import Group
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import is_uuid, validate_uuid


def add_group(group=None):
    """Create a new group

    :param body: Group
    :type body: dict | bytes

    :rtype: Group
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    group = Group.from_dict(**connexion.request.get_json())
    if group.id and Group.query.get(group.id):
        return f"The group with ID {group.id} already exists", 400
    if not is_uuid(group.id):
        return f"Group ID {group.id} is not in UUID format", 400
    session.add(group)
    session.commit()
    return group.to_dict(), 201


@validate_uuid
def get_group(id_, token_info=None, user=None):
    """Get a group

    :param id: The ID of the group
    :type id: str

    :rtype: Group
    """
    group = Group.query.get(id_)
    if group:
        return group.to_dict()
    else:
        return "Group not found", 404


def get_group_list(page=1, page_size=25, token_info=None, user=None):
    """Get a list of groups



    :param offset: Set the offset for results
    :type offset: int
    :param limit: Set the limit (page size) for results
    :type limit: int

    :rtype: List[Group]
    """
    offset = get_offset(page, page_size)
    query = Group.query
    total_items = query.count()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    groups = query.limit(page_size).offset(offset).all()
    return {
        "groups": [group.to_dict() for group in groups],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


@validate_uuid
def update_group(id_, group=None, **kwargs):
    """Update a group



    :param id: The ID of the group
    :type id: str
    :param body: The updated group
    :type body: dict | bytes

    :rtype: Group
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    group = Group.query.get(id_)
    if not group:
        return "Group not found", 404
    group.update(connexion.request.get_json())
    session.add(group)
    session.commit()
    return group.to_dict()
