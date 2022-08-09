import connexion
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Dashboard
from ibutsu_server.db.models import Project
from ibutsu_server.db.models import User
from ibutsu_server.db.models import WidgetConfig
from ibutsu_server.filters import convert_filter
from ibutsu_server.util.projects import project_has_user
from ibutsu_server.util.uuid import validate_uuid


def add_dashboard(dashboard=None, token_info=None, user=None):
    """Create a dashboard

    :param body: Dashboard
    :type body: dict | bytes

    :rtype: Dashboard
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    dashboard = Dashboard.from_dict(**connexion.request.get_json())
    if dashboard.project_id and not project_has_user(dashboard.project_id, user):
        return "Forbidden", 403
    if dashboard.user_id and not User.query.get(dashboard.user_id):
        return f"User with ID {dashboard.user_id} doesn't exist", 400
    session.add(dashboard)
    session.commit()
    return dashboard.to_dict(), 201


@validate_uuid
def get_dashboard(id_, token_info=None, user=None):
    """Get a single dashboard by ID

    :param id: ID of test dashboard
    :type id: str

    :rtype: Dashboard
    """
    dashboard = Dashboard.query.get(id_)
    if not dashboard:
        return "Dashboard not found", 404
    if dashboard and dashboard.project and not project_has_user(dashboard.project, user):
        return "Forbidden", 403
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
            return "Forbidden", 403
        query = query.filter(Dashboard.project_id == project_id)

    if filter_:
        for filter_string in filter_:
            filter_clause = convert_filter(filter_string, Dashboard)
            if filter_clause is not None:
                query = query.filter(filter_clause)

    query = query.order_by(Dashboard.title.asc())
    offset = (page * page_size) - page_size
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
def update_dashboard(id_, dashboard=None, token_info=None, user=None):
    """Update a dashboard

    :param id: ID of test dashboard
    :type id: str
    :param body: Dashboard
    :type body: dict | bytes

    :rtype: Dashboard
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    dashboard_dict = connexion.request.get_json()
    if dashboard_dict.get("metadata", {}).get("project") and not project_has_user(
        dashboard_dict["metadata"]["project"], user
    ):
        return "Forbidden", 403
    dashboard = Dashboard.query.get(id_)
    if not dashboard:
        return "Dashboard not found", 404
    if project_has_user(dashboard.project, user):
        return "Forbidden", 403
    dashboard.update(connexion.request.get_json())
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
        return "Not Found", 404
    if not project_has_user(dashboard.project, user):
        return "Forbidden", 403
    widget_configs = WidgetConfig.query.filter(WidgetConfig.dashboard_id == dashboard.id).all()
    for widget_config in widget_configs:
        session.delete(widget_config)
    session.delete(dashboard)
    session.commit()
    return "OK", 200
