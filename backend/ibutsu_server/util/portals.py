from ibutsu_server.db.models import Portal
from ibutsu_server.util.uuid import is_uuid


def get_portal(portal_name):
    """Perform a lookup to return the actual portal record"""
    if is_uuid(portal_name):
        portal = Portal.query.get(portal_name)
    else:
        portal = Portal.query.filter(Portal.name == portal_name).first()
    return portal


def get_portal_id(portal_name):
    """Shorthand function for a repeated piece of code"""
    portal = get_portal(portal_name)
    return str(portal.id) if portal else None
