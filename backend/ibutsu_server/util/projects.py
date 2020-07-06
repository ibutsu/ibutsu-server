from bson import ObjectId
from ibutsu_server.mongo import mongo


def get_project_id(project_name):
    """Perform a lookup to return the actual project id"""
    if ObjectId.is_valid(project_name):
        return project_name
    else:
        if mongo.projects.count_documents({"name": project_name}) > 0:
            return str(mongo.projects.find_one({"name": project_name})["_id"])
    return project_name
