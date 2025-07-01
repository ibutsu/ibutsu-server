"""Utilities for CORS support in controllers.

This module provides functions to handle OPTIONS requests and CORS headers.
"""

from http import HTTPStatus

from flask import Response


def cors_options_handler(*args, **kwargs):
    """Handle OPTIONS requests for CORS preflight.

    This function can be used as a controller function for OPTIONS requests
    in the openapi.yaml specification.

    Example:
        paths:
          /user:
            get:
              operationId: ibutsu_server.controllers.user_controller.get_current_user
            options:
              operationId: ibutsu_server.util.cors.cors_options_handler
    """
    response = Response("", status=HTTPStatus.NO_CONTENT)
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization, *")
    response.headers.add("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS, PATCH")
    response.headers.add("Access-Control-Allow-Credentials", "true")
    return response
