import json
import random
import string
from urllib.parse import urlencode

import connexion
import requests
from flask import current_app
from flask import make_response
from flask import redirect
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from ibutsu_server.db.models import User
from ibutsu_server.util.jwt import generate_token
from ibutsu_server.util.keycloak import get_keycloak_config
from ibutsu_server.util.keycloak import get_user_from_keycloak
from ibutsu_server.util.oauth import get_provider_config
from ibutsu_server.util.oauth import get_user_from_provider
from ibutsu_server.util.urls import build_url

AUTH_WINDOW = """<html>
<head></head>
<body>
  <script>
      window.addEventListener("message", function (event) {{
        if (event.data.message === "requestResult") {{
          event.source.postMessage({{"message": "deliverResult", result: {data} }}, "*");
        }}
      }});
  </script>
</body>
</html>"""


def _generate_state():
    allowed_chars = string.ascii_letters + string.punctuation
    return "".join(random.choice(allowed_chars) for x in range(40))


def login(email=None, password=None):
    """login

    :param email: The e-mail address of the user
    :type email: str
    :param password: The password for the user
    :type password: str

    :rtype: LoginToken
    """
    if not connexion.request.is_json:
        return "Bad request, JSON is required", 400
    login = connexion.request.get_json()
    if not login.get("email") or not login.get("password"):
        return {"code": "EMPTY", "message": "Username and/or password are empty"}, 401
    user = User.query.filter_by(email=login["email"]).first()
    if user and user.check_password(login["password"]):
        return {"name": user.name, "email": user.email, "token": generate_token(user.email)}
    else:
        return {"code": "INVALID", "message": "Username and/or password are invalid"}, 401


def support():
    """Return the authentication types that the server supports"""
    return {
        "user": True,
        "keycloak": get_keycloak_config().get("client_id") is not None,
        "google": get_provider_config("google")["client_id"] is not None,
        "github": get_provider_config("github")["client_id"] is not None,
        "facebook": get_provider_config("facebook")["app_id"] is not None,
        "gitlab": get_provider_config("gitlab")["client_id"] is not None,
    }


def config(provider):
    """Return the configuration for a particular login provider"""
    if provider == "keycloak":
        return get_keycloak_config(is_private=False)
    else:
        return get_provider_config(provider, is_private=False)


def auth(provider):
    """Auth redirect URL"""
    if not connexion.request.args.get("code"):
        return "Bad request", 400
    code = connexion.request.args["code"]
    frontend_url = build_url(
        current_app.config.get("FRONTEND_URL", "http://localhost:3000"), "login"
    )
    if provider == "keycloak":
        # Do the kc stuff
        provider_config = get_keycloak_config(is_private=True)
    else:
        provider_config = get_provider_config(provider, is_private=True)
    user = None
    if provider == "google":
        # Google does things its own way...
        try:
            # Verify the token
            id_info = id_token.verify_oauth2_token(code, Request(), provider_config["client_id"])
            # ID token is valid. Get the user's Google Account ID from the decoded token.
            user = get_user_from_provider(provider, id_info)
        except ValueError:
            # Invalid token
            return "Unauthorized", 401
    else:
        # For everyone else
        payload = {
            "client_id": provider_config["client_id"],
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": provider_config["redirect_uri"],
        }
        if provider_config.get("client_secret"):
            payload["client_secret"] = provider_config["client_secret"]
        response = requests.post(
            provider_config["token_url"], data=payload, headers={"Accept": "application/json"}
        )
        if response.status_code == 200:
            if provider == "keycloak":
                user = get_user_from_keycloak(response.json())
            else:
                user = get_user_from_provider(provider, response.json())
    if not user:
        return "Unauthorized", 401
    jwt_token = generate_token(user.id)
    if provider == "keycloak":
        query_params = urlencode({"email": user.email, "name": user.name, "token": jwt_token})
        return redirect(f"{frontend_url}?{query_params}")
    elif provider == "google":
        return {"email": user.email, "name": user.name, "token": jwt_token}
    else:
        return make_response(
            AUTH_WINDOW.format(
                data=json.dumps({"email": user.email, "name": user.name, "token": jwt_token})
            )
        )
    # Finally, if nothing above works or is caught, return a 401
    return "Unauthorized", 401
