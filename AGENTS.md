## backend
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

## Frontend Testing Instructions
- Find the CI plan in the .github/workflows folder
- Use `yarn test` to execute tests and `yarn test:coverage` to include coverage from the frontend directory as the working directory
- Add or update tests for the code you change, even if nobody asked
- Do not make changes to cause tests to pass when a bug is identified by the test. Always first investigate for bugs in the tested application component
- Focus test coverage on behavior first, not implementation details
- Identify test coverage increases through parametrization or additional test cases before creating entirely new test files
- Examine and reuse existing test utilities before writing new ones
- Strive to resolve all warnings displayed during test execution. Prefer complete resolutions over suppressing warnings, and only suppress when the warning is coming from outside of ibutsu-server.

## Test ID Attribute Pattern
- **Always use `data-ouia-component-id`** for test selectors, not `data-testid`
- `setupTests.js` configures `testIdAttribute: 'data-ouia-component-id'` for PatternFly compatibility
- This means `getByTestId('my-element')` looks for `data-ouia-component-id="my-element"`
- For PatternFly components that support it, set the `ouiaId` prop
- For custom JSX elements, use `data-ouia-component-id` attribute directly

### PatternFly Components with `ouiaId` Support

Many PatternFly components support the `ouiaId` prop which automatically sets `data-ouia-component-id`.
Use `ouiaId` when available instead of manually setting `data-ouia-component-id`.

Look at installed patternfly components to determine whether `ouiaId` prop is supported.

For components without `ouiaId` support, use `data-ouia-component-id` directly only when necessary.

### Test Locator Strategy

**Prefer using `ouiaId` on parent components:**
```javascript
// Good: Use ouiaId on Card, locate CardBody relative to it
<Card ouiaId="test-card">
  <CardBody>Content</CardBody>
</Card>

// In tests:
const card = screen.getByTestId('test-card');
const cardBody = within(card).getByText('Content');
```

**Use `data-ouia-component-id` directly only when necessary:**
```javascript
// Use when you need a specific test locator and relative locators won't work
<CardBody data-ouia-component-id="special-card-body">
  <div>Complex content</div>
</CardBody>

// In tests:
expect(screen.getByTestId('special-card-body')).toBeInTheDocument();
```

### Examples

**PatternFly components with ouiaId prop:**
```javascript
<Card ouiaId="test-card">
  <CardBody>Content</CardBody>
</Card>

// In tests:
expect(screen.getByTestId('test-card')).toBeInTheDocument();
```

**Using relative locators from parent with ouiaId:**
```javascript
<Modal ouiaId="edit-modal">
  <ModalHeader>
    <Title>Edit Item</Title>
  </ModalHeader>
  <ModalBody>
    <TextInput ouiaId="item-name-input" />
  </ModalBody>
</Modal>

// In tests:
const modal = screen.getByTestId('edit-modal');
expect(modal).toBeInTheDocument();
expect(screen.getByTestId('item-name-input')).toBeInTheDocument();
```

**Custom components and JSX:**
```javascript
<div data-ouia-component-id="custom-widget">
  <span data-ouia-component-id="widget-title">Title</span>
</div>

// In tests:
expect(screen.getByTestId('custom-widget')).toBeInTheDocument();
```

**Mock components in tests:**
```javascript
jest.mock('../components/my-component', () => {
  return function MyComponent({ title }) {
    return <div data-ouia-component-id="my-component">{title}</div>;
  };
});
```

## Coverage Requirements
- **Target**: Maintain coverage thresholds defined in package.json jest configuration
- **Run**: `yarn test:coverage` to verify coverage
- Coverage reports generated in `coverage/` directory with `lcov.info` and HTML reports

## Available Test Utilities

**Mock data factories:** `createMockProject`, `createMockRun`, `createMockResult`, `createMockFailedResult`, `createMockArtifact`, `createMockDashboard`, `createMockWidgetConfig`, `createMockUser`

**Bulk data creators:** `createMultipleMockRuns`, `createMultipleMockResults`, `createMockJenkinsRun`, `createMultipleMockJenkinsRuns`

**Response builders:** `createPaginatedResponse`, `createMockRunsResponse`, `createMockResultsResponse`, `createMockDashboardsResponse`

**Render helpers:** `renderWithRouter`, `renderWithIbutsuContext`, `renderWithRouterAndContext`, `renderWithAllProviders`

**HTTP mocking:** `mockHttpClientResponses`, `createMockHttpClient`, `createMockResponse`, `createMockErrorResponse`

**Test environment:** `setupTestEnvironment`, `mockMatchMedia`, `mockConsoleMethods`, `createMockLocalStorage`

**Constants:** `TEST_UUIDS`, `TEST_TIMESTAMPS`, `TEST_RESULTS`, `TEST_COMPONENTS`, `TEST_ENVIRONMENTS`, `WIDGET_TYPES`

## Test Pattern Examples

### Using Mock Data Factories
```javascript
import { createMockProject, createMockRun, createMockResult } from '../test-utils';

test('displays run information', () => {
  const mockProject = createMockProject({ name: 'my-project' });
  const mockRun = createMockRun({
    project_id: mockProject.id,
    component: 'frontend'
  });
  // Use in test assertions
});
```

### Rendering with Context
```javascript
import { renderWithRouterAndContext } from '../test-utils';

test('component with context', () => {
  const { getByText } = renderWithRouterAndContext(
    <MyComponent />,
    {
      initialRoute: '/runs',
      contextValue: { primaryObject: createMockProject() }
    }
  );
  expect(getByText('Expected Text')).toBeInTheDocument();
});
```

### Mocking HTTP Responses
```javascript
import { mockHttpClientResponses, createMockRunsResponse } from '../test-utils';

beforeEach(() => {
  mockHttpClientResponses({
    '/run': createMockRunsResponse([createMockRun()]),
    '/project': createMockProject(),
  });
});
```

## Integration Testing Approach
- **Prefer integration tests over excessive mocking**: Use actual component rendering with proper context providers
- **Use mock data factories**: `createMockProject`, `createMockRun`, etc. instead of inline mock objects
- **Mock only external services**: HTTP calls, localStorage, browser APIs - not React components or utilities
- **Test user interactions**: Use `@testing-library/react` user-event and queries for realistic testing
- **Avoid implementation details**: Test behavior users see, not internal state or function calls

## Best Practices
- Use `screen` queries from `@testing-library/react` for better error messages
- Use `waitFor` for async operations and state updates
- Reset test counters automatically via `resetTestCounters()` in `setupTests.js`
- Prefer accessible queries (getByRole, getByLabelText) over test ID queries when possible
- When test IDs are needed, use `data-ouia-component-id` (see Test ID Attribute Pattern above)
- Clean up after tests - React Testing Library handles most cleanup automatically
- Use consistent mock UUIDs from `TEST_UUIDS` for predictable testing

## Common Test Patterns

### Testing Async Data Loading
```javascript
test('loads and displays data', async () => {
  mockHttpClientResponses({ '/data': mockData });
  render(<Component />);

  await waitFor(() => {
    expect(screen.getByText('Data Loaded')).toBeInTheDocument();
  });
});
```

### Testing User Interactions
```javascript
import { fireEvent } from '@testing-library/react';

test('handles button click', () => {
  const { getByRole } = render(<Component />);
  const button = getByRole('button', { name: /submit/i });

  fireEvent.click(button);

  expect(mockCallback).toHaveBeenCalled();
});
```

### Testing Forms
```javascript
test('validates form input', async () => {
  const { getByLabelText, getByText } = render(<Form />);

  const input = getByLabelText(/email/i);
  fireEvent.change(input, { target: { value: 'invalid' } });
  fireEvent.blur(input);

  await waitFor(() => {
    expect(getByText(/invalid email/i)).toBeInTheDocument();
  });
});
```

## Building Container Images
- Use podman to build container images from the backend or frontend directory as the build context
- Use git branch-based tag names for local image tags
- Execute builds from the appropriate directory (backend/ or frontend/) with `-f docker/Dockerfile.<name>` flag

### Frontend Build
From the `ibutsu-server/frontend` directory:
```bash
podman build -t ibutsu-frontend:<branch-name> -f docker/Dockerfile.frontend .
```

### Backend Builds
From the `ibutsu-server/backend` directory:

**Main backend API:**
```bash
podman build -t ibutsu-backend:<branch-name> -f docker/Dockerfile.backend .
```

**Celery worker:**
```bash
podman build -t ibutsu-worker:<branch-name> -f docker/Dockerfile.worker .
```

**Celery scheduler:**
```bash
podman build -t ibutsu-scheduler:<branch-name> -f docker/Dockerfile.scheduler .
```

**Flower monitoring:**
```bash
podman build -t ibutsu-flower:<branch-name> -f docker/Dockerfile.flower .
```

# general instructions
- Do not create summary documents in markdown, add to the RST in `docs`
- For linting, use `pre-commit run` to include all lint checks and auto fixes
- Automatically work to resolve failures in the pre-commit output
- Do not include excessive emoji in readme, contributing, and other documentation files




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

# Backend Testing Instructions
- Find the CI plan in the .github/workflows folder.
- Use `hatch run test` to execute tests and `hatch run test-cov` to include coverage from the backend directory as the working directory
- Pass arguments to pytest through `hatch run test -- <-arg>`
- Add or update tests for the code you change, even if nobody asked.
- Do not make changes to cause tests to pass when a bug is identified by the test. Always first investigate for bugs in the tested application component.
- Use full UUID strings for all `id` fields including `run_id` and `result_id` when mocking unless an invalid UUID is specifically being tested
- Focus test coverage on behavior first, not implementation details.
- Identify test coverage increases through parametrization of current test functions before creating new test functions
- Examine and reuse existing fixtures before writing new ones.

## Documentation Reference
- **Backend testing guide**: `docs/source/developer-guide/backend-testing.rst`
- Comprehensive guide with fixtures, patterns, SQLAlchemy 2.0 examples, and best practices

## Coverage Requirements
- **Target**: 80% line coverage for all modules
- **Run**: `hatch run test-cov` to verify coverage
- Coverage reports generated in `htmlcov/` and `coverage.xml`

## Available Test Fixtures
**Database builders:** `make_project`, `make_run`, `make_result`, `make_artifact`, `make_import`, `make_user`, `make_group`, `make_dashboard`, `make_widget_config`

**Composite hierarchies:** `artifact_test_hierarchy`, `result_test_hierarchy`, `widget_test_hierarchy`

**Widget test helpers:** `bulk_run_creator`, `bulk_result_creator`, `jenkins_run_factory`, `fixed_time`

**Core fixtures:** `flask_app`, `db_session`, `app_context`, `auth_headers`

## Parametrization Example
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

## Integration Testing Approach
- **Prefer integration tests over mocking**: Use `flask_app` fixture with real SQLite database operations
- **Use builder fixtures**: `make_project`, `make_run`, `make_result`, etc. instead of mocks
- **Mock only external services**: Celery tasks, Redis, external HTTP calls, email - not database operations
- **See backend-testing.rst**: Comprehensive guide at `docs/source/developer-guide/backend-testing.rst`
- **Avoid database mocking**: Don't patch `session`, `Model.query`, or SQLAlchemy operations
- **Don't skip tests**: If mocking is too complex, use integration approach with real data instead
- **Use test markers**: `@pytest.mark.integration`, `@pytest.mark.validation` for categorization
