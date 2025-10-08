from http import HTTPStatus

import connexion

from ibutsu_server.constants import RESPONSE_JSON_REQ
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Dashboard, Project, User, WidgetConfig
from ibutsu_server.filters import convert_filter
from ibutsu_server.util.projects import project_has_user
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import validate_uuid


def add_dashboard(body=None, token_info=None, user=None):
    """Create a dashboard

    :param body: Dashboard
    :type body: dict | bytes

    :rtype: Dashboard
    """
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    body_data = body if body is not None else connexion.request.get_json()
    dashboard = Dashboard.from_dict(**body_data)
    if dashboard.project_id and not project_has_user(dashboard.project_id, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    if dashboard.user_id and not User.query.get(dashboard.user_id):
        return f"User with ID {dashboard.user_id} doesn't exist", HTTPStatus.BAD_REQUEST
    session.add(dashboard)
    session.commit()
    return dashboard.to_dict(), HTTPStatus.CREATED


@validate_uuid
def get_dashboard(id_, token_info=None, user=None):
    """Get a single dashboard by ID

    :param id: ID of test dashboard
    :type id: str

    :rtype: Dashboard
    """
    dashboard = Dashboard.query.get(id_)
    if not dashboard:
        return "Dashboard not found", HTTPStatus.NOT_FOUND
    if dashboard and dashboard.project and not project_has_user(dashboard.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    return dashboard.to_dict()


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
    query = Dashboard.query
    project = None
    if "project_id" in connexion.request.args:
        project = Project.query.get(connexion.request.args["project_id"])
    if project:
        if not project_has_user(project, user):
            return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
        query = query.filter(Dashboard.project_id == project_id)

    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, Dashboard)
            if filter_clause is not None:
                query = query.filter(filter_clause)

    query = query.order_by(Dashboard.title.asc())
    offset = get_offset(page, page_size)
    total_items = query.count()
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    dashboards = query.offset(offset).limit(page_size).all()
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
def update_dashboard(id_, body=None, token_info=None, user=None):
    """Update a dashboard

    :param id: ID of test dashboard
    :type id: str
    :param body: Dashboard
    :type body: dict | bytes

    :rtype: Dashboard
    """
    if not connexion.request.is_json:
        return RESPONSE_JSON_REQ
    body_data = body if body is not None else connexion.request.get_json()
    if body_data.get("metadata", {}).get("project") and not project_has_user(
        body_data["metadata"]["project"], user
    ):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    dashboard = Dashboard.query.get(id_)
    if not dashboard:
        return "Dashboard not found", HTTPStatus.NOT_FOUND
    if dashboard.project and not project_has_user(dashboard.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    dashboard.update(body_data)
    session.add(dashboard)
    session.commit()
    return dashboard.to_dict()


@validate_uuid
def delete_dashboard(id_, token_info=None, user=None):
    """Deletes a dashboard

    :param id: ID of the dashboard to delete
    :type id: str

    :rtype: tuple
    """
    dashboard = Dashboard.query.get(id_)
    if not dashboard:
        return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND
    if not project_has_user(dashboard.project, user):
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN

    # Clear any projects that reference this dashboard as their default dashboard
    projects_with_default = Project.query.filter(Project.default_dashboard_id == dashboard.id).all()
    for project in projects_with_default:
        project.default_dashboard_id = None
        session.add(project)

    # Delete all widget configs associated with this dashboard
    widget_configs = WidgetConfig.query.filter(WidgetConfig.dashboard_id == dashboard.id).all()
    for widget_config in widget_configs:
        session.delete(widget_config)

    # Finally delete the dashboard
    session.delete(dashboard)
    session.commit()
    return HTTPStatus.OK.phrase, HTTPStatus.OK
