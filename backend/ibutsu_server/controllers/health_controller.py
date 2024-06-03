from http import HTTPStatus

from flask import current_app
from sqlalchemy.exc import InterfaceError, OperationalError

try:
    from ibutsu_server.db.model import Result

    IS_CONNECTED = True
except ImportError:
    IS_CONNECTED = False

from ibutsu_server.constants import LOCALHOST


def get_health(token_info=None, user=None):
    """Get a health report

    :rtype: Health
    """
    return {"status": "OK", "message": "Service is running"}


def get_database_health(token_info=None, user=None):
    """Get a health report for the database

    :rtype: Health
    """
    response = ({"status": "Pending", "message": "Fetching service status"}, HTTPStatus.OK)
    # Try to connect to the database, and handle various responses
    try:
        if not IS_CONNECTED:
            response = (
                {"status": "Error", "message": "Incomplete database configuration"},
                HTTPStatus.SERVICE_UNAVAILABLE,
            )
        else:
            Result.query.first()
            response = ({"status": "OK", "message": "Service is running"}, HTTPStatus.OK)
    except OperationalError:
        response = (
            {"status": "Error", "message": "Unable to connect to the database"},
            HTTPStatus.SERVICE_UNAVAILABLE,
        )
    except InterfaceError:
        response = (
            {"status": "Error", "message": "Incorrect connection configuration"},
            HTTPStatus.SERVICE_UNAVAILABLE,
        )
    except Exception as e:
        response = ({"status": "Error", "message": str(e)}, HTTPStatus.INTERNAL_SERVER_ERROR)
    return response


def get_health_info(token_info=None, user=None):
    """Get the information about this server

    :rtype: HealthInfo
    """
    return {
        "frontend": current_app.config.get("FRONTEND_URL", f"http://{LOCALHOST}:3000"),
        "backend": current_app.config.get("BACKEND_URL", f"http://{LOCALHOST}:8080"),
        "api_ui": current_app.config.get("BACKEND_URL", f"http://{LOCALHOST}:8080") + "/api/ui/",
    }
