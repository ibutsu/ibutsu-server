import os

import bcrypt
from flask import current_app, has_app_context

BCRYPT_LOG_ROUNDS = int(os.getenv("BCRYPT_LOG_ROUNDS", "12"))
BCRYPT_PREFIX = b"2b"
MAX_PASSWORD_BYTES = 72


def _resolve_rounds(rounds: int | None) -> int:
    """Resolve the bcrypt cost factor.

    Priority: explicit argument > Flask app config > module-level default (env-aware).
    """
    if rounds is not None:
        return rounds
    if has_app_context():
        value = current_app.config.get("BCRYPT_LOG_ROUNDS")
        if value is not None:
            return int(value)
    return BCRYPT_LOG_ROUNDS


def validate_password_length(password: str) -> None:
    """Raise :class:`ValueError` if *password* exceeds the bcrypt byte limit."""
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(
            f"Password must be at most {MAX_PASSWORD_BYTES} bytes after encoding; "
            f"got {len(password.encode('utf-8'))} bytes"
        )


def generate_password_hash(password: str | bytes, rounds: int | None = None) -> str:
    """Hash a password using bcrypt.

    The cost factor (*rounds*) is resolved as follows:

    1. If *rounds* is explicitly provided, it is used verbatim.
    2. Otherwise, if a Flask app context exists and ``BCRYPT_LOG_ROUNDS`` is set
       in ``current_app.config``, that value is used.
    3. Otherwise, the module-level ``BCRYPT_LOG_ROUNDS`` value is used, which
       itself can be configured via the ``BCRYPT_LOG_ROUNDS`` environment variable.

    :param password: The plaintext password to hash.
    :param rounds: The log2 number of rounds for bcrypt salt generation.
    :returns: The bcrypt hash as a UTF-8 string.
    :raises ValueError: If the password exceeds 72 bytes.
    """
    password_bytes = password.encode("utf-8") if isinstance(password, str) else password
    if len(password_bytes) > MAX_PASSWORD_BYTES:
        msg = f"Password exceeds {MAX_PASSWORD_BYTES} byte limit"
        raise ValueError(msg)
    resolved_rounds = _resolve_rounds(rounds)
    salt = bcrypt.gensalt(rounds=resolved_rounds, prefix=BCRYPT_PREFIX)
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def check_password_hash(pw_hash: str | bytes, password: str | bytes) -> bool:
    """Verify a password against its bcrypt hash using constant-time comparison.

    :param pw_hash: The stored bcrypt hash.
    :param password: The plaintext password to verify.
    :returns: True if the password matches the hash, False otherwise.
    """
    if isinstance(password, str):
        password = password.encode("utf-8")
    if isinstance(pw_hash, str):
        pw_hash = pw_hash.encode("utf-8")
    return bcrypt.checkpw(password, pw_hash)


__all__ = ["check_password_hash", "generate_password_hash", "validate_password_length"]
