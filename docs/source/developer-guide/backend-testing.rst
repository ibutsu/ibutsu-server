Backend Testing Guide
=====================

This comprehensive guide covers testing practices, patterns, and best practices for the ibutsu-server backend. Tests use real database operations with SQLite in-memory databases to ensure they validate actual application behavior while remaining fast and isolated.

.. contents:: Table of Contents
   :local:
   :depth: 2

Philosophy
----------

Integration Testing Approach
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Our testing philosophy prioritizes **integration tests over heavy mocking** because:

* **Reliability**: Real database operations catch actual issues
* **Maintainability**: Less mock code means less to maintain
* **Confidence**: Tests validate real application behavior
* **Simplicity**: Easier to understand and write

When to Mock vs When to Use Real Data
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Use Real Database Operations For:**

* Database queries and filters
* SQLAlchemy model operations
* Controller logic
* Widget data aggregation
* User authentication and authorization

**Mock Only External Services:**

* Celery tasks (background jobs)
* Redis/cache operations
* External HTTP requests
* Email sending
* Time-sensitive operations (use ``freezegun``)

Running Tests
-------------

Commands
~~~~~~~~

.. code-block:: bash

   # Run all tests
   cd backend
   hatch run test

   # Run with coverage
   hatch run test-cov

   # Run specific test file
   hatch run test tests/widgets/test_importance_component.py

   # Run specific test
   hatch run test tests/widgets/test_importance_component.py::test_get_importance_component_with_valid_project

   # Run tests in parallel (default)
   hatch run test -n auto

   # Run tests verbosely
   hatch run test -v

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

Test File Organization
~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: text

   backend/tests/
   ├── conftest.py                      # Shared fixtures
   ├── fixtures/                        # Fixture modules
   │   ├── __init__.py
   │   ├── database.py                 # Flask app and builder fixtures
   │   ├── auth.py                     # Authentication fixtures
   │   ├── utilities.py                # Utility fixtures
   │   └── constants.py                # Test constants
   ├── helpers/                         # Test helper functions
   │   ├── __init__.py
   │   ├── db_builders.py              # Database builder functions
   │   ├── assertions.py               # Common assertions
   │   └── factories.py                # Data factories
   ├── controllers/                     # Controller integration tests
   │   └── test_*_controller.py
   ├── widgets/                         # Widget integration tests
   │   └── test_*.py
   └── tasks/                           # Celery task tests
       └── test_*.py

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
   def test_project_validation(flask_app, project_id, expected_status, auth_headers):
       """Validation test for error cases"""
       client, jwt_token = flask_app
       headers = auth_headers(jwt_token)
       response = client.get(f'/api/project/{project_id}', headers=headers)
       assert response.status_code == expected_status

Available Fixtures
------------------

Core Application Fixtures
~~~~~~~~~~~~~~~~~~~~~~~~~~

``flask_app``
^^^^^^^^^^^^^

Creates a Flask application with SQLite in-memory database and test user.

.. code-block:: python

   def test_my_endpoint(flask_app, auth_headers):
       client, jwt_token = flask_app
       response = client.get(
           '/api/projects',
           headers=auth_headers(jwt_token)
       )
       assert response.status_code == 200

**Provides:**

* Test client for making requests
* JWT token for authenticated requests
* SQLite in-memory database
* Test superadmin user

``db_session``
^^^^^^^^^^^^^^

Direct access to the database session within an application context.

.. code-block:: python

   def test_database_query(db_session):
       from ibutsu_server.db import db
       from ibutsu_server.db.models import Project

       project = Project(name='test', title='Test Project')
       db_session.add(project)
       db_session.commit()

       # SQLAlchemy 2.0 pattern
       found = db.session.execute(
           db.select(Project).filter_by(name='test')
       ).scalar_one_or_none()
       assert found is not None

``app_context``
^^^^^^^^^^^^^^^

Application context for operations that need it.

.. code-block:: python

   def test_with_context(flask_app, app_context):
       from ibutsu_server.db import db
       from ibutsu_server.db.models import Project
       # Can now query without explicit context manager
       projects = db.session.execute(db.select(Project)).scalars().all()

``auth_headers``
^^^^^^^^^^^^^^^^

Factory for creating authenticated request headers.

.. code-block:: python

   def test_authenticated_request(flask_app, auth_headers):
       client, jwt_token = flask_app
       headers = auth_headers(jwt_token)
       response = client.get('/api/project', headers=headers)
       assert response.status_code == 200

Database Builder Fixtures
~~~~~~~~~~~~~~~~~~~~~~~~~~

These fixtures create database objects with sensible defaults.

``make_project``
^^^^^^^^^^^^^^^^

Factory to create test projects.

.. code-block:: python

   def test_with_project(make_project):
       project = make_project(name='my-project', title='My Project')
       assert project.id is not None
       assert project.name == 'my-project'

``make_run``
^^^^^^^^^^^^

Factory to create test runs.

.. code-block:: python

   def test_with_run(make_project, make_run):
       project = make_project()
       run = make_run(
           project_id=project.id,
           metadata={'build_number': 100, 'env': 'prod'}
       )
       assert run.id is not None

``make_result``
^^^^^^^^^^^^^^^

Factory to create test results.

.. code-block:: python

   def test_with_result(make_project, make_run, make_result):
       project = make_project()
       run = make_run(project_id=project.id)
       result = make_result(
           run_id=run.id,
           project_id=project.id,
           test_id='test.example',
           result='passed',
           metadata={'component': 'frontend'}
       )
       assert result.id is not None

``make_user``
^^^^^^^^^^^^^

Factory to create test users.

.. code-block:: python

   def test_with_user(make_user):
       user = make_user(
           email='test@example.com',
           name='Test User',
           is_superadmin=True
       )
       assert user.id is not None

``make_artifact``
^^^^^^^^^^^^^^^^^

Factory to create test artifacts.

.. code-block:: python

   def test_with_artifact(make_result, make_artifact):
       result = make_result()
       artifact = make_artifact(
           result_id=result.id,
           filename='test.log',
           content=b'test content'
       )
       assert artifact.id is not None

``make_import``
^^^^^^^^^^^^^^^

Factory to create import records.

.. code-block:: python

   def test_with_import(make_import):
       import_record = make_import(
           filename='test.xml',
           format='junit',
           status='done'
       )
       assert import_record.id is not None

``make_widget_config``
^^^^^^^^^^^^^^^^^^^^^^

Factory to create widget configurations.

.. code-block:: python

   def test_with_widget(make_project, make_widget_config):
       project = make_project()
       widget = make_widget_config(
           project_id=project.id,
           widget='run-aggregator',
           params={'weeks': 4}
       )
       assert widget.id is not None

``make_group``
^^^^^^^^^^^^^^

Factory to create test groups.

.. code-block:: python

   def test_with_group(make_group):
       group = make_group(name='test-group')
       assert group.id is not None

``make_dashboard``
^^^^^^^^^^^^^^^^^^

Factory to create test dashboards.

.. code-block:: python

   def test_with_dashboard(make_project, make_dashboard):
       project = make_project()
       dashboard = make_dashboard(
           project_id=project.id,
           title='Test Dashboard'
       )
       assert dashboard.id is not None

Composite Fixtures
~~~~~~~~~~~~~~~~~~

Composite fixtures create common data hierarchies to reduce boilerplate in tests.

``artifact_test_hierarchy``
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Creates project → run → result hierarchy for artifact tests.

.. code-block:: python

   def test_delete_artifact(flask_app, artifact_test_hierarchy, auth_headers):
       client, jwt_token = flask_app
       hierarchy = artifact_test_hierarchy
       result = hierarchy["result"]
       # result, run, and project are all available
       ...

``result_test_hierarchy``
^^^^^^^^^^^^^^^^^^^^^^^^^^

Creates project → run → result hierarchy for result controller tests.

.. code-block:: python

   def test_update_result(flask_app, result_test_hierarchy, auth_headers):
       client, jwt_token = flask_app
       hierarchy = result_test_hierarchy
       result = hierarchy["result"]
       ...

``widget_test_hierarchy``
^^^^^^^^^^^^^^^^^^^^^^^^^^

Creates project → widget_config hierarchy for widget tests.

.. code-block:: python

   def test_widget_config(flask_app, widget_test_hierarchy, auth_headers):
       client, jwt_token = flask_app
       hierarchy = widget_test_hierarchy
       widget = hierarchy["widget_config"]
       project = hierarchy["project"]
       ...

Widget Test Fixtures
~~~~~~~~~~~~~~~~~~~~

``bulk_run_creator``
^^^^^^^^^^^^^^^^^^^^

Create multiple runs with sequential attributes.

.. code-block:: python

   def test_multiple_runs(make_project, bulk_run_creator):
       project = make_project()
       runs = bulk_run_creator(
           count=5,
           project_id=project.id,
           metadata_pattern=lambda i: {"build": str(i)}
       )
       assert len(runs) == 5

``bulk_result_creator``
^^^^^^^^^^^^^^^^^^^^^^^

Create multiple results with sequential attributes.

.. code-block:: python

   def test_multiple_results(make_run, bulk_result_creator):
       run = make_run()
       results = bulk_result_creator(
           count=10,
           run_id=run.id,
           project_id=run.project_id,
           component="frontend"
       )
       assert len(results) == 10

``jenkins_run_factory``
^^^^^^^^^^^^^^^^^^^^^^^

Factory for creating Jenkins-style runs with standardized metadata.

.. code-block:: python

   def test_jenkins_widget(make_project, jenkins_run_factory):
       project = make_project()
       run = jenkins_run_factory(
           job_name="my-job",
           build_number="100",
           project_id=project.id
       )
       assert run.metadata["jenkins"]["job_name"] == "my-job"

Test Patterns
-------------

Parametrization Patterns
~~~~~~~~~~~~~~~~~~~~~~~~

Parametrization reduces code duplication by running the same test logic with different inputs.

**Pattern 1: Validation Test Parametrization**

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

**Pattern 2: Pagination Test Parametrization**

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

**Pattern 3: Lambda Builder Pattern**

When parametrized tests need different setup logic:

.. code-block:: python

   @pytest.mark.validation
   @pytest.mark.parametrize(
       ("data_builder", "needs_hierarchy", "expected_status", "expected_error"),
       [
           (lambda h: {"resultId": str(h["result"].id)}, True, 400, "no file uploaded"),
           (lambda _: {"resultId": "not-a-uuid"}, False, 400, "uuid format"),
       ],
   )
   def test_upload_validation(
       flask_app, artifact_test_hierarchy, data_builder,
       needs_hierarchy, expected_status, expected_error, auth_headers
   ):
       """Test upload validation with conditional setup"""
       client, jwt_token = flask_app
       hierarchy = artifact_test_hierarchy if needs_hierarchy else {}
       data = data_builder(hierarchy)

       headers = auth_headers(jwt_token)
       response = client.post("/api/artifact/upload", data=data, headers=headers)

       assert response.status_code == expected_status
       assert expected_error in response.text.lower()

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

SQLAlchemy 2.0 Patterns
-----------------------

This project uses SQLAlchemy 2.0 patterns. Here are the key differences from legacy patterns:

Querying Records
~~~~~~~~~~~~~~~~

**Legacy Pattern (Deprecated):**

.. code-block:: python

   # Don't use Model.query.get() - deprecated in SQLAlchemy 2.0
   user = User.query.get(user_id)
   project = Project.query.filter_by(name='test').first()

**SQLAlchemy 2.0 Pattern:**

.. code-block:: python

   from ibutsu_server.db import db

   # Get by primary key
   user = db.session.get(User, user_id)

   # Query with filter
   project = db.session.execute(
       db.select(Project).filter_by(name='test')
   ).scalar_one_or_none()

   # Get all records
   results = db.session.execute(db.select(Result)).scalars().all()

Counting Records
~~~~~~~~~~~~~~~~

**SQLAlchemy 2.0 Pattern:**

.. code-block:: python

   # Use .subquery() to convert query to subquery
   query = db.select(Project)
   total = db.session.execute(
       db.select(db.func.count()).select_from(query.subquery())
   ).scalar()

Best Practices
--------------

Do's
~~~~

* **Use fixture builders for test data** - ``make_project``, ``make_run``, etc.
* **Test real database state** - Verify objects actually exist in the database
* **Use descriptive test names** - ``test_get_importance_component_with_empty_results``
* **Keep tests focused and atomic** - One assertion per logical behavior
* **Use parametrization** - Reduce code duplication for similar test cases
* **Add appropriate markers** - ``@pytest.mark.integration``, ``@pytest.mark.validation``

Don'ts
~~~~~~

* **Don't mock database operations** - Use real SQLite in-memory database
* **Don't create complex mock chains** - Use builder fixtures instead
* **Don't skip tests due to mocking difficulty** - Use integration approach
* **Don't test implementation details** - Test behavior, not internal calls
* **Don't over-use composite fixtures** - Only create for 3+ tests

Coverage Requirements
---------------------

* **Target:** 80% line coverage for all modules
* **Run:** ``hatch run test-cov`` to verify coverage
* **Report:** Coverage reports generated in ``htmlcov/`` and ``coverage.xml``

.. code-block:: bash

   # Run with coverage for specific module
   hatch run test-cov -- --cov-report=term-missing --cov=ibutsu_server.widgets.importance_component

When to Use Each Pattern
------------------------

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
-----------------------

Before writing a new test:

1. Can I parametrize an existing test instead?
2. Is there a composite fixture I can use?
3. Should I create a new composite fixture? (used 3+ times?)
4. Have I added appropriate pytest markers?
5. Does my test follow the Arrange-Act-Assert pattern?
6. Am I using builder fixtures instead of API calls for setup?
7. Have I verified results in the database where appropriate?

Troubleshooting
---------------

"No application context"
~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:** Trying to access database outside of application context.

**Solution:** Use ``app_context`` fixture or wrap in context manager:

.. code-block:: python

   def test_something(flask_app):
       client, _ = flask_app
       with client.application.app_context():
           # Database operations here
           ...

"Foreign key constraint failed"
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:** Creating objects without required relationships.

**Solution:** Ensure parent objects exist first:

.. code-block:: python

   # Good
   project = make_project()
   run = make_run(project_id=project.id)
   result = make_result(run_id=run.id, project_id=project.id)

"Test data leaking between tests"
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Problem:** Data from one test appearing in another.

**Solution:** Each test gets a fresh database with ``flask_app`` fixture.

Tests are slow
~~~~~~~~~~~~~~

**Solution:**

1. Use builder fixtures instead of API calls for setup
2. Run tests in parallel: ``hatch run test -n auto``
3. Create minimal test data - only what's needed

References
----------

* `Flask Testing Documentation <https://flask.palletsprojects.com/en/2.3.x/testing/>`_
* `pytest Documentation <https://docs.pytest.org/>`_
* `pytest parametrize documentation <https://docs.pytest.org/en/stable/how-to/parametrize.html>`_
* `pytest fixtures documentation <https://docs.pytest.org/en/stable/fixture.html>`_
* `SQLAlchemy Testing <https://docs.sqlalchemy.org/en/20/orm/session_transaction.html>`_
* Backend ``AGENTS.md`` - Testing guidelines for AI agents
