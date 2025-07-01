from datetime import datetime
from http import HTTPStatus

from flask import request

from ibutsu_server.constants import RESPONSE_JSON_REQ
from ibutsu_server.db import db
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Token, User
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
    user = db.session.get(User, user)
    if not user:
        return HTTPStatus.UNAUTHORIZED.phrase, HTTPStatus.UNAUTHORIZED

    return _hide_sensitive_fields(user.to_dict())


def update_current_user(body=None, token_info=None, user=None):
    """Update the current user

    :param body: User update data
    :type body: dict | bytes
    """
    if not request.is_json:
        return RESPONSE_JSON_REQ
    # Flask-SQLAlchemy 3.0+ pattern
    user = db.session.get(User, user)
    if not user:
        return HTTPStatus.UNAUTHORIZED.phrase, HTTPStatus.UNAUTHORIZED
    # Use body parameter if provided, otherwise get from request (Connexion 3 pattern)
    user_dict = body if body is not None else request.get_json()
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
    user = db.session.get(User, user)
    if not user:
        return HTTPStatus.UNAUTHORIZED.phrase, HTTPStatus.UNAUTHORIZED

    query = db.select(Token).where(Token.user == user, Token.name != "login-token")
    total_items = db.session.execute(db.select(db.func.count()).select_from(query)).scalar()
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
    # Flask-SQLAlchemy 3.0+ pattern
    user = db.session.get(User, user)
    token = db.session.get(Token, id_)
    if not token:
        return "Token not found", HTTPStatus.NOT_FOUND
    if token.user != user:
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    return token.to_dict()


@validate_uuid
def delete_token(id_, token_info=None, user=None):
    """Delete a token

    :param id: The ID of the token
    :type id: str

    :rtype: Token
    """
    # Flask-SQLAlchemy 3.0+ pattern
    user = db.session.get(User, user)
    token = db.session.get(Token, id_)
    if not token:
        return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND
    if token.user != user:
        return HTTPStatus.FORBIDDEN.phrase, HTTPStatus.FORBIDDEN
    session.delete(token)
    session.commit()
    return HTTPStatus.OK.phrase, HTTPStatus.OK


def add_token(body=None, token_info=None, user=None):
    """Create a new token

    :param body: Token object
    :type body: dict | bytes

    :rtype: Token
    """
    if not request.is_json:
        return RESPONSE_JSON_REQ
    user = db.session.get(User, user)
    if not user:
        return HTTPStatus.UNAUTHORIZED.phrase, HTTPStatus.UNAUTHORIZED
    # Use body parameter if provided, otherwise get from request (Connexion 3 pattern)
    body_data = body if body is not None else request.get_json()
    token = Token.from_dict(**body_data)
    token.user = user
    # token.expires is already parsed by from_dict if it was a string
    if isinstance(token.expires, str):
        token.expires = datetime.fromisoformat(token.expires.replace("Z", "+00:00"))
    token.token = generate_token(user.id, token.expires.timestamp())

    session.add(token)
    session.commit()
    return token.to_dict(), HTTPStatus.CREATED
