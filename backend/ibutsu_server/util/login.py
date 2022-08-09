import base64
import binascii


def validate_activation_code(activation_code):
    """
    activation code must be present and base64 encoded
    """
    if not activation_code:
        return "Not Found", 404
    try:
        decoded_value = base64.urlsafe_b64decode(activation_code)
    except (binascii.Error, ValueError):
        return f"Activation code {activation_code} is not valid", 400
    if not decoded_value:
        return f"Activation code {activation_code} is not valid", 400
