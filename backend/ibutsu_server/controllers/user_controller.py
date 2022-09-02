from datetime import datetime

import connexion
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Token
from ibutsu_server.db.models import User
from ibutsu_server.util.jwt import generate_token
from ibutsu_server.util.query import get_offset
from ibutsu_server.util.uuid import validate_uuid

HIDDEN_FIELDS = ["_password", "password", "activation_code"]


def _hide_sensitive_fields(user_dict):
    """
    Hide certain fields in the user dict
    """
    for field in HIDDEN_FIELDS:
        if field in user_dict:
            user_dict.pop(field)
    return user_dict


def get_current_user(token_info=None, user=None):
    """Return the current user"""
    user = User.query.get(user)
    if not user:
        return "Not authorized", 401

    return _hide_sensitive_fields(user.to_dict())


def update_current_user(token_info=None, user=None):
    """Return the current user"""
    user = User.query.get(user)
    if not user:
        return "Not authorized", 401
    user_dict = connexion.request.get_json()
    user_dict.pop("is_superadmin", None)
    user.update(user_dict)
    session.add(user)
    session.commit()
    return _hide_sensitive_fields(user.to_dict())


def get_token_list(page=1, page_size=25, token_info=None, user=None):
    """Get a list of tokens

    :param page_size: Limit the number of tokens returned, defaults to 25
    :param page: Offset the tokens list, defaults to 0
    :param estimate: Estimate the count of tokens, defaults to False

    :rtype: List[Token]
    """
    user = User.query.get(user)
    if not user:
        return "Not authorized", 401

    query = Token.query.filter(Token.user == user, Token.name != "login-token")
    total_items = query.count()
    offset = get_offset(page, page_size)
    total_pages = (total_items // page_size) + (1 if total_items % page_size > 0 else 0)
    tokens = query.offset(offset).limit(page_size).all()
    return {
        "tokens": [token.to_dict() for token in tokens],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


@validate_uuid
def get_token(id_, token_info=None, user=None):
    """Get a token

    :param id: The ID of the token
    :type id: str

    :rtype: Token
    """
    user = User.query.get(user)
    token = Token.query.get(id_)
    if token.user != user:
        return "Forbidden", 403
    return token.to_dict() if token else ("Token not found", 404)


@validate_uuid
def delete_token(id_, token_info=None, user=None):
    """Delete a token

    :param id: The ID of the token
    :type id: str

    :rtype: Token
    """
    user = User.query.get(user)
    token = Token.query.get(id_)
    if token.user != user:
        return "Forbidden", 403
    session.delete(token)
    session.commit()
    return "OK", 200


def add_token(token=None, token_info=None, user=None):
    """Create a new token

    :param body: Token object
    :type body: dict | bytes

    :rtype: Token
    """
    if not connexion.request.is_json:
        return "Bad request, JSON is required", 400
    user = User.query.get(user)
    if not user:
        return "Not authorized", 401
    token = Token.from_dict(**connexion.request.get_json())
    token.user = user
    token.expires = datetime.fromisoformat(token.expires.replace("Z", "+00:00"))
    token.token = generate_token(user.id, token.expires.timestamp())

    session.add(token)
    session.commit()
    return token.to_dict(), 201
