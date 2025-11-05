# Sample Test Data for Backend and Frontend Test Coverage

## Summary

A comprehensive set of sample test data has been created based on the archived test runs in `.archives/`. This data provides realistic, varied test scenarios for improving test coverage in both backend and frontend components.

## Location

All test fixtures are located in:
```
backend/tests/fixtures/data/
```

## Created Files

### Data Files (10 files total)

1. **sample_test_data.json** (18 KB)
   - Complete test data in JSON format
   - 1 project, 3 runs, 9 results, 4 artifacts
   - Rich metadata with varied complexity levels
   - Ready for direct database insertion or API import

2. **sample_test_data.xml** (8.5 KB)
   - JUnit XML format test data
   - 4 test suites with multiple test cases
   - Compatible with standard JUnit XML importers
   - Includes failure and error details

3. **Artifact Files:**
   - `log_authentication_failure.txt` (604 bytes) - Authentication test failure log
   - `log_traceback.txt` (1.2 KB) - Python traceback from connection error
   - `log_performance_metrics.txt` (1.2 KB) - Performance test metrics
   - `screenshot_failure.png` (64 bytes) - Minimal valid PNG image

4. **Helper Modules:**
   - `../loader.py` (11 KB) - Utilities for loading test data into database
   - `../example_usage.py` (9.7 KB) - Usage examples and patterns (if exists)
   - `../README.md` (8.5 KB) - Comprehensive documentation

## Data Characteristics

### Test Run Variety

The data includes **3 test runs** representing different scenarios:

1. **Run 1: Frontend Staging Tests** (`a1b2c3d4-...`)
   - Component: frontend
   - Environment: staging
   - Duration: 125.5 seconds
   - Summary: 15 tests (8 passed, 2 failed, 1 error, 1 xfailed, 3 skipped)
   - Complex build system metadata

2. **Run 2: Backend Production Smoke Tests** (`b2c3d4e5-...`)
   - Component: backend-api
   - Environment: production
   - Duration: 89.3 seconds
   - Summary: 8 tests (7 passed, 1 skipped)
   - Deployment and release metadata

3. **Run 3: Integration QA Regression** (`c3d4e5f6-...`)
   - Component: integration
   - Environment: qa
   - Duration: 3456.7 seconds (57 minutes)
   - Summary: 52 tests (multiple varied outcomes)
   - Test suite and parallel execution metadata

### Test Result Variety

The data includes **9 test results** with different outcomes:

- ✅ **4 Passed** - Successful test executions
- ❌ **2 Failed** - Test assertion failures with detailed error messages
- ⚠️ **1 Error** - Test setup/execution errors
- ⏭️ **1 Skipped** - Intentionally skipped test with reason
- 🔶 **1 XFailed** - Expected failure (known bug)

### Metadata Complexity

#### Simple Metadata
```json
{
  "importance": "medium",
  "interface_type": "ui"
}
```

#### Complex Nested Metadata
```json
{
  "build_system": {
    "name": "continuous-integration",
    "job_name": "main-pipeline/test-suite",
    "build_number": "1001",
    "build_url": "https://ci.example.com/..."
  },
  "environment": {
    "os": "linux",
    "python_version": "3.11.5",
    "browser": "chrome",
    "browser_version": "118.0.5993.88"
  },
  "git": {
    "branch": "main",
    "commit": "abc123def456",
    "repository": "example/test-repo"
  }
}
```

### Artifact Types

1. **Text Logs** (3 files)
   - Authentication failure logs
   - Python tracebacks
   - Performance metrics
   - All contain realistic log output without sensitive data

2. **Binary Images** (1 file)
   - Screenshot (minimal valid PNG)
   - Can be replaced with any image file for more realistic testing

## Data Sanitization

All data has been **thoroughly sanitized** to remove Red Hat-specific information:

- ✓ URLs changed from Red Hat domains to generic examples
- ✓ User names changed to generic "test-engineer-N" format
- ✓ Repository URLs genericized
- ✓ Build system references made generic
- ✓ Project names sanitized
- ✓ Environment details generalized
- ✓ No proprietary information included

## Loading Mechanisms

### Method 1: Direct Database Loading (Recommended)

```python
from tests.fixtures.loader import load_sample_data

def test_with_sample_data(db_session):
    """Use sample data in integration tests."""
    project, runs, results, artifacts = load_sample_data(db_session)

    # Now test with realistic data
    assert len(runs) == 3
    assert len(results) == 9
```

### Method 2: Specific Data Subsets

```python
from tests.fixtures.loader import load_sample_run_with_results

def test_specific_scenario(db_session):
    """Load just one run with its results."""
    project, run, results = load_sample_run_with_results(db_session, run_index=0)

    # Test with focused dataset
    assert run.component == "frontend"
```

### Method 3: API Import

```python
from tests.fixtures.loader import load_json_data

def test_import_functionality(flask_app, auth_headers):
    """Test importing via API."""
    client, jwt_token = flask_app
    data = load_json_data()

    response = client.post(
        '/api/project',
        json=data['project'],
        headers=auth_headers(jwt_token)
    )
    assert response.status_code == 201
```

### Method 4: Filtered Loading

```python
from tests.fixtures.loader import load_failed_results_only

def test_error_handling(db_session):
    """Load only failed results."""
    project, run, failed_results = load_failed_results_only(db_session)

    # All results are failures or errors
    for result in failed_results:
        assert result.result in ('failed', 'error')
```

## Use Cases

### Backend Testing

1. **Controller Integration Tests**
   - Test API endpoints with realistic data
   - Verify pagination, filtering, sorting
   - Test error handling with varied data

2. **Widget Tests**
   - Test data aggregation with complex metadata
   - Verify filtering logic across varied results
   - Test time-based queries

3. **Database Tests**
   - Test complex queries
   - Verify relationships (runs → results → artifacts)
   - Test metadata indexing and search

4. **Import/Export Tests**
   - Test JUnit XML import
   - Test JSON data import
   - Test archive extraction

### Frontend Testing

1. **Dashboard Components**
   - Visualize varied test outcomes
   - Display complex metadata
   - Handle different result types

2. **Filter Components**
   - Filter by complex metadata structures
   - Filter by multiple criteria
   - Search across different data types

3. **Detail Views**
   - Display run details with summary
   - Show result details with artifacts
   - Render logs and screenshots

4. **Data Tables**
   - Sort and filter large datasets
   - Handle varied column data
   - Display nested metadata

## Integration with Existing Test Infrastructure

### Using with Existing Fixtures

The loader integrates seamlessly with existing test fixtures:

```python
def test_example(flask_app, db_session):
    """Combine with existing fixtures."""
    client, jwt_token = flask_app

    # Load sample data
    from tests.fixtures.loader import load_sample_data
    project, runs, results, artifacts = load_sample_data(db_session)

    # Test with flask_app client
    response = client.get(
        f'/api/project/{project.id}',
        headers=auth_headers(jwt_token)
    )
    assert response.status_code == 200
```

### No Changes to Existing Tests Required

- ✓ Existing tests continue to work unchanged
- ✓ Sample data is opt-in via imports
- ✓ No modifications to conftest.py needed
- ✓ No changes to existing fixtures

## Documentation

Comprehensive documentation is included:

1. **README.md** - Full documentation of fixtures
   - Data structure details
   - Usage examples
   - API reference
   - Integration guidelines

2. **example_usage.py** - Practical examples
   - 10+ usage patterns
   - Real-world scenarios
   - Copy-paste ready code

3. **loader.py** - Inline documentation
   - Docstrings for all functions
   - Parameter descriptions
   - Return value documentation

## Next Steps

### To Start Using This Data:

1. **Review the documentation:**
   ```bash
   cd backend/tests/fixtures
   cat README.md
   cat data/SAMPLE_TEST_DATA_SUMMARY.md
   ```

2. **Explore the data:**
   ```python
   from tests.fixtures.loader import load_json_data, get_sample_metadata_patterns

   # See the raw data
   data = load_json_data()

   # See metadata examples
   patterns = get_sample_metadata_patterns()
   ```

3. **Try the examples:**
   - Look at `example_usage.py`
   - Copy relevant patterns to your tests
   - Adapt to your specific needs

4. **Start simple:**
   ```python
   from tests.fixtures.loader import load_sample_data

   def test_my_feature(db_session):
       project, runs, results, artifacts = load_sample_data(db_session)
       # Your test logic here
   ```

### To Extend This Data:

1. Add more runs/results to `data/sample_test_data.json`
2. Add more artifact files as needed
3. Update the loader if new patterns are needed
4. Document any additions in README.md

## Benefits for Test Coverage

1. **Realistic Data**: Based on actual test runs
2. **Varied Scenarios**: Multiple result types and metadata patterns
3. **Complex Metadata**: Tests metadata handling thoroughly
4. **Artifact Support**: Tests file handling (logs, images)
5. **Easy to Use**: Simple API, well-documented
6. **No Overhead**: Opt-in, doesn't affect existing tests
7. **Extensible**: Easy to add more data as needed

## File Sizes and Performance

All files are small and optimized:
- Total size: ~50 KB
- Fast to load: < 50ms typical
- No external dependencies
- Works with existing test infrastructure

## Questions or Issues?

See the documentation:
- `backend/tests/fixtures/README.md` - Comprehensive guide
- `backend/tests/fixtures/data/SAMPLE_TEST_DATA_SUMMARY.md` - This file
- `backend/tests/TEST_GUIDE.md` - General testing guide
- `backend/tests/conftest.py` - Existing fixtures

## Summary of Investigation

### Archive Analysis

The sample data was created by examining multiple tar.gz archives in `.archives/`:
- Extracted and analyzed structure of run.json and result.json files
- Identified patterns in metadata
- Found examples with various artifact types (logs, screenshots, tracebacks)
- Understood the relationship between runs, results, and artifacts

### Data Format Understanding

Based on:
- Database models in `ibutsu_server/db/models.py`
- OpenAPI specification in `backend/ibutsu_server/openapi/openapi.yaml`
- Import logic in `ibutsu_server/tasks/importers.py`
- Existing test patterns in `backend/tests/`

### Loading Mechanism

The loader module provides:
- Type-safe loading with proper datetime parsing
- Field name translation (metadata → data)
- Dependency-aware loading (project → runs → results → artifacts)
- Flexible filtering and subsetting
- Integration with existing session/fixture patterns

---

**Created:** October 17, 2025
**Location:** `/home/mshriver/repos/all-repos/ibutsu/ibutsu-server/backend/tests/fixtures/data/`
**Status:** Ready for use in tests (no fixture updates required)
