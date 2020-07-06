import connexion
from bson import ObjectId
from ibutsu_server.constants import WIDGET_TYPES
from ibutsu_server.filters import generate_filter_object
from ibutsu_server.mongo import mongo
from ibutsu_server.util import merge_dicts
from ibutsu_server.util import serialize
from ibutsu_server.util.projects import get_project_id
from pymongo import ASCENDING
from pymongo.errors import OperationFailure


def add_widget_config(widget_config=None):
    """Create a new widget config

    :param widget_config: The widget_config to save
    :type widget_config: dict | bytes

    :rtype: WidgetConfig
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    widget_config = connexion.request.json
    if widget_config["widget"] not in WIDGET_TYPES.keys():
        return "Bad request, widget type does not exist", 400
    # add default weight of 10
    if not widget_config.get("weight"):
        widget_config["weight"] = 10
    # Look up the project id
    if widget_config.get("project"):
        widget_config["project"] = get_project_id(widget_config["project"])
    # default to make views navigable
    if widget_config.get("type") == "view" and not widget_config.get("navigable"):
        widget_config["navigable"] = "true"
    mongo.widget_config.insert_one(widget_config)
    widget_config = serialize(widget_config)
    return widget_config, 201


def get_widget_config(id_):
    """Get a widget

    :param id: The ID of the widget
    :type id: str

    :rtype: Report
    """
    widget_config = mongo.widget_config.find_one({"_id": ObjectId(id_)})
    return serialize(widget_config)


def get_widget_config_list(filter_=None, page=1, page_size=25):
    """Get a list of widgets

    :param filter_: A list of filters to apply
    :type filter_: list
    :param page: Set the page of items to return, defaults to 1
    :type page: int
    :param page_size: Set the number of items per page, defaults to 25
    :type page_size: int

    :rtype: ReportList
    """
    filters = {}
    if filter_:
        for filter_string in filter_:
            filter_obj = generate_filter_object(filter_string)
            if filter_obj:
                filters.update(filter_obj)
        # Update the project_id filter to account for unset project ids
        if "project" in filters:
            filters["$or"] = [
                {"project": {"$exists": False}},
                {"project": {"$eq": None}},
                {"project": filters["project"]},
            ]
            del filters["project"]
    offset = (page * page_size) - page_size
    total_items = mongo.widget_config.count({})
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    widgets = mongo.widget_config.find(
        filters, skip=offset, limit=page_size, sort=[("weight", ASCENDING)]
    )
    return {
        "widgets": [serialize(widget) for widget in widgets],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


def update_widget_config(id_):
    """Updates a single widget config

    :param id: ID of widget to update
    :type id: int
    :param body: Result
    :type body: dict

    :rtype: Result
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    widget_config = connexion.request.get_json()
    if widget_config.get("widget") and widget_config["widget"] not in WIDGET_TYPES.keys():
        return "Bad request, widget type does not exist", 400
    # Look up the project id
    if widget_config.get("project"):
        widget_config["project"] = get_project_id(widget_config["project"])
    existing_widget_config = mongo.widget_config.find_one({"_id": ObjectId(id_)})
    # add default weight of 10
    if not existing_widget_config.get("weight"):
        existing_widget_config["weight"] = 10
    # default to make views navigable
    if widget_config.get("type") == "view" and not widget_config.get("navigable"):
        widget_config["navigable"] = "true"
    merge_dicts(existing_widget_config, widget_config)
    mongo.widget_config.replace_one({"_id": ObjectId(id_)}, widget_config)
    return serialize(widget_config)


def delete_widget_config(id_):
    """Deletes a widget

    :param id: ID of the widget to delete
    :type id: str

    :rtype: tuple
    """
    try:
        mongo.widget_config.delete_one({"_id": ObjectId(id_)})
        return "OK", 200
    except OperationFailure:
        return "Not Found", 404
