# Test Fixtures - Sample Test Data

This directory contains comprehensive sample test data for use in backend and frontend test coverage. The data is based on real test run archives but has been sanitized and obfuscated to remove any sensitive information.

## Contents

### Data Files

1. **data/sample_test_data.json** - Complete test data in JSON format
   - 1 project
   - 3 runs with varied metadata
   - 9 results with different outcomes (passed, failed, error, skipped, xfailed)
   - 4 artifacts (3 log files, 1 screenshot)

2. **data/sample_test_data.xml** - JUnit XML format test data
   - 4 test suites
   - Multiple test cases with varied outcomes
   - Properties and metadata
   - Failure and error details

### Artifact Files

3. **data/log_authentication_failure.txt** - Sample authentication test failure log
4. **data/log_traceback.txt** - Sample Python traceback from connection error
5. **data/log_performance_metrics.txt** - Sample performance test metrics log
6. **data/screenshot_failure.png** - Minimal valid PNG image (16x16 pixels)

## Data Structure

### JSON Format Structure

```json
{
  "project": { ... },  // Single project definition
  "runs": [ ... ],     // Array of test runs
  "results": [ ... ],  // Array of test results
  "artifacts": [ ... ] // Array of artifact metadata
}
```

### Run Object Fields

- `id`: UUID identifier
- `component`: Component being tested (e.g., "frontend", "backend-api")
- `env`: Environment (e.g., "staging", "production", "qa")
- `project_id`: Associated project UUID
- `source`: Source identifier for the run
- `start_time`: ISO 8601 timestamp
- `duration`: Duration in seconds
- `metadata`: Complex nested metadata including:
  - Build system information
  - Environment details
  - Git information
  - Custom properties
- `summary`: Test execution summary with counts

### Result Object Fields

- `id`: UUID identifier
- `test_id`: Test identifier/name
- `component`: Component being tested
- `env`: Environment
- `result`: Outcome ("passed", "failed", "error", "skipped", "xfailed", "xpassed")
- `run_id`: Associated run UUID
- `project_id`: Associated project UUID
- `source`: Source identifier
- `start_time`: ISO 8601 timestamp
- `duration`: Duration in seconds
- `metadata`: Rich metadata including:
  - Test execution phases (setup, call, teardown)
  - Phase durations
  - File path
  - Test markers/tags
  - Assignee information
  - Importance level
  - Error details (for failures)
  - Custom properties
- `params`: Test parameters (if applicable)

### Artifact Object Fields

- `id`: UUID identifier
- `result_id`: Associated result UUID (optional)
- `run_id`: Associated run UUID (optional)
- `filename`: Artifact filename
- `content_type`: MIME type
- `content_reference`: Reference to actual file content

## Data Characteristics

### Variety of Test Outcomes

- **Passed**: Successful test execution
- **Failed**: Test assertion failures with detailed error messages
- **Error**: Test setup or execution errors
- **Skipped**: Intentionally skipped tests with reasons
- **XFailed**: Expected failures (known bugs)

### Metadata Complexity

#### Simple Metadata
Basic key-value pairs for straightforward tests:
```json
{
  "importance": "medium",
  "interface_type": "ui"
}
```

#### Complex Metadata
Nested structures with multiple levels:
```json
{
  "build_system": {
    "name": "continuous-integration",
    "job_name": "main-pipeline/test-suite",
    "build_number": "1001"
  },
  "environment": {
    "os": "linux",
    "python_version": "3.11.5"
  }
}
```

### Artifact Types

1. **Text Logs**: Test execution logs, tracebacks, performance metrics
2. **Binary Images**: Screenshots captured during test failures

## Usage in Tests

### Loading Data Programmatically

The test data can be loaded and used in tests in several ways:

#### Option 1: Direct JSON Loading

```python
import json
from pathlib import Path

def load_test_data():
    """Load sample test data from fixtures."""
    fixture_path = Path(__file__).parent / "fixtures" / "data" / "sample_test_data.json"
    with open(fixture_path) as f:
        return json.load(f)

def test_with_sample_data(db_session):
    """Example test using sample data."""
    data = load_test_data()

    # Create project
    from ibutsu_server.db.models import Project
    project_data = data["project"]
    project = Project(**project_data)
    db_session.add(project)
    db_session.commit()

    # Create runs and results
    # ... additional logic ...
```

#### Option 2: Using Builder Functions

```python
from tests.helpers import create_project_with_runs, create_run_with_results

def test_with_builders(db_session):
    """Create similar data using builder functions."""
    # The JSON data can serve as a reference for metadata structure
    project, runs = create_project_with_runs(
        db_session,
        num_runs=3,
        name='sample-test-project'
    )

    for run in runs:
        run.metadata = {
            "build_system": {
                "name": "continuous-integration",
                "job_name": "main-pipeline/test-suite"
            }
        }
```

#### Option 3: API Import

```python
def test_import_via_api(flask_app, auth_headers):
    """Test importing data via the API."""
    client, jwt_token = flask_app

    # Load test data
    data = load_test_data()

    # Import via API
    response = client.post(
        '/api/project',
        json=data['project'],
        headers=auth_headers(jwt_token)
    )
    assert response.status_code == 201
```

### Loading JUnit XML

The JUnit XML file can be imported using the existing import functionality:

```python
def test_junit_import(flask_app, auth_headers):
    """Test importing JUnit XML data."""
    client, jwt_token = flask_app

    fixture_path = Path(__file__).parent / "fixtures" / "data" / "sample_test_data.xml"
    with open(fixture_path, 'rb') as f:
        xml_content = f.read()

    # Import via API
    response = client.post(
        '/api/import',
        data={'file': (io.BytesIO(xml_content), 'test_data.xml')},
        headers=auth_headers(jwt_token)
    )
```

### Working with Artifacts

```python
def test_with_artifacts(flask_app, db_session):
    """Test with artifact data."""
    # Create result
    result = create_test_result(db_session)

    # Load artifact content
    log_path = Path(__file__).parent / "fixtures" / "data" / "log_authentication_failure.txt"
    with open(log_path, 'rb') as f:
        log_content = f.read()

    # Create artifact
    from ibutsu_server.db.models import Artifact
    artifact = Artifact(
        result_id=result.id,
        filename="test.log",
        content=log_content,
        data={"contentType": "text/plain"}
    )
    db_session.add(artifact)
    db_session.commit()
```

## Use Cases

### Backend Testing

- **Controller Tests**: Use the JSON data to test API endpoints
- **Widget Tests**: Test data aggregation and filtering with varied data
- **Import Tests**: Test import functionality with both JSON and XML formats
- **Database Tests**: Test complex queries across runs and results

### Frontend Testing

- **Dashboard Components**: Test visualization of varied test outcomes
- **Filter Components**: Test filtering with complex metadata
- **Detail Views**: Test display of results with artifacts
- **Import UI**: Test upload and import functionality

### Integration Testing

- **End-to-End Workflows**: Test complete data flow from import to display
- **Search and Filter**: Test search across varied metadata structures
- **Aggregation**: Test statistical calculations with realistic data
- **Export**: Test data export functionality

## Data Sanitization Notes

All data in these fixtures has been sanitized:

- **URLs**: Changed from actual Red Hat URLs to generic examples
- **User Names**: Changed to generic "test-engineer-N" format
- **Repository URLs**: Changed to generic "example/test-repo" format
- **Build Systems**: Changed from specific Jenkins URLs to generic CI URLs
- **Project Names**: Changed to "sample-project" or generic names
- **Environment Details**: Generalized while maintaining realistic structure

## Adding New Test Data

To add new test data to this collection:

1. Follow the existing JSON structure
2. Use valid UUIDs for all ID fields
3. Ensure metadata follows realistic patterns
4. Include varied test outcomes
5. Add corresponding artifact files if referenced
6. Update this README with any new patterns or use cases

## Related Documentation

- [TEST_GUIDE.md](../TEST_GUIDE.md) - Comprehensive testing guide
- [conftest.py](../conftest.py) - Test fixtures and helpers
- [helpers/db_builders.py](../helpers/db_builders.py) - Database builder functions
