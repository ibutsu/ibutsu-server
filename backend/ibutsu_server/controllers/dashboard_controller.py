from http import HTTPStatus

from flask import request

from ibutsu_server.constants import RESPONSE_JSON_REQ
from ibutsu_server.db import db
from ibutsu_server.db.models import Dashboard, Project, User, WidgetConfig
from ibutsu_server.filters import convert_filter
from ibutsu_server.util.app_context import with_app_context
from ibutsu_server.util.projects import project_has_user
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import validate_uuid


@with_app_context
def add_dashboard(dashboard=None, token_info=None, user=None):
    """Create a dashboard

    :param body: Dashboard
    :type body: dict | bytes

    :rtype: Dashboard
    """
    if not request.is_json:
        return RESPONSE_JSON_REQ
    dashboard = Dashboard.from_dict(**request.get_json())
    if dashboard.project_id and not project_has_user(dashboard.project_id, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    if dashboard.user_id and not db.session.get(User, dashboard.user_id):
        return f"User with ID {dashboard.user_id} doesn't exist", HTTPStatus.BAD_REQUEST
    db.session.add(dashboard)
    db.session.commit()
    return dashboard.to_dict(), HTTPStatus.CREATED


@validate_uuid
@with_app_context
def get_dashboard(id_, token_info=None, user=None):
    """Get a single dashboard by ID

    :param id: ID of test dashboard
    :type id: str

    :rtype: Dashboard
    """
    dashboard = db.session.get(Dashboard, id_)
    if not dashboard:
        return "Dashboard not found", HTTPStatus.NOT_FOUND
    if dashboard and dashboard.project and not project_has_user(dashboard.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    return dashboard.to_dict()


@with_app_context
def get_dashboard_list(
    filter_=None, project_id=None, page=1, page_size=25, token_info=None, user=None
):
    """Get a list of dashboards

    :param project_id: Filter dashboards by project ID
    :type project_id: str
    :param user_id: Filter dashboards by user ID
    :type user_id: str
    :param limit: Limit the dashboards
    :type limit: int
    :param offset: Offset the dashboards
    :type offset: int

    :rtype: DashboardList
    """
    query = db.select(Dashboard)
    project = None
    if "project_id" in request.args:
        project = db.session.get(Project, request.args["project_id"])
    if project:
        if not project_has_user(project, user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
        query = query.where(Dashboard.project_id == project_id)

    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, Dashboard)
            if filter_clause is not None:
                query = query.where(filter_clause)

    query = query.order_by(Dashboard.title.asc())
    offset = get_offset(page, page_size)
    total_items = db.session.execute(
        db.select(db.func.count()).select_from(query.select_from())
    ).scalar()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    dashboards = db.session.execute(query.offset(offset).limit(page_size)).scalars().all()
    return {
        "dashboards": [dashboard.to_dict() for dashboard in dashboards],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


@validate_uuid
@with_app_context
def update_dashboard(id_, dashboard=None, token_info=None, user=None):
    """Update a dashboard

    :param id: ID of test dashboard
    :type id: str
    :param body: Dashboard
    :type body: dict | bytes

    :rtype: Dashboard
    """
    if not request.is_json:
        return RESPONSE_JSON_REQ
    dashboard_dict = request.get_json()
    if dashboard_dict.get("metadata", {}).get("project") and not project_has_user(
        dashboard_dict["metadata"]["project"], user
    ):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    dashboard = db.session.get(Dashboard, id_)
    if not dashboard:
        return "Dashboard not found", HTTPStatus.NOT_FOUND
    if not project_has_user(dashboard.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    dashboard.update(request.get_json())
    db.session.add(dashboard)
    db.session.commit()
    return dashboard.to_dict()


@validate_uuid
@with_app_context
def delete_dashboard(id_, token_info=None, user=None):
    """Deletes a dashboard

    :param id: ID of the dashboard to delete
    :type id: str

    :rtype: tuple
    """
    dashboard = db.session.get(Dashboard, id_)
    if not dashboard:
        return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND
    if not project_has_user(dashboard.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    widget_configs = db.session.execute(
        db.select(WidgetConfig).where(WidgetConfig.dashboard_id == dashboard.id)
    ).scalars()
    for widget_config in widget_configs:
        db.session.delete(widget_config)
    db.session.delete(dashboard)
    db.session.commit()
    return HTTPStatus.OK.phrase, HTTPStatus.OK
