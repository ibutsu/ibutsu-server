Test Patterns and Best Practices
==================================

Overview
--------

This guide documents established test patterns and best practices for the ibutsu-server backend test suite. These patterns help maintain consistency, reduce code duplication, and make tests easier to write and maintain.

.. contents:: Table of Contents
   :local:
   :depth: 2

Test Markers
------------

Pytest markers help categorize and filter tests. The following markers are defined in ``pyproject.toml``:

Available Markers
~~~~~~~~~~~~~~~~~

``@pytest.mark.integration``
    Marks tests as integration tests that use real database operations. These tests verify actual application behavior with a SQLite in-memory database.

    **When to use:** Tests that interact with the database, API endpoints, or multiple components working together.

``@pytest.mark.validation``
    Marks tests that validate input/request parameters, error handling, and edge cases.

    **When to use:** Tests that verify validation logic, error responses, or parameter checking.

``@pytest.mark.unit``
    Marks tests as unit tests that mock external dependencies.

    **When to use:** Tests that focus on a single function or class in isolation.

``@pytest.mark.slow``
    Marks tests that take a long time to run.

    **When to use:** Tests that involve heavy data processing or complex operations.

Using Markers
~~~~~~~~~~~~~

.. code-block:: python

   import pytest

   @pytest.mark.integration
   def test_create_project(flask_app, make_project):
       """Integration test with real database"""
       project = make_project(name='test-project')
       assert project.id is not None

   @pytest.mark.validation
   @pytest.mark.parametrize('project_id,expected_status', [
       ('not-a-uuid', 400),
       ('00000000-0000-0000-0000-000000000000', 404),
   ])
   def test_project_validation(flask_app, project_id, expected_status):
       """Validation test for error cases"""
       response = client.get(f'/api/project/{project_id}')
       assert response.status_code == expected_status

Running Tests by Marker
~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

   # Run only integration tests
   hatch run test -m integration

   # Run only validation tests
   hatch run test -m validation

   # Run all except slow tests
   hatch run test -m "not slow"

   # Run integration and validation tests
   hatch run test -m "integration or validation"

Parametrization Patterns
-------------------------

Parametrization reduces code duplication by running the same test logic with different inputs.

Pattern 1: Validation Test Parametrization
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

When testing multiple validation scenarios for the same endpoint:

.. code-block:: python

   @pytest.mark.validation
   @pytest.mark.parametrize(
       ("input_id", "expected_status", "description"),
       [
           ("not-a-uuid", 400, "Invalid UUID format triggers validation error"),
           ("00000000-0000-0000-0000-000000000000", 404, "Valid UUID but not found"),
       ],
   )
   def test_endpoint_validation_errors(flask_app, input_id, expected_status, description, auth_headers):
       """Test validation errors for endpoint - parametrized"""
       client, jwt_token = flask_app
       headers = auth_headers(jwt_token)
       response = client.get(f'/api/resource/{input_id}', headers=headers)
       assert response.status_code == expected_status, description

**Benefits:**

* All validation cases visible in one place
* Easy to add new test cases
* Reduces code duplication
* Clear test descriptions

Pattern 2: Pagination Test Parametrization
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

When testing pagination with different page sizes:

.. code-block:: python

   @pytest.mark.integration
   @pytest.mark.parametrize(
       ("page", "page_size"),
       [
           (1, 25),
           (2, 10),
           (1, 56),
       ],
   )
   def test_list_pagination(flask_app, make_project, page, page_size, auth_headers):
       """Test list endpoint with different pagination parameters"""
       client, jwt_token = flask_app

       # Create test data
       for i in range(30):
           make_project(name=f"project-{i}")

       query_string = [("page", page), ("pageSize", page_size)]
       headers = auth_headers(jwt_token)
       response = client.get("/api/project", headers=headers, params=query_string)

       assert response.status_code == 200
       response_data = response.json()
       assert response_data["pagination"]["page"] == page
       assert response_data["pagination"]["pageSize"] == page_size

Pattern 3: Lambda Builder Pattern
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

When parametrized tests need different setup logic:

.. code-block:: python

   @pytest.mark.validation
   @pytest.mark.parametrize(
       ("data_builder", "needs_hierarchy", "expected_status", "expected_error"),
       [
           # Case that needs full hierarchy
           (
               lambda h: {"file": ("test.txt", b"content"), "resultId": str(h["result"].id)},
               True,
               400,
               "no file uploaded"
           ),
           # Case that doesn't need hierarchy
           (
               lambda _: {"resultId": "not-a-uuid"},
               False,
               400,
               "uuid format"
           ),
       ],
   )
   def test_upload_validation(
       flask_app, artifact_test_hierarchy, data_builder,
       needs_hierarchy, expected_status, expected_error, auth_headers
   ):
       """Test upload validation with conditional setup"""
       client, jwt_token = flask_app
       hierarchy = artifact_test_hierarchy if needs_hierarchy else {}

       # Build request data based on hierarchy (if needed)
       data = data_builder(hierarchy)

       headers = auth_headers(jwt_token)
       response = client.post("/api/artifact/upload", data=data, headers=headers)

       assert response.status_code == expected_status
       assert expected_error in response.text.lower()

Composite Fixtures
------------------

Composite fixtures create common data hierarchies to reduce boilerplate in tests.

Available Composite Fixtures
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``artifact_test_hierarchy``
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Creates project → run → result hierarchy for artifact tests.

.. code-block:: python

   @pytest.fixture
   def artifact_test_hierarchy(make_project, make_run, make_result):
       """Create project -> run -> result hierarchy for artifact tests."""
       project = make_project(name="test-project")
       run = make_run(project_id=project.id)
       result = make_result(run_id=run.id, project_id=project.id, test_id="test.example")
       return {"project": project, "run": run, "result": result}

**Usage:**

.. code-block:: python

   def test_delete_artifact(flask_app, artifact_test_hierarchy, auth_headers):
       client, jwt_token = flask_app
       hierarchy = artifact_test_hierarchy
       result = hierarchy["result"]

       # Create artifact
       artifact = make_artifact(result_id=result.id)

       # Test deletion
       response = client.delete(f"/api/artifact/{artifact.id}", headers=auth_headers(jwt_token))
       assert response.status_code == 200

``result_test_hierarchy``
^^^^^^^^^^^^^^^^^^^^^^^^^^

Creates project → run → result hierarchy for result controller tests.

.. code-block:: python

   @pytest.fixture
   def result_test_hierarchy(make_project, make_run, make_result):
       """Create project -> run -> result hierarchy for result tests."""
       project = make_project(name="test-project")
       run = make_run(project_id=project.id)
       result = make_result(run_id=run.id, project_id=project.id, test_id="test.example")
       return {"project": project, "run": run, "result": result}

**Usage:**

.. code-block:: python

   def test_update_result(flask_app, result_test_hierarchy, auth_headers):
       client, jwt_token = flask_app
       hierarchy = result_test_hierarchy
       result = hierarchy["result"]

       update_data = {"result": "failed"}
       response = client.put(
           f"/api/result/{result.id}",
           headers=auth_headers(jwt_token),
           json=update_data
       )
       assert response.status_code == 200

``widget_test_hierarchy``
^^^^^^^^^^^^^^^^^^^^^^^^^^

Creates project → widget_config hierarchy for widget tests.

.. code-block:: python

   @pytest.fixture
   def widget_test_hierarchy(make_project, make_widget_config):
       """Create project -> widget_config hierarchy for widget tests."""
       project = make_project(name="test-project")
       widget_config = make_widget_config(
           project_id=project.id,
           widget="run-aggregator",
           params={"weeks": 4}
       )
       return {"project": project, "widget_config": widget_config}

**Usage:**

.. code-block:: python

   def test_widget_config(flask_app, widget_test_hierarchy, auth_headers):
       client, jwt_token = flask_app
       hierarchy = widget_test_hierarchy
       widget = hierarchy["widget_config"]
       project = hierarchy["project"]

       response = client.get(
           f"/api/widget-config/{widget.id}",
           headers=auth_headers(jwt_token)
       )
       assert response.status_code == 200

Creating New Composite Fixtures
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

When multiple tests need the same data hierarchy:

1. Identify the common setup pattern
2. Create a fixture in ``tests/fixtures/utilities.py``
3. Return a dictionary with all created objects
4. Document the fixture with examples

.. code-block:: python

   @pytest.fixture
   def my_test_hierarchy(make_parent, make_child):
       """
       Create parent -> child hierarchy for my tests.

       Returns a dictionary with parent and child objects.
       This reduces boilerplate in my controller tests.

       Example:
           def test_something(my_test_hierarchy):
               hierarchy = my_test_hierarchy
               parent = hierarchy["parent"]
               child = hierarchy["child"]
               # Test logic here
       """
       parent = make_parent(name="test-parent")
       child = make_child(parent_id=parent.id)
       return {"parent": parent, "child": child}

Test Organization Patterns
---------------------------

Arrange-Act-Assert Pattern
~~~~~~~~~~~~~~~~~~~~~~~~~~~

Organize tests into three clear sections:

.. code-block:: python

   def test_create_project(flask_app, make_group, auth_headers):
       """Test project creation"""
       client, jwt_token = flask_app

       # Arrange - Set up test data
       group = make_group(name="test-group")
       project_data = {
           "name": "my-project",
           "title": "My Project",
           "group_id": str(group.id),
       }

       # Act - Execute the operation
       headers = auth_headers(jwt_token)
       response = client.post("/api/project", headers=headers, json=project_data)

       # Assert - Verify the results
       assert response.status_code == 201
       assert response.json()["name"] == "my-project"

       # Additional verification in database
       with client.application.app_context():
           from ibutsu_server.db.models import Project
           project = Project.query.filter_by(name="my-project").first()
           assert project is not None

Combining Patterns
~~~~~~~~~~~~~~~~~~

Multiple patterns can be combined for powerful test organization:

.. code-block:: python

   @pytest.mark.integration
   @pytest.mark.parametrize(
       ("update_data", "expected_field"),
       [
           ({"title": "New Title"}, "title"),
           ({"name": "new-name"}, "name"),
       ],
   )
   def test_update_project_fields(
       flask_app, make_project, update_data, expected_field, auth_headers
   ):
       """Test updating different project fields - parametrized"""
       # Arrange
       client, jwt_token = flask_app
       project = make_project(name="original-name", title="Original Title")

       # Act
       headers = auth_headers(jwt_token)
       response = client.put(
           f"/api/project/{project.id}",
           headers=headers,
           json=update_data
       )

       # Assert
       assert response.status_code == 200
       response_data = response.json()
       expected_value = update_data[expected_field]
       assert response_data[expected_field] == expected_value

Anti-Patterns to Avoid
-----------------------

Don't Parametrize Unrelated Tests
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Bad:**

.. code-block:: python

   # Don't combine unrelated test logic
   @pytest.mark.parametrize(
       ("endpoint", "method", "data"),
       [
           ("/api/project", "POST", {"name": "test"}),
           ("/api/run", "POST", {"project_id": "123"}),
           ("/api/result", "GET", None),
       ],
   )
   def test_various_endpoints(flask_app, endpoint, method, data):
       # This tests too many unrelated things
       ...

**Good:**

.. code-block:: python

   # Separate tests for different endpoints
   def test_create_project(flask_app):
       ...

   def test_create_run(flask_app):
       ...

   def test_list_results(flask_app):
       ...

Don't Over-Use Composite Fixtures
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Bad:**

.. code-block:: python

   # Don't create a fixture for a single test
   @pytest.fixture
   def very_specific_setup(make_project):
       # Only used in one test
       project = make_project(name="specific-name")
       return {"project": project}

**Good:**

.. code-block:: python

   # Just create the data directly in the test
   def test_specific_case(make_project):
       project = make_project(name="specific-name")
       # Test logic here

Don't Mix Fixture and Direct Setup
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Bad:**

.. code-block:: python

   def test_mixed_setup(result_test_hierarchy, make_run):
       hierarchy = result_test_hierarchy
       # Don't create another run when hierarchy already has one
       another_run = make_run(project_id=hierarchy["project"].id)
       ...

**Good:**

.. code-block:: python

   # Use the fixture completely or not at all
   def test_with_hierarchy(result_test_hierarchy):
       hierarchy = result_test_hierarchy
       run = hierarchy["run"]
       # Use what's in the hierarchy
       ...

   def test_without_hierarchy(make_project, make_run):
       # Or create your own setup
       project = make_project()
       run = make_run(project_id=project.id)
       ...

Examples from Codebase
----------------------

Example 1: Project Controller Validation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

From ``tests/controllers/test_project_controller.py``:

.. code-block:: python

   @pytest.mark.validation
   @pytest.mark.parametrize(
       ("project_id", "expected_status", "description"),
       [
           ("not-a-uuid", 400, "Invalid UUID format triggers validation error"),
           ("00000000-0000-0000-0000-000000000000", 404, "Valid UUID format but project not found"),
       ],
   )
   def test_update_project_validation_errors(
       flask_app, project_id, expected_status, description, auth_headers
   ):
       """Test case for update_project validation errors - parametrized"""
       client, jwt_token = flask_app

       update_data = {"title": "Updated Title"}
       headers = auth_headers(jwt_token)
       response = client.put(
           f"/api/project/{project_id}",
           headers=headers,
           json=update_data,
       )
       assert response.status_code == expected_status, description

Example 2: Result Controller with Composite Fixture
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

From ``tests/controllers/test_result_controller.py``:

.. code-block:: python

   @pytest.mark.integration
   def test_get_result(flask_app, result_test_hierarchy, auth_headers):
       """Test case for get_result"""
       client, jwt_token = flask_app
       hierarchy = result_test_hierarchy
       result = hierarchy["result"]

       headers = auth_headers(jwt_token)
       response = client.get(
           f"/api/result/{result.id}",
           headers=headers,
       )
       assert response.status_code == 200

       response_data = response.json()
       assert response_data["id"] == str(result.id)
       assert response_data["test_id"] == "test.example"

Example 3: Artifact Controller Lambda Builder
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

From ``tests/controllers/test_artifact_controller.py``:

.. code-block:: python

   @pytest.mark.validation
   @pytest.mark.parametrize(
       ("data_builder", "needs_hierarchy", "expected_status", "expected_error_fragment"),
       [
           # No file provided
           (lambda h: {"resultId": str(h["result"].id)}, True, 400, "no file uploaded"),
           # Missing both resultId and runId
           (lambda _: {"file": ("test.txt", b"content")}, False, 400, "resultid or runid"),
           # Invalid UUID format
           (lambda _: {"file": ("test.txt", b"content"), "resultId": "not-a-uuid"}, False, 400, "uuid format"),
       ],
   )
   def test_upload_artifact_validation_errors(
       flask_app,
       artifact_test_hierarchy,
       data_builder,
       needs_hierarchy,
       expected_status,
       expected_error_fragment,
       auth_headers,
   ):
       """Test upload_artifact validation errors - parametrized with lambda builders"""
       client, jwt_token = flask_app
       hierarchy = artifact_test_hierarchy if needs_hierarchy else {}

       # Build request data dynamically based on test case
       base_data = data_builder(hierarchy)

       headers = auth_headers(jwt_token)
       headers["Content-Type"] = "multipart/form-data"

       response = client.post("/api/artifact/upload", data=base_data, headers=headers)

       assert response.status_code == expected_status
       assert expected_error_fragment.lower() in response.text.lower()

Quick Reference
---------------

When to Use Each Pattern
~~~~~~~~~~~~~~~~~~~~~~~~

+----------------------------+----------------------------------------+
| Pattern                    | Use When                               |
+============================+========================================+
| Parametrization            | Testing same logic with different      |
|                            | inputs (validation, pagination)        |
+----------------------------+----------------------------------------+
| Composite Fixtures         | Multiple tests need same data          |
|                            | hierarchy (3+ tests)                   |
+----------------------------+----------------------------------------+
| Lambda Builders            | Parametrized tests need conditional    |
|                            | setup                                  |
+----------------------------+----------------------------------------+
| Integration Marker         | Tests interact with database or        |
|                            | multiple components                    |
+----------------------------+----------------------------------------+
| Validation Marker          | Tests verify input validation or       |
|                            | error handling                         |
+----------------------------+----------------------------------------+
| Unit Marker                | Tests focus on single function with    |
|                            | mocked dependencies                    |
+----------------------------+----------------------------------------+

Checklist for New Tests
~~~~~~~~~~~~~~~~~~~~~~~~

Before writing a new test:

1. ☐ Can I parametrize an existing test instead?
2. ☐ Is there a composite fixture I can use?
3. ☐ Should I create a new composite fixture? (used 3+ times?)
4. ☐ Have I added appropriate pytest markers?
5. ☐ Does my test follow the Arrange-Act-Assert pattern?
6. ☐ Am I using builder fixtures instead of API calls for setup?
7. ☐ Have I verified results in the database where appropriate?

See Also
--------

* :doc:`testing-guide` - Complete testing guide
* :doc:`getting-started` - Developer setup guide
* Backend ``tests/fixtures/`` - Fixture definitions
* Backend ``tests/ITERATION_2_IMPROVEMENTS.md`` - Pattern evolution

References
----------

* `pytest parametrize documentation <https://docs.pytest.org/en/stable/how-to/parametrize.html>`_
* `pytest fixtures documentation <https://docs.pytest.org/en/stable/fixture.html>`_
* `pytest markers documentation <https://docs.pytest.org/en/stable/how-to/mark.html>`_
