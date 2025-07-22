from http import HTTPStatus

from flask import abort

from ibutsu_server.db.models import User


def validate_admin(function):
    def validate(**kwargs):
        candidate = User.query.get(kwargs.get("user"))
        if not candidate:
            abort(401)
        if not candidate.is_superadmin:
            abort(HTTPStatus.FORBIDDEN)
        return function(**kwargs)

    return validate
