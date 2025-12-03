"""Tests for ibutsu_server.util.login module."""

import base64
from http import HTTPStatus

import pytest

from ibutsu_server.util.login import validate_activation_code


@pytest.mark.parametrize(
    ("activation_code", "expected_result"),
    [
        # Valid base64 codes
        (base64.urlsafe_b64encode(b"test").decode(), None),
        (base64.urlsafe_b64encode(b"user@example.com").decode(), None),
        (base64.urlsafe_b64encode(b"some-activation-code").decode(), None),
        # Empty activation code
        (None, (HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND)),
        ("", (HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND)),
    ],
)
def test_validate_activation_code_valid(activation_code, expected_result):
    """Test validate_activation_code with valid inputs."""
    result = validate_activation_code(activation_code)
    if expected_result is None:
        assert result is None
    else:
        assert result == expected_result


@pytest.mark.parametrize(
    "invalid_code",
    [
        "not-base64!@#$",
        "invalid base64",
        "12345",
        "special_chars_!@#",
    ],
)
def test_validate_activation_code_invalid_base64(invalid_code):
    """Test validate_activation_code with invalid base64 encoding."""
    result = validate_activation_code(invalid_code)
    assert isinstance(result, tuple)
    assert len(result) == 2
    assert invalid_code in result[0]
    assert result[1] == HTTPStatus.BAD_REQUEST


def test_validate_activation_code_empty_decoded_value():
    """Test validate_activation_code with valid base64 that decodes to empty."""
    # Create a valid base64 string that decodes to empty
    # Note: base64.urlsafe_b64encode(b"") produces an empty string ""
    # which gets caught by the first check (if not activation_code)
    empty_code = base64.urlsafe_b64encode(b"").decode()
    result = validate_activation_code(empty_code)
    assert isinstance(result, tuple)
    assert len(result) == 2
    assert result[0] == HTTPStatus.NOT_FOUND.phrase
    assert result[1] == HTTPStatus.NOT_FOUND
