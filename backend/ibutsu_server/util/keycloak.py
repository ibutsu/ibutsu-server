import requests
from flask import current_app
from ibutsu_server.db.base import session
from ibutsu_server.db.models import User
from ibutsu_server.util.urls import build_url


def get_keycloak_config(is_private=False):
    """Return the configuration for a keycloak provider"""
    if not current_app.config.get("KEYCLOAK_CLIENT_ID") or not current_app.config.get(
        "KEYCLOAK_BASE_URL"
    ):
        return {}
    backend_url = current_app.config.get("BACKEND_URL", "http://localhost:8080/api")
    server_url = current_app.config.get("KEYCLOAK_BASE_URL")
    if not server_url.endswith("auth"):
        server_url = build_url(server_url, "auth")
    realm = current_app.config.get("KEYCLOAK_REALM")
    realm_base_url = build_url(server_url, "realms", realm)
    config = {
        "server_url": server_url,
        "authorization_url": build_url(realm_base_url, "protocol/openid-connect/auth"),
        "realm": realm,
        "client_id": current_app.config.get("KEYCLOAK_CLIENT_ID"),
        "redirect_uri": backend_url + "/login/auth/keycloak",
    }
    if current_app.config.get("KEYCLOAK_ICON"):
        config["icon"] = current_app.config["KEYCLOAK_ICON"]
    if current_app.config.get("KEYCLOAK_NAME"):
        config["display_name"] = current_app.config["KEYCLOAK_NAME"]
    if is_private:
        config["user_url"] = build_url(realm_base_url, "protocol/openid-connect/userinfo")
        config["token_url"] = build_url(realm_base_url, "protocol/openid-connect/token")
    return config


def get_user_from_keycloak(auth_data):
    """Get a user object from the keycloak server"""
    config = get_keycloak_config(is_private=True)
    response = requests.get(
        config["user_url"], headers={"Authorization": "Bearer " + auth_data["access_token"]}
    )
    if response.status_code == 200:
        user_json = response.json()
        user = User.query.filter(User.email == user_json["email"]).first()
        if not user:
            user = User(
                email=user_json["email"], name=user_json["name"], _password=user_json["sub"]
            )
            session.add(user)
            session.commit()
        return user
    return None
