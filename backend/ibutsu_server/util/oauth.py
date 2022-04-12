import requests
from flask import current_app
from ibutsu_server.constants import OAUTH_CONFIG
from ibutsu_server.db.base import session
from ibutsu_server.db.models import User
from ibutsu_server.util.urls import build_url


def get_provider_config(provider, is_private=False):
    """Return the customised config for a provider"""
    backend_url = current_app.config.get("BACKEND_URL", "http://localhost:8080/api")
    provider_upper = provider.upper()
    server_url = current_app.config.get(f"{provider_upper}_BASE_URL")
    provider_config = OAUTH_CONFIG.get(provider, {})
    config = {
        "redirect_uri": backend_url + f"/login/auth/{provider}",
        "scope": provider_config.get("sep", " ").join(provider_config.get("scope", [])),
    }
    if provider == "facebook":
        config["app_id"] = current_app.config.get("FACEBOOK_APP_ID")
    else:
        config["client_id"] = current_app.config.get(f"{provider_upper}_CLIENT_ID")
    if current_app.config.get(f"{provider_upper}_AUTH_URL"):
        config["authorization_url"] = build_url(
            server_url, current_app.config.get(f"{provider_upper}_AUTH_URL")
        )
    elif provider_config.get("auth_url"):
        config["authorization_url"] = build_url(server_url, provider_config["auth_url"])
    if is_private:
        config["client_secret"] = current_app.config.get(f"{provider_upper}_CLIENT_SECRET")
        config["user_url"] = build_url(server_url, provider_config.get("user_url"))
        if current_app.config.get(f"{provider_upper}_TOKEN_URL"):
            config["token_url"] = build_url(
                server_url, current_app.config.get(f"{provider_upper}_TOKEN_URL")
            )
        elif provider_config.get("token_url"):
            config["token_url"] = build_url(server_url, provider_config["token_url"])
        if provider_config.get("email_url"):
            config["email_url"] = build_url(server_url, provider_config["email_url"])
    return config


def get_user_from_provider(provider, auth_data):
    """Get a user object from the ``provider``, using the ``auth_data``"""
    provider_config = get_provider_config(provider, is_private=True)
    if provider == "google":
        user_dict = {"id": auth_data["iat"], "email": auth_data["email"], "name": auth_data["name"]}
    else:
        access_token = auth_data.get("accessToken", auth_data.get("access_token"))
        response = requests.get(
            provider_config["user_url"],
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if response.status_code == 200:
            user_dict = response.json()
        else:
            return None
    if not user_dict.get("email"):
        if provider_config.get("email_url"):
            # GitHub only returns the publically visible e-mail address with the user, so we need
            # to make another request to get the e-mail address, see the this answer for more info:
            # https://stackoverflow.com/a/35387123
            response = requests.get(
                provider_config["email_url"], headers={"Authorization": f"Bearer {access_token}"}
            )
            if response.status_code == 200:
                emails = response.json()
                primary_email = [email for email in emails if email["primary"]]
                user_dict["email"] = (
                    primary_email[0]["email"] if primary_email else emails[0]["email"]
                )
            else:
                return None
        else:
            return None
    user = User.query.filter(User.email == user_dict["email"]).first()
    if not user:
        user = User(
            email=user_dict["email"],
            name=user_dict["name"],
            _password=user_dict["id"],
            is_active=True,
            is_superadmin=False,
        )
        session.add(user)
        session.commit()
    return user
