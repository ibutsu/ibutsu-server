import base64
import binascii
from http import HTTPStatus


def validate_activation_code(activation_code):
    """
    activation code must be present and base64 encoded
    """
    if not activation_code:
        return HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND
    try:
        decoded_value = base64.urlsafe_b64decode(activation_code)
    except (binascii.Error, ValueError):
        return f"Activation code {activation_code} is not valid", HTTPStatus.BAD_REQUEST
    if not decoded_value:
        return f"Activation code {activation_code} is not valid", HTTPStatus.BAD_REQUEST
