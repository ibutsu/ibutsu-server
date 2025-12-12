## backend
- Use `pre-commit run` to include all lint checks and auto fixes
- Automatically work to resolve failures in the pre-commit output
- Do not include excessive emoji in readme, contributing, and other documentation files
- Use pytest parametrization over subtests
- Suggest updates to pytest-ibutsu or the ibutsu-client-python when there are changes to the openAPI specification
- validate any changes to the openapi specification
- Suggest updates to backend controllers that align with modern implementation patterns
- prefer pytest parametrization
- Follow PLC0415 and put imports at the top of files unless absolutely necessary. Include noqa for PLC0415 when this is necessary
- Connexion3 is used with flask3 and sqlalchemy2 for the backend controller implementation
- ASGI through uvicorn workers provide abstraction over our legacy WSGI controller implementation

# frontend
- use `yarn` and `yarn lint` from the frontend directory as the working directory
- prefer the use of patternfly components
- use functional components and prefer patterns that leverage all available react hook patterns
- use strict react-hooks rules for exhaustive deps
- React imports are necessary for JSX


# general
- Do not create summary documents in markdown, add to the RST in `docs`

## Database Migrations
- **Always use Alembic** for database schema changes
- Run `hatch run alembic revision -m "description"` to create new migrations
- Test migrations with `hatch run alembic upgrade head` and `hatch run alembic downgrade -1`
- Never modify the database schema directly in production
- All schema changes must have both upgrade() and downgrade() functions
- Document any PostgreSQL-specific features in migration comments
- Ensure DB migrations use the sqlalchemy wrappers for different types of database engines
- Dynamically look up the existing FK constraint name to support different naming conventions

## Celery Architecture
- **Factory Pattern**: Use `celery_utils.py` for all Celery app creation
- **Two Modes**: Broker-only (Flower) and Flask-integrated (Worker/Scheduler)
- **See CELERY_UTILS.md**: Comprehensive guide at `backend/CELERY_UTILS.md`

### Celery Factory Functions
- **Broker-Only**: Use `create_broker_celery_app()` for monitoring (Flower)
  - No Flask app required
  - No database access
  - Only needs `CELERY_BROKER_URL` environment variable
- **Flask-Integrated**: Use `create_flask_celery_app(flask_app, name)` for workers/scheduler
  - Requires Flask app with database configuration
  - Provides full app context via IbutsuTask
  - Imports all task modules and configures beat schedule

### Celery Testing Guidelines
- Test both factory functions independently (`test_celery_utils.py`)
- Mock only external services (Redis, broker connections)
- Use real Flask app fixture for Flask-integrated tests
- Verify socket timeout configuration in both modes
- Test task registration and beat schedule in Flask-integrated mode
- Verify delegation from `_AppRegistry` to `celery_utils`

## Testing Instructions
- Find the CI plan in the .github/workflows folder.
- Use `hatch run test` to execute tests and `hatch run test-cov` to include coverage from the backend directory as the working directory
- Pass arguments to pytest through `hatch run test -- <-arg>`
- Add or update tests for the code you change, even if nobody asked.
- Do not make changes to cause tests to pass when a bug is identified by the test. Always first investigate for bugs in the tested application component.
- Use full UUID strings for all `id` fields including `run_id` and `result_id` when mocking unless an invalid UUID is specifically being tested
- Focus test coverage on behavior first, not implementation details.
- Identify test coverage increases through parametrization of current test functions before creating new test functions
- Examine and reuse existing fixtures before writing new ones.

### Documentation Reference
- **Backend testing guide**: `docs/source/developer-guide/backend-testing.rst`
- Comprehensive guide with fixtures, patterns, SQLAlchemy 2.0 examples, and best practices

### Coverage Requirements
- **Target**: 80% line coverage for all modules
- **Run**: `hatch run test-cov` to verify coverage
- Coverage reports generated in `htmlcov/` and `coverage.xml`

### Available Test Fixtures
**Database builders:** `make_project`, `make_run`, `make_result`, `make_artifact`, `make_import`, `make_user`, `make_group`, `make_dashboard`, `make_widget_config`

**Composite hierarchies:** `artifact_test_hierarchy`, `result_test_hierarchy`, `widget_test_hierarchy`

**Widget test helpers:** `bulk_run_creator`, `bulk_result_creator`, `jenkins_run_factory`, `fixed_time`

**Core fixtures:** `flask_app`, `db_session`, `app_context`, `auth_headers`

### Parametrization Example
```python
# Good: Single test function with multiple cases
@pytest.mark.parametrize("case", [case1, case2, case3])
def test_feature(case):
    pass

# Avoid: Multiple similar test functions
def test_feature_case1():
    pass
def test_feature_case2():
    pass
def test_feature_case3():
    pass
```

### Integration Testing Approach
- **Prefer integration tests over mocking**: Use `flask_app` fixture with real SQLite database operations
- **Use builder fixtures**: `make_project`, `make_run`, `make_result`, etc. instead of mocks
- **Mock only external services**: Celery tasks, Redis, external HTTP calls, email - not database operations
- **See backend-testing.rst**: Comprehensive guide at `docs/source/developer-guide/backend-testing.rst`
- **Avoid database mocking**: Don't patch `session`, `Model.query`, or SQLAlchemy operations
- **Don't skip tests**: If mocking is too complex, use integration approach with real data instead
- **Use test markers**: `@pytest.mark.integration`, `@pytest.mark.validation` for categorization
