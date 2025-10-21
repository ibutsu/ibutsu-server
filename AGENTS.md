## backend
- Use `pre-commit run` to include all lint checks and auto fixes
- Automatically work to resolve failures in the pre-commit output
- Do not include excessive emoji in readme, contributing, and other documentation files
- Use pytest parametrization over subtests
- Suggest updates to pytest-ibutsu or the ibutsu-client-python when there are changes to the openAPI specification
- validate any changes to the openapi specification
- Suggest updates to backend controllers that align with modern implementation patterns

# frontend
- use yarn and yarn lint from the frontend directory as the working directory
- prefer the use of patternfly components
- use functional components and prefer patterns that leverage all available react hook patterns
- use strict react-hooks rules for exhaustive deps
- React imports are necessary for JSX


# general
- Do not create summary documents unless instructed to do so

## Testing instructions
- Find the CI plan in the .github/workflows folder.
- Use `hatch run test` to execute tests. `hatch run test-cov` to include coverage.
- Pass arguments to pytest through `hatch run test -- <-arg>`
- Add or update tests for the code you change, even if nobody asked.
- Do not make changse to cause tests to pass when a bug is identified by the test. Always first investigate for bugs in the tested application component.
- Use full UUID strings for all `id` fields including `run_id` and `result_id` when mocking unless an invalid UUID is specifically being tested

### Integration Testing Approach
- **Prefer integration tests over mocking**: Use `flask_app` fixture with real SQLite database operations
- **Use builder fixtures**: `make_project`, `make_run`, `make_result`, etc. instead of mocks
- **Mock only external services**: Celery tasks, Redis, external HTTP calls, email - not database operations
- **See TEST_GUIDE.md**: Comprehensive guide at `backend/tests/TEST_GUIDE.md` with examples and patterns
- **Avoid database mocking**: Don't patch `session`, `Model.query`, or SQLAlchemy operations
- **Don't skip tests**: If mocking is too complex, use integration approach with real data instead
