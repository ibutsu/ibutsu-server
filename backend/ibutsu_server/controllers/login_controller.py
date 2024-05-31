import json
from base64 import urlsafe_b64encode
from urllib.parse import urlencode
from uuid import uuid4

import connexion
import requests
from flask import current_app
from flask import make_response
from flask import redirect
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from ibutsu_server.constants import LOCALHOST
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Token
from ibutsu_server.db.models import User
from ibutsu_server.util.jwt import generate_token
from ibutsu_server.util.keycloak import get_keycloak_config
from ibutsu_server.util.keycloak import get_user_from_keycloak
from ibutsu_server.util.login import validate_activation_code
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
ACTIVATION_EMAIL = """Thank you for registering!

To activate your account, please click on the link below:

    {activation_url}

Ibutsu"""


def _get_provider_config(provider):
    """To reduce congnitive complexity"""
    if provider == "keycloak":
        # Do the kc stuff
        return get_keycloak_config(is_private=True)
    else:
        return get_provider_config(provider, is_private=True)


def _get_user_from_provider(provider, provider_config, code):
    """To reduce congnitive complexity"""
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
            provider_config["token_url"],
            data=payload,
            headers={"Accept": "application/json"},
            verify=provider_config.get("verify_ssl", True),
        )
        if response.status_code == 200:
            if provider == "keycloak":
                user = get_user_from_keycloak(response.json())
            else:
                user = get_user_from_provider(provider, response.json())
        else:
            print("Error getting token:", response.text)
    return user


def _find_or_create_token(token_name, user):
    """To reduce congnitive complexity"""
    token = Token.query.filter(Token.name == token_name, Token.user_id == user.id).first()
    if not token:
        token = Token(name=token_name, user_id=user.id)
    return token


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

    # superadmins can login even if local login is disabled
    if user and not user.is_superadmin and not current_app.config.get("USER_LOGIN_ENABLED", True):
        return {
            "code": "INVALID",
            "message": "Username/password auth is disabled. "
            "Please login via one of the links below.",
        }, 401

    if user and user.check_password(login["password"]):
        login_token = generate_token(user.id)
        token = Token.query.filter(Token.name == "login-token", Token.user_id == user.id).first()
        if not token:
            token = Token(name="login-token", user_id=user.id)
        token.token = login_token
        session.add(token)
        session.commit()
        return {"name": user.name, "email": user.email, "token": login_token}
    else:
        if not current_app.config.get("USER_LOGIN_ENABLED", True):
            return {
                "code": "INVALID",
                "message": "Username/password auth is disabled. "
                "Please login via one of the links below.",
            }, 401
        else:
            return {"code": "INVALID", "message": "Username and/or password are invalid"}, 401


def support():
    """Return the authentication types that the server supports"""
    return {
        "user": current_app.config.get("USER_LOGIN_ENABLED", True),
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
        current_app.config.get("FRONTEND_URL", f"http://{LOCALHOST}:3000"), "login"
    )
    provider_config = _get_provider_config(provider)
    user = _get_user_from_provider(provider, provider_config, code)
    if not user:
        return "Unauthorized", 401
    jwt_token = generate_token(user.id)
    token = _find_or_create_token("login-token", user)
    token.token = jwt_token
    session.add(token)
    session.commit()
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


def register(email=None, password=None):
    """Register a user

    :param email: The e-mail address of the user
    :type email: str
    :param password: The password for the user
    :type password: str
    """
    if not connexion.request.is_json:
        return "Bad request, JSON is required", 400
    details = connexion.request.get_json()
    if not details.get("email") or not details.get("password"):
        return {"code": "EMPTY", "message": "Username and/or password are empty"}, 401

    # Create a random activation code. Base64 just for funsies
    activation_code = urlsafe_b64encode(str(uuid4()).encode("utf8")).strip(b"=").decode()
    # Create a user
    user = User(
        email=details["email"], password=details["password"], activation_code=activation_code
    )
    user_exists = User.query.filter_by(email=user.email)
    if user_exists:
        return f"The user with email {user.email} already exists", 400
    session.add(user)
    session.commit()

    # Send an activation e-mail
    activation_url = build_url(
        current_app.config.get("BACKEND_URL", f"http://{LOCALHOST}:8080"),
        "api",
        "login",
        "activate",
        activation_code,
    )
    mail = current_app.extensions.get("mail")
    if mail and hasattr(mail, "state") and mail.state is not None:
        mail.send_message(
            "[Ibutsu] Registration Confirmation",
            recipients=[email],
            body=ACTIVATION_EMAIL.format(activation_url=activation_url),
        )
    else:
        print(f"No e-mail configuration. Email: {email} - activation URL: {activation_url}")
    return {}, 201


def recover(email=None):
    """Recover a user account

    :param email: The e-mail address of the user
    """
    if not connexion.request.is_json:
        return "Bad request, JSON is required", 400
    login = connexion.request.get_json()
    if not login.get("email"):
        return "Bad request", 400
    user = User.query.filter(User.email == login["email"]).first()
    if not user:
        return "Bad request", 400
    # Create a random activation code. Base64 just for funsies
    user.activation_code = urlsafe_b64encode(str(uuid4()).encode("utf8")).strip(b"=")
    session.add(user)
    session.commit()
    return {}, 201


def reset_password(activation_code=None, password=None):
    """Reset the password from the recover page

    :param e-mail: The e-mail address of the user
    :param activation_code: The activation_code supplied to the reset page
    :param password: The new password for the user
    """
    if not connexion.request.is_json:
        return "Bad request, JSON is required", 400
    login = connexion.request.get_json()
    if result := validate_activation_code(login.get("activation_code")):
        return result
    if not login.get("activation_code") or not login.get("password"):
        return "Bad request", 400
    user = User.query.filter(User.activation_code == login["activation_code"]).first()
    if not user:
        return "Invalid activation code", 400
    user.password = login["password"]
    user.activation_code = None
    session.add(user)
    session.commit()
    return {}, 201


def activate(activation_code=None):
    """Activate a user's account

    :param activation_code: The activation code
    """
    if result := validate_activation_code(activation_code):
        return result
    user = User.query.filter(User.activation_code == activation_code).first()
    login_url = build_url(
        current_app.config.get("FRONTEND_URL", f"http://{LOCALHOST}:3000"), "login"
    )
    if user:
        user.is_active = True
        user.activation_code = None
        session.add(user)
        session.commit()
        return redirect(f"{login_url}?st=success&msg=Account+activated,+please+log+in.")
    else:
        return redirect(
            f"{login_url}?st=error&msg=Invalid+activation+code,+please+check+the+link"
            "+in+your+email."
        )
