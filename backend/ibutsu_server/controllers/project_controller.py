import connexion
from bson import ObjectId
from ibutsu_server.models.project import Project
from ibutsu_server.mongo import mongo
from ibutsu_server.util import merge_dicts
from ibutsu_server.util import serialize


def add_project(project=None):
    """Create a project



    :param body: Project
    :type body: dict | bytes

    :rtype: Project
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    project = Project.from_dict(connexion.request.get_json())
    project_dict = project.to_dict()
    mongo.projects.insert_one(project_dict)
    return serialize(project_dict), 201


def get_project(id_):
    """Get a single project by ID



    :param id: ID of test project
    :type id: str

    :rtype: Project
    """
    if ObjectId.is_valid(id_):
        project = mongo.projects.find_one({"_id": ObjectId(id_)})
    else:
        project = mongo.projects.find_one({"name": id_})
    return serialize(project)


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
    filters = {}
    if owner_id:
        filters["ownerId"] = owner_id
    if group_id:
        filters["groupId"] = group_id
    offset = (page * page_size) - page_size
    total_items = mongo.projects.count(filters)
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    projects = mongo.projects.find(filters, skip=offset, limit=page_size)
    return {
        "projects": [serialize(project) for project in projects],
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
    body = Project.from_dict(connexion.request.get_json())
    project = body.to_dict()
    existing_project = mongo.projects.find_one({"_id": ObjectId(id_)})
    merge_dicts(existing_project, project)
    mongo.projects.replace_one({"_id": ObjectId(id_)}, project)
    return serialize(project)
