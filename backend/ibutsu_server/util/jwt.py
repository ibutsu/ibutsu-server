import logging
import time

from flask import current_app
from jwt import decode as jwt_decode, encode as jwt_encode
from jwt.exceptions import InvalidTokenError
from werkzeug.exceptions import Unauthorized

from ibutsu_server.db import db
from ibutsu_server.db.models import Token
from ibutsu_server.errors import IbutsuError
from ibutsu_server.util.app_context import with_app_context

# Configure logging
logger = logging.getLogger(__name__)

JWT_ISSUER = "org.ibutsu-project.server"
JWT_SECRET = ""
JWT_LIFETIME_SECONDS = 2592000


@with_app_context
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
    return jwt_encode(claims, jwt_secret, algorithm="HS256")


@with_app_context
def decode_token(token):
    """Decode a JWT token to check if it is valid"""
    logger.info("Decoding token with app context")
    jwt_secret = current_app.config.get("JWT_SECRET") or JWT_SECRET
    try:
        decoded_token = jwt_decode(token, jwt_secret, algorithms=["HS256"])
        logger.debug("Token decoded successfully")
    except InvalidTokenError as error:
        logger.error(f"Invalid token error: {error}")
        raise Unauthorized from error

    try:
        tokens = db.session.execute(
            db.select(Token).where(Token.user_id == decoded_token["sub"])
        ).scalars()
        if not tokens:
            logger.warning(f"No token found for user ID: {decoded_token.get('sub')}")
            raise Unauthorized("Invalid JWT token")
        logger.debug(f"Token validated for user ID: {decoded_token.get('sub')}")
        return decoded_token
    except Exception as e:
        logger.error(f"Error validating token in database: {e}")
        raise
