import time

from flask import current_app
from ibutsu_server.errors import IbutsuError
from jose.constants import ALGORITHMS
from jose.exceptions import JWTError
from jose.jwt import decode as jwt_decode
from jose.jwt import encode as jwt_encode
from werkzeug.exceptions import Unauthorized


JWT_ISSUER = "org.ibutsu-project.server"
JWT_SECRET = ""
JWT_LIFETIME_SECONDS = 2592000


def generate_token(user_id):
    """Generate a JWT token using the user_id"""
    timestamp = int(time.time())
    claims = {
        "iss": current_app.config.get("JWT_ISSUER", JWT_ISSUER),
        "iat": timestamp,
        "exp": timestamp
        + int(current_app.config.get("JWT_LIFETIME_SECONDS", JWT_LIFETIME_SECONDS)),
        "sub": str(user_id),
    }
    if not JWT_SECRET and not current_app.config.get("JWT_SECRET"):
        raise IbutsuError("JWT_SECRET is not defined in configuration or an environment variable")
    return jwt_encode(claims, JWT_SECRET, algorithm=ALGORITHMS.HS256)


def decode_token(token):
    """Decode a JWT token to check if it is valid"""
    try:
        return jwt_decode(token, JWT_SECRET, algorithms=[ALGORITHMS.HS256])
    except JWTError as error:
        raise Unauthorized from error
