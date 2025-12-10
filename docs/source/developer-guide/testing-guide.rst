Testing Guide
=============

Overview
--------

This guide explains how to write tests for the ibutsu-server backend using our integration testing approach. Tests use real database operations with SQLite in-memory databases to ensure they validate actual application behavior while remaining fast and isolated.

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

Getting Started
---------------

Running Tests
~~~~~~~~~~~~~

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

Test File Organization
~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: text

   backend/tests/
   ├── conftest.py                      # Shared fixtures
   ├── helpers/                         # Test helper functions
   │   ├── __init__.py
   │   ├── db_builders.py              # Database builder functions
   │   ├── assertions.py               # Common assertions
   │   └── factories.py                # Data factories
   ├── controllers/                     # Controller integration tests
   │   └── test_*_controller.py
   ├── widgets/                         # Widget integration tests
   │   └── test_*.py
   └── TEST_GUIDE.md                    # Documentation

SQLAlchemy 2.0 Patterns
-----------------------

This project uses SQLAlchemy 2.0 patterns. Here are the key differences from legacy patterns:

Querying Records
~~~~~~~~~~~~~~~~

**❌ Legacy Pattern (Deprecated):**

.. code-block:: python

   # Don't use Model.query.get() - deprecated in SQLAlchemy 2.0
   user = User.query.get(user_id)
   project = Project.query.filter_by(name='test').first()
   results = Result.query.all()

**✅ SQLAlchemy 2.0 Pattern:**

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

**❌ Legacy Pattern (Deprecated):**

.. code-block:: python

   # Don't pass query directly to select_from()
   query = db.select(Project)
   total = db.session.execute(
       db.select(db.func.count()).select_from(query)  # Deprecated!
   ).scalar()

**✅ SQLAlchemy 2.0 Pattern:**

.. code-block:: python

   # Use .subquery() to convert query to subquery
   query = db.select(Project)
   total = db.session.execute(
       db.select(db.func.count()).select_from(query.subquery())
   ).scalar()

Common Query Patterns
~~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   from ibutsu_server.db import db
   from ibutsu_server.db.models import Project, Run, Result

   # Get one record or None
   project = db.session.execute(
       db.select(Project).where(Project.name == 'test')
   ).scalar_one_or_none()

   # Get one record (raises if not found or multiple found)
   project = db.session.execute(
       db.select(Project).where(Project.id == project_id)
   ).scalar_one()

   # Get all records with filter
   runs = db.session.execute(
       db.select(Run).where(Run.project_id == project_id)
   ).scalars().all()

   # Count with filter
   count = db.session.execute(
       db.select(db.func.count()).select_from(
           db.select(Result).where(Result.result == 'passed').subquery()
       )
   ).scalar()

   # Order and limit
   recent_runs = db.session.execute(
       db.select(Run)
       .order_by(Run.start_time.desc())
       .limit(10)
   ).scalars().all()

In Tests
~~~~~~~~

When verifying database state in tests:

.. code-block:: python

   def test_create_project(flask_app, make_project):
       """Example test using SQLAlchemy 2.0 patterns"""
       client, jwt_token = flask_app

       # Create via API
       response = client.post('/api/project', json={'name': 'test'})

       # Verify in database using SQLAlchemy 2.0 pattern
       with client.application.app_context():
           from ibutsu_server.db import db
           from ibutsu_server.db.models import Project

           project = db.session.get(Project, response.json['id'])
           assert project is not None
           assert project.name == 'test'

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

Writing Tests
-------------

Basic Controller Test
~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   def test_create_project(flask_app):
       """Test creating a project via API."""
       client, jwt_token = flask_app

       project_data = {
           'name': 'test-project',
           'title': 'Test Project'
       }

       response = client.post(
           '/api/project',
           json=project_data,
           headers=auth_headers(jwt_token)
       )

       assert response.status_code == 201
       assert response.json['name'] == 'test-project'

       # Verify in database
       with client.application.app_context():
           from ibutsu_server.db import db
           from ibutsu_server.db.models import Project
           project = db.session.execute(
               db.select(Project).filter_by(name='test-project')
           ).scalar_one_or_none()
           assert project is not None
           assert project.title == 'Test Project'

Widget Integration Test
~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   def test_widget_with_real_data(make_project, make_run, make_result):
       """Test widget function with real database data."""
       # Set up test data
       project = make_project(name='test-project')
       run = make_run(
           project_id=project.id,
           metadata={'build_number': 100}
       )

       # Create various results
       for i in range(10):
           make_result(
               run_id=run.id,
               project_id=project.id,
               result='passed' if i % 2 == 0 else 'failed',
               metadata={'component': 'frontend'}
           )

       # Test the widget function
       from ibutsu_server.widgets.my_widget import get_my_widget
       result = get_my_widget(project=str(project.id))

       # Assertions on real data
       assert result is not None
       assert 'data' in result

Parameterized Tests
~~~~~~~~~~~~~~~~~~~

.. code-block:: python

   import pytest

   @pytest.mark.parametrize('result_status,expected_count', [
       ('passed', 5),
       ('failed', 3),
       ('skipped', 2),
   ])
   def test_result_counts(make_project, make_run, make_result, result_status, expected_count):
       """Test counting results by status."""
       project = make_project()
       run = make_run(project_id=project.id)

       # Create results with specified status
       for _ in range(expected_count):
           make_result(
               run_id=run.id,
               project_id=project.id,
               result=result_status
           )

       # Query and verify count
       from ibutsu_server.db.models import Result
       count = Result.query.filter_by(
           project_id=project.id,
           result=result_status
       ).count()

       assert count == expected_count

Testing Best Practices
----------------------

Do's
~~~~

✅ **Use fixture builders for test data**

.. code-block:: python

   # Good
   def test_something(make_project, make_result):
       project = make_project()
       result = make_result(project_id=project.id)

✅ **Test real database state**

.. code-block:: python

   # Good
   response = client.post('/api/project', json=data)
   # Verify it's actually in the database
   with client.application.app_context():
       from ibutsu_server.db import db
       project = db.session.get(Project, response.json['id'])
       assert project is not None

✅ **Use descriptive test names**

.. code-block:: python

   # Good
   def test_get_importance_component_with_empty_results():
       ...

   def test_get_importance_component_filters_by_component_name():
       ...

✅ **Keep tests focused and atomic**

.. code-block:: python

   # Good - tests one thing
   def test_create_project_sets_owner():
       ...

   # Good - tests another thing
   def test_create_project_generates_uuid():
       ...

Don'ts
~~~~~~

❌ **Don't mock database operations**

.. code-block:: python

   # Bad
   @patch('ibutsu_server.db.base.session')
   def test_something(mock_session):
       mock_session.query.return_value...  # Complex and brittle

   # Good
   def test_something(make_project):
       project = make_project()  # Real database operation

❌ **Don't create complex mock chains**

.. code-block:: python

   # Bad
   mock_query = MagicMock()
   mock_query.filter.return_value.order_by.return_value.all.return_value = [...]

   # Good
   results = [make_result() for _ in range(5)]  # Real data

❌ **Don't skip tests due to mocking difficulty**

.. code-block:: python

   # Bad
   @pytest.mark.skip(reason="Mocking is too complex")
   def test_something():
       ...

   # Good - use integration approach
   def test_something(make_project, make_result):
       # Real data, no mocking needed

❌ **Don't test implementation details**

.. code-block:: python

   # Bad - testing how, not what
   def test_calls_correct_method(mock_session):
       ...
       mock_session.add.assert_called_once()

   # Good - testing behavior
   def test_creates_project(make_project):
       from ibutsu_server.db import db
       project = make_project(name='test')
       found = db.session.execute(
           db.select(Project).filter_by(name='test')
       ).scalar_one_or_none()
       assert found is not None

Test Organization
~~~~~~~~~~~~~~~~~

1. **Arrange** - Set up test data
2. **Act** - Execute the operation
3. **Assert** - Verify the results

.. code-block:: python

   def test_example(make_project, make_result):
       # Arrange
       project = make_project(name='test-project')

       # Act
       result = make_result(
           project_id=project.id,
           result='passed'
       )

       # Assert
       assert result.project_id == project.id
       assert result.result == 'passed'

Troubleshooting
---------------

Common Issues
~~~~~~~~~~~~~

"No application context"
^^^^^^^^^^^^^^^^^^^^^^^^

**Problem:** Trying to access database outside of application context.

**Solution:** Use ``app_context`` fixture or wrap in context manager:

.. code-block:: python

   def test_something(flask_app):
       from ibutsu_server.db import db
       client, _ = flask_app
       with client.application.app_context():
           # Database operations here
           projects = db.session.execute(db.select(Project)).scalars().all()

"Foreign key constraint failed"
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

**Problem:** Creating objects without required relationships.

**Solution:** Ensure parent objects exist first:

.. code-block:: python

   # Bad
   result = make_result(run_id=some_id, project_id=other_id)  # May not exist

   # Good
   project = make_project()
   run = make_run(project_id=project.id)
   result = make_result(run_id=run.id, project_id=project.id)

"Test data leaking between tests"
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

**Problem:** Data from one test appearing in another.

**Solution:** Each test gets a fresh database with ``flask_app`` fixture. Ensure you're using fixtures correctly:

.. code-block:: python

   # Each test automatically gets a fresh database
   def test_first(make_project):
       project = make_project(name='test1')  # Fresh DB

   def test_second(make_project):
       project = make_project(name='test2')  # Fresh DB, no 'test1'

Tests are slow
^^^^^^^^^^^^^^

**Problem:** Tests taking longer than expected.

**Solution:**

1. Use builder fixtures instead of API calls for setup
2. Run tests in parallel: ``hatch run test -n auto``
3. Create minimal test data - only what's needed

.. code-block:: python

   # Slower - makes API calls
   def test_something(flask_app):
       client, token = flask_app
       response = client.post('/api/project', ...)  # HTTP overhead
       project_id = response.json['id']
       response = client.post('/api/run', ...)  # More HTTP
       ...

   # Faster - direct database
   def test_something(make_project, make_run):
       project = make_project()  # Direct DB insert
       run = make_run(project_id=project.id)  # Direct DB insert
       ...

Getting Help
~~~~~~~~~~~~

1. Check this guide first
2. Look at existing tests for patterns
3. Check ``conftest.py`` for available fixtures
4. Ask the team!

References
----------

* `Flask Testing Documentation <https://flask.palletsprojects.com/en/2.3.x/testing/>`_
* `pytest Documentation <https://docs.pytest.org/>`_
* `SQLAlchemy Testing <https://docs.sqlalchemy.org/en/20/orm/session_transaction.html>`_
* Backend AGENTS.md - Testing guidelines for AI agents
