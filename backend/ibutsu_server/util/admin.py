from flask import abort

from ibutsu_server.db.models import User


def check_user_is_admin(user_id):
    """Shared method to check if the logged in user is an administrator"""
    user = User.query.get(user_id)
    if not user:
        abort(401)
    if not user.is_superadmin:
        abort(403)
