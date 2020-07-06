import connexion
from bson import ObjectId
from ibutsu_server.models.group import Group
from ibutsu_server.mongo import mongo
from ibutsu_server.util import merge_dicts
from ibutsu_server.util import serialize


def add_group(group=None):
    """Create a new group

    :param body: Group
    :type body: dict | bytes

    :rtype: Group
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    body = Group.from_dict(connexion.request.get_json())
    group = body.to_dict()
    mongo.groups.insert_one(group)
    return serialize(group), 201


def get_group(id_):
    """Get a group



    :param id: The ID of the group
    :type id: str

    :rtype: Group
    """
    group = mongo.groups.find_one({"_id": ObjectId(id_)})
    return serialize(group)


def get_group_list(page=1, page_size=25):
    """Get a list of groups



    :param offset: Set the offset for results
    :type offset: int
    :param limit: Set the limit (page size) for results
    :type limit: int

    :rtype: List[Group]
    """
    offset = (page * page_size) - page_size
    total_items = mongo.groups.count({})
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    groups = mongo.groups.find({}, skip=offset, limit=page_size)
    return {
        "groups": [serialize(group) for group in groups],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


def update_group(id_, group=None):
    """Update a group



    :param id: The ID of the group
    :type id: str
    :param body: The updated group
    :type body: dict | bytes

    :rtype: Group
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    body = Group.from_dict(connexion.request.get_json())
    group = body.to_dict()
    existing_group = mongo.groups.find_one({"_id": ObjectId(id_)})
    merge_dicts(existing_group, group)
    mongo.groups.replace_one({"_id": ObjectId(id_)}, group)
    return serialize(group)
