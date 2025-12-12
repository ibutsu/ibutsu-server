"""Tests for ibutsu_server.util.login module."""

import base64
from http import HTTPStatus

import pytest

from ibutsu_server.util.login import validate_activation_code


@pytest.mark.parametrize(
    "activation_code",
    [
        base64.urlsafe_b64encode(b"test").decode(),
        base64.urlsafe_b64encode(b"user@example.com").decode(),
        base64.urlsafe_b64encode(b"some-activation-code").decode(),
    ],
)
def test_validate_activation_code_valid(activation_code):
    """Test validate_activation_code with valid inputs."""
    result = validate_activation_code(activation_code)
    assert result is None


@pytest.mark.parametrize(
    "activation_code",
    [
        None,
        "",
    ],
)
def test_validate_activation_code_empty(activation_code):
    """Test validate_activation_code with empty inputs."""
    result = validate_activation_code(activation_code)
    assert result == (HTTPStatus.NOT_FOUND.phrase, HTTPStatus.NOT_FOUND)


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


def test_validate_activation_code_empty_decoded():
    """Test validate_activation_code with valid base64 that decodes to empty."""
    # Valid base64 that decodes to empty string
    empty_encoded = base64.urlsafe_b64encode(b"").decode()
    result = validate_activation_code(empty_encoded)

    # Assert unconditionally on the expected result shape and status
    # The function should return a tuple with (message, status) for invalid input
    assert isinstance(result, tuple), (
        f"Expected tuple response, got {type(result).__name__}: {result}"
    )
    _msg, status = result
    assert status in (HTTPStatus.BAD_REQUEST, HTTPStatus.NOT_FOUND), (
        f"Expected BAD_REQUEST or NOT_FOUND status, got {status}"
    )
