from dynaconf import settings
from pymongo.errors import ConfigurationError
from pymongo.errors import ConnectionFailure
from pymongo.errors import InvalidURI

try:
    from ibutsu_server.mongo import mongo

    HAS_MONGO = True
except ImportError:
    HAS_MONGO = False


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
        if not HAS_MONGO:
            response = ({"status": "Error", "message": "Incomplete MongoDB configuration"}, 500)
        else:
            mongo.results.find({}, limit=1)
            response = ({"status": "OK", "message": "Service is running"}, 200)
    except ConnectionFailure:
        response = ({"status": "Error", "message": "Unable to connect to MongoDB"}, 500)
    except InvalidURI:
        response = ({"status": "Error", "message": "Incorrect MongoDB connection URI"}, 500)
    except ConfigurationError:
        response = ({"status": "Error", "message": "Incorrect MongoDB configuration"}, 500)
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
