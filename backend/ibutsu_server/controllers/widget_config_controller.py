from http import HTTPStatus

import connexion
from sqlalchemy import or_

from ibutsu_server.constants import ALLOWED_TRUE_BOOLEANS, RESPONSE_JSON_REQ, WIDGET_TYPES
from ibutsu_server.db.base import session
from ibutsu_server.db.models import WidgetConfig
from ibutsu_server.filters import convert_filter
from ibutsu_server.util.portals import get_portal
from ibutsu_server.util.projects import get_project, project_has_user
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import validate_uuid


def add_widget_config(widget_config=None, token_info=None, user=None):
    """Create a new widget config

    :param widget_config: The widget_config to save
    :type widget_config: dict | bytes

    :rtype: WidgetConfig
    """
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    data = connexion.request.json

    # bad request checks
    if data["widget"] not in WIDGET_TYPES.keys():
        return "Bad request, widget type does not exist", HTTPStatus.BAD_REQUEST
    # TODO: openapi plugins to support exclusive options at the schema level
    if (
        not any(data.get(key) for key in ["portal_id", "portal", "project_id", "project"])
        or (data.get("project_id") or data.get("project"))
        and (data.get("portal_id") or data.get("portal"))
    ):
        return (
            "Bad request, widget config requires one of project or portal",
            HTTPStatus.BAD_REQUEST,
        )

    # add default weight of 10
    data["weight"] = data.get("weight", 10)

    # project relationship
    # TODO BAD_REQUEST when the project doesn't resolve
    if data.get("project"):
        project = get_project(data.pop("project"))
        if not project_has_user(project, user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
        data["project_id"] = project.id

    # portal relationship
    # TODO BAD_REQUEST when the portal doesn't resolve
    if data.get("portal"):
        portal = get_portal(data.pop("portal"))
        # TODO portal user/admin check
        data["portal_id"] = portal.id

    # default to make views navigable
    if data.get("navigable") and isinstance(data["navigable"], str):
        data["navigable"] = data["navigable"][0] in ALLOWED_TRUE_BOOLEANS
    if data.get("type") == "view" and data.get("navigable") is None:
        data["navigable"] = True

    # commit the classmethod constructed model
    widget_config = WidgetConfig.from_dict(**data)
    session.add(widget_config)
    session.commit()
    return widget_config.to_dict(), HTTPStatus.CREATED


@validate_uuid
def get_widget_config(id_, token_info=None, user=None):
    """Get a widget

    :param id: The ID of the widget
    :type id: str

    :rtype: Report
    """
    widget_config = WidgetConfig.query.get(id_)
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
    query = WidgetConfig.query
    if filter_:
        for filter_string in filter_:
            if "project" in filter_string:
                filter_clause = or_(
                    WidgetConfig.project_id.is_(None),
                    convert_filter(filter_string, WidgetConfig),
                )
            elif "portal" in filter_string:
                filter_clause = or_(
                    WidgetConfig.portal_id.is_(None), convert_filter(filter_string, WidgetConfig)
                )
            else:
                filter_clause = convert_filter(filter_string, WidgetConfig)
            if filter_clause is not None:
                query = query.filter(filter_clause)
    offset = get_offset(page, page_size)
    total_items = query.count()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    widgets = query.order_by(WidgetConfig.weight.asc()).offset(offset).limit(page_size).all()
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
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    data = connexion.request.get_json()

    # Bad request checks
    if data.get("widget") and data["widget"] not in WIDGET_TYPES.keys():
        return "Bad request, widget type does not exist", HTTPStatus.BAD_REQUEST
    # check portal and project fields if any of them are set
    # not required on an update, existing entity should already have it.
    if any(data.get(key) for key in ["portal_id", "portal", "project_id", "project"]):
        if (data.get("project_id") or data.get("project")) and (
            data.get("portal_id") or data.get("portal")
        ):
            return (
                "Bad request, widget config requires one of project or portal",
                HTTPStatus.BAD_REQUEST,
            )

    #  project relationship
    if data.get("project"):
        project = get_project(data.pop("project"))
        if not project_has_user(project, user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
        data["project_id"] = project.id

    # portal relationship
    if data.get("portal"):
        portal = get_portal(data.pop("portal"))
        # TODO portal user/admin check
        data["portal_id"] = portal.id

    widget_config = WidgetConfig.query.get(id_)
    if not widget_config:
        return "Widget config not found", HTTPStatus.NOT_FOUND
    # add default weight of 10
    widget_config.weight = getattr(widget_config, "weight", None) or 10
    # default to make views navigable
    if data.get("navigable") and isinstance(data["navigable"], str):
        data["navigable"] = data["navigable"][0] in ALLOWED_TRUE_BOOLEANS
    if data.get("type") and data["type"] == "view" and data.get("navigable") is None:
        data["navigable"] = True
    widget_config.update(data)
    session.add(widget_config)
    session.commit()
    return widget_config.to_dict()


@validate_uuid
def delete_widget_config(id_, token_info=None, user=None):
    """Deletes a widget

    :param id: ID of the widget to delete
    :type id: str

    :rtype: tuple
    """
    widget_config = WidgetConfig.query.get(id_)
    if not widget_config:
        return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND
    else:
        if widget_config.project and not project_has_user(widget_config.project, user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
        # TODO portal user/admin check
        session.delete(widget_config)
        session.commit()
        return HTTPStatus.OK.phrase, HTTPStatus.OK
