"""
Fixtures are organized into separate modules in fixtures/:
- constants.py: Standard test IDs and values
- database.py: Flask app, database session, and data builders
- auth.py: User authentication and authorization
- utilities.py: HTTP headers, pagination, etc.

This file uses pytest_plugins to automatically load all fixtures from the fixtures module.

Note: The test suite uses integration testing with real database operations.
Use the flask_app fixture and builder fixtures (make_project, make_run, etc.) for tests.
"""

# Use pytest_plugins to load all fixtures from the fixtures module
pytest_plugins = ["tests.fixtures"]
