from urllib.parse import urljoin

import requests
from flask import current_app
from ibutsu_server.constants import OAUTH_CONFIG
from ibutsu_server.db.base import session
from ibutsu_server.db.models import User


def _build_url(base_url, url_path):
    if "://" not in url_path and base_url:
        return urljoin(base_url, url_path)
    else:
        return url_path


def get_provider_config(provider, is_private=False):
    """Return the customised config for a provider"""
    provider_upper = provider.upper()
    backend_url = current_app.config.get("BACKEND_URL", "http://localhost:8080/api")
    server_url = current_app.config.get(f"{provider_upper}_BASE_URL")
    provider_config = OAUTH_CONFIG.get(provider, {})
    config = {
        "client_id": current_app.config.get(f"{provider_upper}_CLIENT_ID"),
        "redirect_uri": backend_url + f"/login/oauth/{provider}",
        "scope": provider_config.get("sep", " ").join(provider_config.get("scope", [])),
    }
    if current_app.config.get(f"{provider_upper}_AUTH_URL"):
        config["authorization_url"] = _build_url(
            server_url, current_app.config.get(f"{provider_upper}_AUTH_URL")
        )
    elif provider_config.get("auth_url"):
        config["authorization_url"] = _build_url(server_url, provider_config["auth_url"])
    if is_private:
        config["client_secret"] = current_app.config.get(f"{provider_upper}_CLIENT_SECRET")
        config["user_url"] = _build_url(server_url, provider_config.get("user_url"))
        if current_app.config.get(f"{provider_upper}_TOKEN_URL"):
            config["token_url"] = _build_url(
                server_url, current_app.config.get(f"{provider_upper}_TOKEN_URL")
            )
        elif provider_config.get("token_url"):
            config["token_url"] = _build_url(server_url, provider_config["token_url"])
    return config


def get_user_from_provider(provider, auth_data):
    """Get a user object from the ``provider``, using the ``auth_data``"""
    provider_config = get_provider_config(provider, is_private=True)
    response = requests.get(
        provider_config["user_url"],
        headers={"Authorization": "Bearer " + auth_data["access_token"]},
    )
    if response.status_code == 200:
        user_json = response.json()
        print(user_json)
        user = User.query.filter(User.email == user_json["email"]).first()
        if not user:
            user = User(email=user_json["email"], name=user_json["name"], _password=user_json["id"])
            session.add(user)
            session.commit()
        return user
    else:
        return None
