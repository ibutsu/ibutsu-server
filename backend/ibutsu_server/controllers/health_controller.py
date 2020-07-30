from dynaconf import settings
from sqlalchemy.exc import InterfaceError
from sqlalchemy.exc import OperationalError

try:
    from ibutsu_server.db.model import Result

    IS_CONNECTED = True
except ImportError:
    IS_CONNECTED = False


def get_health():
    """Get a health report

    :rtype: Health
    """
    return {"status": "OK", "message": "Service is running"}


def get_database_health():
    """Get a health report for the database

    :rtype: Health
    """
    response = ({"status": "Pending", "message": "Fetching service status"}, 200)
    # Try to connect to the database, and handle various responses
    try:
        if not IS_CONNECTED:
            response = ({"status": "Error", "message": "Incomplete database configuration"}, 500)
        else:
            Result.query.first()
            response = ({"status": "OK", "message": "Service is running"}, 200)
    except OperationalError:
        response = ({"status": "Error", "message": "Unable to connect to the database"}, 500)
    except InterfaceError:
        response = ({"status": "Error", "message": "Incorrect connection configuration"}, 500)
    except Exception as e:
        response = ({"status": "Error", "message": str(e)}, 500)
    return response


def get_health_info():
    """Get the information about this server

    :rtype: HealthInfo
    """
    return {
        "frontend": settings.get("FRONTEND_URL", "http://localhost:3000"),
        "backend": settings.get("BACKEND_URL", "http://localhost:8080"),
        "api_ui": settings.get("BACKEND_URL", "http://localhost:8080") + "/api/ui/",
    }
