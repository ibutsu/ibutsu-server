from http import HTTPStatus

from flask import request
from sqlalchemy import func, or_

from ibutsu_server.constants import ALLOWED_TRUE_BOOLEANS, RESPONSE_JSON_REQ, WIDGET_TYPES
from ibutsu_server.db import db
from ibutsu_server.db.models import WidgetConfig
from ibutsu_server.filters import convert_filter
from ibutsu_server.util.projects import get_project, project_has_user
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import validate_uuid

# TODO: pydantic validation of request data structure


def add_widget_config(widget_config=None, token_info=None, user=None):
    """Create a new widget config

    :param widget_config: The widget_config to save
    :type widget_config: dict | bytes

    :rtype: WidgetConfig
    """
    if not request.is_json:
        return RESPONSE_JSON_REQ
    data = request.json
    if data["widget"] not in WIDGET_TYPES.keys():
        return "Bad request, widget type does not exist", HTTPStatus.BAD_REQUEST

    # add default weight of 10
    if not data.get("weight"):
        data["weight"] = 10
    # Look up the project id
    if data.get("project"):
        project = get_project(data.pop("project"))
        if not project_has_user(project, user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
        data["project_id"] = project.id
    # default to make views navigable
    if data.get("navigable") and isinstance(data["navigable"], str):
        data["navigable"] = data["navigable"][0] in ALLOWED_TRUE_BOOLEANS
    if data.get("type") == "view" and data.get("navigable") is None:
        data["navigable"] = True
    widget_config = WidgetConfig.from_dict(**data)
    db.session.add(widget_config)
    db.session.commit()
    return widget_config.to_dict(), HTTPStatus.CREATED


@validate_uuid
def get_widget_config(id_, token_info=None, user=None):
    """Get a widget

    :param id: The ID of the widget
    :type id: str

    :rtype: Report
    """
    widget_config = db.session.get(WidgetConfig, id_)
    if not widget_config:
        return "Widget config not found", HTTPStatus.NOT_FOUND
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
    query = db.select(WidgetConfig)
    if filter_:
        for filter_string in filter_:
            if "project" in filter_string:
                filter_clause = or_(
                    WidgetConfig.project_id.is_(None),
                    convert_filter(filter_string, WidgetConfig),
                )
            else:
                filter_clause = convert_filter(filter_string, WidgetConfig)
            if filter_clause is not None:
                query = query.where(filter_clause)
    offset = get_offset(page, page_size)
    total_items = db.session.execute(
        db.select(func.count(WidgetConfig.id)).select_from(query.subquery())
    ).scalar()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    widgets = (
        db.session.execute(
            query.order_by(WidgetConfig.weight.asc()).offset(offset).limit(page_size)
        )
        .scalars()
        .all()
    )
    return {
        "widgets": [widget.to_dict() for widget in widgets],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


@validate_uuid
def update_widget_config(id_, body=None, widget_config=None, token_info=None, user=None):
    """Updates a single widget config

    :param id: ID of widget to update
    :type id: int
    :param body: Result
    :type body: dict

    :rtype: Result
    """
    if not request.is_json:
        return RESPONSE_JSON_REQ
    data = request.get_json()
    if data.get("widget") and data["widget"] not in WIDGET_TYPES.keys():
        return "Bad request, widget type does not exist", HTTPStatus.BAD_REQUEST
    # Look up the project id
    if data.get("project"):
        project = get_project(data.pop("project"))
        if not project_has_user(project, user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
        data["project_id"] = project.id
    widget_config = db.session.get(WidgetConfig, id_)
    if not widget_config:
        return "Widget config not found", HTTPStatus.NOT_FOUND
    # add default weight of 10
    if not widget_config.weight:
        widget_config.weight = 10
    # default to make views navigable
    if data.get("navigable") and isinstance(data["navigable"], str):
        data["navigable"] = data["navigable"][0] in ALLOWED_TRUE_BOOLEANS
    if data.get("type") and data["type"] == "view" and data.get("navigable") is None:
        data["navigable"] = True
    widget_config.update(data)
    db.session.add(widget_config)
    db.session.commit()
    return widget_config.to_dict()


@validate_uuid
def delete_widget_config(id_, token_info=None, user=None):
    """Deletes a widget

    :param id: ID of the widget to delete
    :type id: str

    :rtype: tuple
    """
    widget_config = db.session.get(WidgetConfig, id_)
    if not widget_config:
        return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND
    else:
        if widget_config.project and not project_has_user(widget_config.project, user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
        db.session.delete(widget_config)
        db.session.commit()
        return HTTPStatus.OK.phrase, HTTPStatus.OK
