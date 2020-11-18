import connexion
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Dashboard


def add_dashboard(dashboard=None):
    """Create a dashboard

    :param body: Dashboard
    :type body: dict | bytes

    :rtype: Dashboard
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    dashboard = Dashboard.from_dict(**connexion.request.get_json())
    session.add(dashboard)
    session.commit()
    return dashboard.to_dict(), 201


def get_dashboard(id_):
    """Get a single dashboard by ID

    :param id: ID of test dashboard
    :type id: str

    :rtype: Dashboard
    """
    dashboard = Dashboard.query.filter(Dashboard.name == id_).first()
    if not dashboard:
        dashboard = Dashboard.query.get(id_)
    if not dashboard:
        return "Dashboard not found", 404
    return dashboard.to_dict()


def get_dashboard_list(project_id=None, user_id=None, page=1, page_size=25):
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
    if project_id:
        query = query.filter(Dashboard.project_id == project_id)
    if user_id:
        query = query.filter(Dashboard.user_id == user_id)
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


def update_dashboard(id_, dashboard=None):
    """Update a dashboard

    :param id: ID of test dashboard
    :type id: str
    :param body: Dashboard
    :type body: dict | bytes

    :rtype: Dashboard
    """
    if not connexion.request.is_json:
        return "Bad request, JSON required", 400
    dashboard = Dashboard.query.get(id_)
    if not dashboard:
        return "Dashboard not found", 404
    dashboard.update(connexion.request.get_json())
    session.add(dashboard)
    session.commit()
    return dashboard.to_dict()
