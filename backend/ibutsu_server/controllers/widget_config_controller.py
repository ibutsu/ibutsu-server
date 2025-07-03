import logging
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


def _validate_widget_params(widget_type, params):
    """Validate and clean widget parameters against widget type specification"""
    if not params:
        return {}

    # Handle legacy parameter names for backward compatibility
    params = params.copy()

    # Handle jenkins_job_name -> job_name for jenkins-heatmap
    if widget_type == "jenkins-heatmap" and "jenkins_job_name" in params:
        params["job_name"] = params.pop("jenkins_job_name")

    # Handle filters -> additional_filters for compare-runs-view and other widgets
    if widget_type in ["compare-runs-view", "filter-heatmap"] and "filters" in params:
        params["additional_filters"] = params.pop("filters")

    # Handle filter -> additional_filters for jenkins-job-view
    if widget_type == "jenkins-job-view" and "filter" in params:
        params["additional_filters"] = params.pop("filter")

    # Get valid parameter names for this widget type
    valid_param_names = {p["name"] for p in WIDGET_TYPES.get(widget_type, {}).get("params", [])}

    # Filter out invalid parameters and log warnings for dropped parameters
    valid_params = {}
    invalid_params = []

    for k, v in params.items():
        if k in valid_param_names:
            valid_params[k] = v
        else:
            invalid_params.append(k)

    # Log warning if any parameters were dropped
    if invalid_params:
        logging.warning(
            "Invalid parameters dropped for widget type '%s': %s. Valid parameters are: %s",
            widget_type,
            invalid_params,
            list(valid_param_names),
        )

    return valid_params


def add_widget_config(body=None, token_info=None, user=None):
    """Create a new widget config

    :param body: The widget_config to save
    :type body: dict | bytes

    :rtype: WidgetConfig
    """
    if not request.is_json:
        return RESPONSE_JSON_REQ
    # Use body parameter if provided, otherwise get from request (Connexion 3 pattern)
    data = body if body is not None else request.get_json()
    if data["widget"] not in WIDGET_TYPES:
        return "Bad request, widget type does not exist", HTTPStatus.BAD_REQUEST

    # Validate and clean widget parameters
    if data.get("params"):
        data["params"] = _validate_widget_params(data["widget"], data["params"])

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

    # Clean up invalid parameters on retrieval
    if widget_config.params:
        cleaned_params = _validate_widget_params(widget_config.widget, widget_config.params)
        if cleaned_params != widget_config.params:
            widget_config.params = cleaned_params
            db.session.add(widget_config)
            db.session.commit()

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
    count_query = query.with_only_columns(func.count(WidgetConfig.id))
    total_items = db.session.execute(count_query).scalar()
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
def update_widget_config(id_, body=None, token_info=None, user=None):
    """Updates a single widget config

    :param id: ID of widget to update
    :type id: int
    :param body: Widget config data
    :type body: dict

    :rtype: WidgetConfig
    """
    if not request.is_json:
        return RESPONSE_JSON_REQ
    # Use body parameter if provided, otherwise get from request (Connexion 3 pattern)
    data = body if body is not None else request.get_json()
    if data.get("widget") and data["widget"] not in WIDGET_TYPES:
        return "Bad request, widget type does not exist", HTTPStatus.BAD_REQUEST

    widget_config = db.session.get(WidgetConfig, id_)
    if not widget_config:
        return "Widget config not found", HTTPStatus.NOT_FOUND

    # Validate and clean widget parameters
    widget_type = data.get("widget", widget_config.widget)
    if data.get("params"):
        data["params"] = _validate_widget_params(widget_type, data["params"])

    # Look up the project id
    if data.get("project"):
        project = get_project(data.pop("project"))
        if not project_has_user(project, user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
        data["project_id"] = project.id
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
    if widget_config.project and not project_has_user(widget_config.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    db.session.delete(widget_config)
    db.session.commit()
    return HTTPStatus.OK.phrase, HTTPStatus.OK
