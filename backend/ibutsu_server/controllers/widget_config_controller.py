import connexion
from ibutsu_server.constants import WIDGET_TYPES
from ibutsu_server.db.base import session
from ibutsu_server.db.models import WidgetConfig
from ibutsu_server.filters import convert_filter
from ibutsu_server.util.projects import get_project_id
from sqlalchemy import or_


def add_widget_config(widget_config=None):
    """Create a new widget config

    :param widget_config: The widget_config to save
    :type widget_config: dict | bytes

    :rtype: WidgetConfig
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    data = connexion.request.json
    if data["widget"] not in WIDGET_TYPES.keys():
        return "Bad request, widget type does not exist", 400
    # add default weight of 10
    if not data.get("weight"):
        data["weight"] = 10
    # Look up the project id
    if data.get("project"):
        data["project"] = get_project_id(data["project"])
    # default to make views navigable
    if data.get("type") == "view" and not data.get("navigable"):
        data["navigable"] = "true"
    widget_config = WidgetConfig.from_dict(data)
    session.add(widget_config)
    session.commit()
    return widget_config.to_dict(), 201


def get_widget_config(id_):
    """Get a widget

    :param id: The ID of the widget
    :type id: str

    :rtype: Report
    """
    widget_config = WidgetConfig.query.get(id_)
    return widget_config.to_dict()


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
    query = WidgetConfig.query
    if filter_:
        for filter_string in filter_:
            if "project" in filter_string:
                filter_clause = or_(
                    WidgetConfig.data["project"].is_(None),
                    convert_filter(filter_string, WidgetConfig),
                )
            else:
                filter_clause = convert_filter(filter_string, WidgetConfig)
            if filter_clause is not None:
                query = query.filter(filter_clause)
    offset = (page * page_size) - page_size
    total_items = query.count()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    widgets = query.order_by(WidgetConfig.data["weight"].desc()).offset(offset).limit(page_size)
    return {
        "widgets": [widget.to_dict() for widget in widgets],
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
    data = connexion.request.get_json()
    if data.get("widget") and data["widget"] not in WIDGET_TYPES.keys():
        return "Bad request, widget type does not exist", 400
    # Look up the project id
    if data.get("project"):
        data["project"] = get_project_id(data["project"])
    widget_config = WidgetConfig.query.get(id_)
    # add default weight of 10
    if not widget_config.get("weight"):
        widget_config["weight"] = 10
    # default to make views navigable
    if data.get("type") == "view" and not data.get("navigable"):
        data["navigable"] = "true"
    widget_config.update(data)
    session.add(widget_config)
    session.commit()
    return widget_config.to_dict()


def delete_widget_config(id_):
    """Deletes a widget

    :param id: ID of the widget to delete
    :type id: str

    :rtype: tuple
    """
    widget_config = WidgetConfig.query.get(id_)
    if not widget_config:
        return "Not Found", 404
    else:
        session.delete(widget_config)
        session.commit()
        return "OK", 200
