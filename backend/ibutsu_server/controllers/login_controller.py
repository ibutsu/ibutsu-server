import json
import random
import string

import connexion
import requests
from flask import current_app
from flask import make_response
from ibutsu_server.db.models import User
from ibutsu_server.util.jwt import generate_token
from ibutsu_server.util.oauth import get_provider_config
from ibutsu_server.util.oauth import get_user_from_provider

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
        "redhat": current_app.config.get("REDHAT_CLIENT_ID") is not None,
        "google": get_provider_config("google")["client_id"] is not None,
        "github": get_provider_config("github")["client_id"] is not None,
        "dropbox": get_provider_config("dropbox")["client_id"] is not None,
        "facebook": get_provider_config("facebook")["client_id"] is not None,
        "gitlab": get_provider_config("gitlab")["client_id"] is not None,
    }


def config(provider):
    """Return the configuration for a particular login provider"""
    if provider == "redhat":
        return {}
    else:
        return get_provider_config(provider, is_private=False)


def oauth(provider):
    """OAuth redirect URL"""
    if not connexion.request.args.get("code"):
        return "Bad request", 400
    provider_config = get_provider_config(provider, is_private=True)
    payload = {
        "client_id": provider_config["client_id"],
        "client_secret": provider_config["client_secret"],
        "code": connexion.request.args.get("code"),
        "grant_type": "authorization_code",
        "redirect_uri": provider_config["redirect_uri"],
    }
    r = requests.post(provider_config.get("token_url", "/oauth/token"), data=payload)
    if r.status_code == 200:
        user = get_user_from_provider(provider, r.json())
        jwt_token = generate_token(user.id)
        return make_response(
            AUTH_WINDOW.format(
                data=json.dumps({"email": user.email, "name": user.name, "token": jwt_token})
            )
        )
    else:
        return "Unauthorized", 401
