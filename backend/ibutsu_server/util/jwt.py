import time

from flask import current_app
from ibutsu_server.db.models import Token
from ibutsu_server.errors import IbutsuError
from jose.constants import ALGORITHMS
from jose.exceptions import JWTError
from jose.jwt import decode as jwt_decode
from jose.jwt import encode as jwt_encode
from werkzeug.exceptions import Unauthorized


JWT_ISSUER = "org.ibutsu-project.server"
JWT_SECRET = ""
JWT_LIFETIME_SECONDS = 2592000


def generate_token(user_id, expires=None):
    """Generate a JWT token using the user_id"""
    timestamp = int(time.time())
    if not expires:
        expires = timestamp + int(
            current_app.config.get("JWT_LIFETIME_SECONDS", JWT_LIFETIME_SECONDS)
        )
    claims = {
        "iss": current_app.config.get("JWT_ISSUER", JWT_ISSUER),
        "iat": timestamp,
        "exp": expires,
        "sub": str(user_id),
    }
    if not JWT_SECRET and not current_app.config.get("JWT_SECRET"):
        raise IbutsuError("JWT_SECRET is not defined in configuration or an environment variable")
    jwt_secret = current_app.config.get("JWT_SECRET") or JWT_SECRET
    encoded_token = jwt_encode(claims, jwt_secret, algorithm=ALGORITHMS.HS256)
    return encoded_token


def decode_token(token):
    """Decode a JWT token to check if it is valid"""
    jwt_secret = current_app.config.get("JWT_SECRET") or JWT_SECRET
    try:
        decoded_token = jwt_decode(token, jwt_secret, algorithms=[ALGORITHMS.HS256])
    except JWTError as error:
        raise Unauthorized from error
    tokens = Token.query.filter(Token.user_id == decoded_token["sub"]).all()
    if not tokens:
        raise Unauthorized("Invalid JWT token")
    return decoded_token
