# Ibutsu Server Backend Test Guide

## Overview

This guide explains how to write tests for the ibutsu-server backend using our integration testing approach. Tests use real database operations with SQLite in-memory databases to ensure they validate actual application behavior while remaining fast and isolated.

## Table of Contents

1. [Philosophy](#philosophy)
2. [Getting Started](#getting-started)
3. [Available Fixtures](#available-fixtures)
4. [Writing Tests](#writing-tests)
5. [Common Patterns](#common-patterns)
6. [Testing Best Practices](#testing-best-practices)
7. [Troubleshooting](#troubleshooting)

## Philosophy

### Integration Testing Approach

Our testing philosophy prioritizes **integration tests over heavy mocking** because:

- **Reliability**: Real database operations catch actual issues
- **Maintainability**: Less mock code means less to maintain
- **Confidence**: Tests validate real application behavior
- **Simplicity**: Easier to understand and write

### When to Mock vs When to Use Real Data

**Use Real Database Operations For:**
- Database queries and filters
- SQLAlchemy model operations
- Controller logic
- Widget data aggregation
- User authentication and authorization

**Mock Only External Services:**
- Celery tasks (background jobs)
- Redis/cache operations
- External HTTP requests
- Email sending
- Time-sensitive operations (use `freezegun`)

## Getting Started

### Running Tests

```bash
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
```

### Test File Organization

```
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
└── TEST_GUIDE.md                    # This file
```

## Available Fixtures

### Core Application Fixtures

#### `flask_app`

Creates a Flask application with SQLite in-memory database and test user.

```python
def test_my_endpoint(flask_app):
    client, jwt_token = flask_app
    response = client.get(
        '/api/projects',
        headers={'Authorization': f'Bearer {jwt_token}'}
    )
    assert response.status_code == 200
```

**Provides:**
- Test client for making requests
- JWT token for authenticated requests
- SQLite in-memory database
- Test superadmin user

#### `db_session`

Direct access to the database session within an application context.

```python
def test_database_query(db_session):
    from ibutsu_server.db.models import Project

    project = Project(name='test', title='Test Project')
    db_session.add(project)
    db_session.commit()

    found = Project.query.filter_by(name='test').first()
    assert found is not None
```

#### `app_context`

Application context for operations that need it.

```python
def test_with_context(flask_app, app_context):
    from ibutsu_server.db.models import Project
    # Can now query without explicit context manager
    projects = Project.query.all()
```

### Database Builder Fixtures

These fixtures create database objects with sensible defaults.

#### `make_project`

Factory to create test projects.

```python
def test_with_project(make_project):
    project = make_project(name='my-project', title='My Project')
    assert project.id is not None
    assert project.name == 'my-project'
```

#### `make_run`

Factory to create test runs.

```python
def test_with_run(make_project, make_run):
    project = make_project()
    run = make_run(
        project_id=project.id,
        metadata={'build_number': 100, 'env': 'prod'}
    )
    assert run.id is not None
```

#### `make_result`

Factory to create test results.

```python
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
```

#### `make_user`

Factory to create test users.

```python
def test_with_user(make_user):
    user = make_user(
        email='test@example.com',
        name='Test User',
        is_superadmin=True
    )
    assert user.id is not None
```

#### `make_widget_config`

Factory to create widget configurations.

```python
def test_with_widget(make_project, make_widget_config):
    project = make_project()
    widget = make_widget_config(
        project_id=project.id,
        widget='run-aggregator',
        params={'weeks': 4}
    )
    assert widget.id is not None
```

#### `make_group`

Factory to create test groups.

```python
def test_with_group(make_group):
    group = make_group(name='test-group')
    assert group.id is not None
```

### Utility Fixtures

#### `http_headers`

Standard HTTP headers for API requests.

```python
def test_api_call(flask_app, http_headers):
    client, jwt_token = flask_app
    headers = {**http_headers, 'Authorization': f'Bearer {jwt_token}'}
    response = client.get('/api/projects', headers=headers)
```

#### `pagination_test_cases`

Common pagination test cases.

```python
def test_pagination(flask_app, pagination_test_cases):
    client, jwt_token = flask_app
    for page, page_size in pagination_test_cases:
        response = client.get(
            '/api/results',
            query_string={'page': page, 'pageSize': page_size},
            headers={'Authorization': f'Bearer {jwt_token}'}
        )
        assert response.status_code == 200
```

### Helper Functions

#### Database Builders

```python
from tests.helpers import create_project_with_runs, create_run_with_results

def test_complex_data(db_session):
    # Create project with 5 runs
    project, runs = create_project_with_runs(
        db_session,
        num_runs=5,
        name='test-project'
    )

    # Create run with 10 results
    run, results = create_run_with_results(
        db_session,
        project_id=project.id,
        num_results=10,
        result='passed'
    )
```

#### Assertions

```python
from tests.helpers import assert_pagination, assert_uuid_format, assert_valid_response

def test_list_endpoint(flask_app):
    client, jwt_token = flask_app
    response = client.get(
        '/api/projects',
        query_string={'page': 1, 'pageSize': 25},
        headers={'Authorization': f'Bearer {jwt_token}'}
    )

    # Validate response
    assert_valid_response(response, 200)

    # Validate pagination
    assert_pagination(response.json,
                     expected_page=1,
                     expected_page_size=25,
                     expected_total=50)

    # Validate UUIDs
    for project in response.json['projects']:
        assert_uuid_format(project['id'], 'project.id')
```

## Writing Tests

### Basic Controller Test

```python
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
        headers={'Authorization': f'Bearer {jwt_token}'}
    )

    assert response.status_code == 201
    assert response.json['name'] == 'test-project'

    # Verify in database
    with client.application.app_context():
        from ibutsu_server.db.models import Project
        project = Project.query.filter_by(name='test-project').first()
        assert project is not None
        assert project.title == 'Test Project'
```

### Widget Integration Test

```python
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
```

### Testing with Time-Sensitive Data

```python
from datetime import datetime, timedelta, timezone

def test_recent_data(make_project, make_run, make_result):
    """Test filtering by time."""
    project = make_project()

    # Create old run (outside time window)
    old_time = datetime.now(timezone.utc) - timedelta(days=60)
    old_run = make_run(
        project_id=project.id,
        start_time=old_time,
        metadata={'build': 1}
    )

    # Create recent run (within time window)
    recent_time = datetime.now(timezone.utc) - timedelta(days=7)
    recent_run = make_run(
        project_id=project.id,
        start_time=recent_time,
        metadata={'build': 2}
    )

    # Create results for each
    make_result(run_id=old_run.id, project_id=project.id)
    make_result(run_id=recent_run.id, project_id=project.id)

    # Test filtering - should only get recent
    from ibutsu_server.widgets.run_aggregator import get_recent_run_data
    result = get_recent_run_data(weeks=4, project=str(project.id))
    # ... assertions ...
```

### Parameterized Tests

```python
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
```

## Common Patterns

### Testing API Endpoints

```python
def test_full_api_flow(flask_app, make_project):
    """Test complete CRUD operations via API."""
    client, jwt_token = flask_app
    headers = {'Authorization': f'Bearer {jwt_token}'}

    # CREATE
    response = client.post(
        '/api/result',
        json={'test_id': 'test.example', 'result': 'passed'},
        headers=headers
    )
    assert response.status_code == 201
    result_id = response.json['id']

    # READ
    response = client.get(f'/api/result/{result_id}', headers=headers)
    assert response.status_code == 200
    assert response.json['test_id'] == 'test.example'

    # UPDATE
    response = client.put(
        f'/api/result/{result_id}',
        json={'result': 'failed'},
        headers=headers
    )
    assert response.status_code == 200
    assert response.json['result'] == 'failed'

    # DELETE (if applicable)
    # ... deletion logic ...
```

### Testing with Complex Data Relationships

```python
def test_project_with_full_hierarchy(db_session):
    """Test project with users, runs, results, and widget configs."""
    from tests.helpers import create_project_with_runs, create_results_for_run

    # Create project with runs
    project, runs = create_project_with_runs(
        db_session,
        num_runs=3,
        name='complex-project'
    )

    # Add results to each run
    for run in runs:
        results = create_results_for_run(
            db_session,
            run,
            num_results=5,
            result='passed'
        )

    # Create widget config for project
    from ibutsu_server.db.models import WidgetConfig
    widget = WidgetConfig(
        project_id=project.id,
        widget='run-aggregator',
        params={'weeks': 4}
    )
    db_session.add(widget)
    db_session.commit()

    # Test queries across relationships
    from ibutsu_server.db.models import Result
    total_results = Result.query.filter_by(project_id=project.id).count()
    assert total_results == 15  # 3 runs * 5 results
```

### Testing Error Handling

```python
def test_invalid_project_id(flask_app):
    """Test error handling with invalid project ID."""
    client, jwt_token = flask_app

    response = client.get(
        '/api/project/invalid-uuid',
        headers={'Authorization': f'Bearer {jwt_token}'}
    )

    assert response.status_code == 400
    assert 'error' in response.json or 'detail' in response.json


def test_missing_required_fields(flask_app):
    """Test validation of required fields."""
    client, jwt_token = flask_app

    response = client.post(
        '/api/result',
        json={},  # Missing required fields
        headers={'Authorization': f'Bearer {jwt_token}'}
    )

    assert response.status_code in [400, 422]
```

## Testing Best Practices

### Do's

✅ **Use fixture builders for test data**
```python
# Good
def test_something(make_project, make_result):
    project = make_project()
    result = make_result(project_id=project.id)
```

✅ **Test real database state**
```python
# Good
response = client.post('/api/project', json=data)
# Verify it's actually in the database
with client.application.app_context():
    project = Project.query.get(response.json['id'])
    assert project is not None
```

✅ **Use descriptive test names**
```python
# Good
def test_get_importance_component_with_empty_results():
    ...

def test_get_importance_component_filters_by_component_name():
    ...
```

✅ **Keep tests focused and atomic**
```python
# Good - tests one thing
def test_create_project_sets_owner():
    ...

# Good - tests another thing
def test_create_project_generates_uuid():
    ...
```

### Don'ts

❌ **Don't mock database operations**
```python
# Bad
@patch('ibutsu_server.db.base.session')
def test_something(mock_session):
    mock_session.query.return_value...  # Complex and brittle

# Good
def test_something(make_project):
    project = make_project()  # Real database operation
```

❌ **Don't create complex mock chains**
```python
# Bad
mock_query = MagicMock()
mock_query.filter.return_value.order_by.return_value.all.return_value = [...]

# Good
results = [make_result() for _ in range(5)]  # Real data
```

❌ **Don't skip tests due to mocking difficulty**
```python
# Bad
@pytest.mark.skip(reason="Mocking is too complex")
def test_something():
    ...

# Good - use integration approach
def test_something(make_project, make_result):
    # Real data, no mocking needed
```

❌ **Don't test implementation details**
```python
# Bad - testing how, not what
def test_calls_correct_method(mock_session):
    ...
    mock_session.add.assert_called_once()

# Good - testing behavior
def test_creates_project(make_project):
    project = make_project(name='test')
    assert Project.query.filter_by(name='test').first() is not None
```

### Test Organization

1. **Arrange** - Set up test data
2. **Act** - Execute the operation
3. **Assert** - Verify the results

```python
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
```

## Troubleshooting

### Common Issues

#### "No application context"

**Problem:** Trying to access database outside of application context.

**Solution:** Use `app_context` fixture or wrap in context manager:
```python
def test_something(flask_app):
    client, _ = flask_app
    with client.application.app_context():
        # Database operations here
        projects = Project.query.all()
```

#### "Foreign key constraint failed"

**Problem:** Creating objects without required relationships.

**Solution:** Ensure parent objects exist first:
```python
# Bad
result = make_result(run_id=some_id, project_id=other_id)  # May not exist

# Good
project = make_project()
run = make_run(project_id=project.id)
result = make_result(run_id=run.id, project_id=project.id)
```

#### "Test data leaking between tests"

**Problem:** Data from one test appearing in another.

**Solution:** Each test gets a fresh database with `flask_app` fixture. Ensure you're using fixtures correctly:
```python
# Each test automatically gets a fresh database
def test_first(make_project):
    project = make_project(name='test1')  # Fresh DB

def test_second(make_project):
    project = make_project(name='test2')  # Fresh DB, no 'test1'
```

#### Tests are slow

**Problem:** Tests taking longer than expected.

**Solution:**
1. Use builder fixtures instead of API calls for setup
2. Run tests in parallel: `hatch run test -n auto`
3. Create minimal test data - only what's needed

```python
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
```

### Getting Help

1. Check this guide first
2. Look at existing tests for patterns
3. Check `conftest.py` for available fixtures
4. Review the migration plan: `INTEGRATION_TEST_MIGRATION_PLAN.md`
5. Ask the team!

## References

- [Flask Testing Documentation](https://flask.palletsprojects.com/en/2.3.x/testing/)
- [pytest Documentation](https://docs.pytest.org/)
- [SQLAlchemy Testing](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html)
- [Integration Test Migration Plan](./INTEGRATION_TEST_MIGRATION_PLAN.md)
- [Backend AGENTS.md](../AGENTS.md) - Testing guidelines for AI agents
