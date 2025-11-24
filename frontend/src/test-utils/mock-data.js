// Mock data factories for frontend tests
// Inspired by backend fixtures/database.py and fixtures/loader.py

import {
  TEST_UUIDS,
  TEST_TIMESTAMPS,
  TEST_RESULTS,
  TEST_COMPONENTS,
  TEST_ENVIRONMENTS,
  TEST_METADATA,
  TEST_PAGINATION,
  WIDGET_TYPES,
} from './constants';

/**
 * Global counters for generating unique test IDs/emails.
 *
 * NOTE:
 * - These counters must be reset between tests (via `resetTestCounters()`).
 * - To avoid cross-test leakage and order-dependent expectations, ensure
 *   `resetTestCounters()` is called from a global `beforeEach` in your
 *   Jest setup file (e.g. `setupTests.js`).
 */
let testIdCounter = 0;
let emailCounter = 0;

/**
 * Create a mock project
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock project object
 */
export function createMockProject(overrides = {}) {
  return {
    id: TEST_UUIDS.PROJECT_1,
    name: 'sample-test-project',
    title: 'Sample Test Project',
    ...overrides,
  };
}

/**
 * Create a mock run
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock run object
 */
export function createMockRun(overrides = {}) {
  return {
    id: TEST_UUIDS.RUN_1,
    component: TEST_COMPONENTS.FRONTEND,
    env: TEST_ENVIRONMENTS.STAGING,
    project_id: TEST_UUIDS.PROJECT_1,
    source: 'ci-pipeline-main-build-1001',
    start_time: TEST_TIMESTAMPS.RUN_START_1,
    duration: 125.5,
    metadata: {
      project: 'sample-project',
      build_system: {
        name: 'continuous-integration',
        job_name: 'main-pipeline/test-suite',
        build_number: '1001',
        build_url: 'https://ci.example.com/job/main-pipeline/test-suite/1001/',
      },
      environment: {
        os: 'linux',
        python_version: '3.11.5',
        browser: 'chrome',
        browser_version: '118.0.5993.88',
      },
      git: {
        branch: 'main',
        commit: 'abc123def456',
        repository: 'example/test-repo',
      },
    },
    summary: {
      failures: 2,
      errors: 1,
      xfailures: 1,
      xpasses: 0,
      skips: 3,
      tests: 15,
      collected: 15,
      not_run: 0,
    },
    ...overrides,
  };
}

/**
 * Create a mock result
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock result object
 */
export function createMockResult(overrides = {}) {
  testIdCounter++;
  return {
    id: TEST_UUIDS.RESULT_1,
    test_id: `test.example.module.test_function_${testIdCounter}`,
    component: TEST_COMPONENTS.FRONTEND,
    env: TEST_ENVIRONMENTS.STAGING,
    result: TEST_RESULTS.PASSED,
    run_id: TEST_UUIDS.RUN_1,
    project_id: TEST_UUIDS.PROJECT_1,
    source: 'ci-pipeline-main-build-1001',
    start_time: TEST_TIMESTAMPS.RESULT_START_1,
    duration: 1.234,
    metadata: {
      file: 'tests/test_module.py',
      markers: ['smoke', 'ui'],
      importance: 'medium',
      phase_durations: {
        setup: 0.1,
        call: 1.0,
        teardown: 0.134,
      },
    },
    params: {},
    ...overrides,
  };
}

/**
 * Create a mock failed result with error details
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock failed result object
 */
export function createMockFailedResult(overrides = {}) {
  return createMockResult({
    id: TEST_UUIDS.RESULT_2,
    test_id: `test.example.module.test_failed_${testIdCounter + 1}`,
    result: TEST_RESULTS.FAILED,
    metadata: {
      file: 'tests/test_module.py',
      markers: ['critical'],
      importance: 'high',
      phase_durations: {
        setup: 0.1,
        call: 0.5,
        teardown: 0.05,
      },
      error: {
        type: 'AssertionError',
        message: 'Expected 200 but got 404',
        traceback:
          'Traceback (most recent call last):\n  File "tests/test_module.py", line 42\n    assert response.status_code == 200\nAssertionError: Expected 200 but got 404',
      },
    },
    ...overrides,
  });
}

/**
 * Create a mock artifact
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock artifact object
 */
export function createMockArtifact(overrides = {}) {
  return {
    id: TEST_UUIDS.ARTIFACT_1,
    result_id: TEST_UUIDS.RESULT_1,
    filename: 'test-log.txt',
    data: {
      contentType: 'text/plain',
      resultId: TEST_UUIDS.RESULT_1,
    },
    ...overrides,
  };
}

/**
 * Create a mock dashboard
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock dashboard object
 */
export function createMockDashboard(overrides = {}) {
  return {
    id: TEST_UUIDS.DASHBOARD_1,
    title: 'Test Dashboard',
    project_id: TEST_UUIDS.PROJECT_1,
    ...overrides,
  };
}

/**
 * Create a mock widget configuration
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock widget config object
 */
export function createMockWidgetConfig(overrides = {}) {
  return {
    id: TEST_UUIDS.WIDGET_1,
    widget: WIDGET_TYPES.RESULT_SUMMARY,
    type: 'widget',
    weight: 100,
    params: {
      project: TEST_UUIDS.PROJECT_1,
    },
    dashboard_id: TEST_UUIDS.DASHBOARD_1,
    project_id: TEST_UUIDS.PROJECT_1,
    ...overrides,
  };
}

/**
 * Create a mock user
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock user object
 */
export function createMockUser(overrides = {}) {
  emailCounter++;
  return {
    id: TEST_UUIDS.USER_1,
    name: 'Test User',
    email: `test-user-${emailCounter}@example.com`,
    is_active: true,
    is_superadmin: false,
    ...overrides,
  };
}

/**
 * Create a paginated API response
 * @param {Array} items - Items to include in response
 * @param {Object} paginationOverrides - Pagination overrides
 * @returns {Object} Paginated response object
 */
export function createPaginatedResponse(items, paginationOverrides = {}) {
  return {
    pagination: {
      page: TEST_PAGINATION.PAGE,
      pageSize: TEST_PAGINATION.PAGE_SIZE,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / TEST_PAGINATION.PAGE_SIZE),
      ...paginationOverrides,
    },
  };
}

/**
 * Create a mock runs response
 * @param {Array} runs - Runs to include
 * @param {Object} paginationOverrides - Pagination overrides
 * @returns {Object} Runs API response
 */
export function createMockRunsResponse(runs, paginationOverrides = {}) {
  return {
    runs,
    ...createPaginatedResponse(runs, paginationOverrides),
  };
}

/**
 * Create a mock results response
 * @param {Array} results - Results to include
 * @param {Object} paginationOverrides - Pagination overrides
 * @returns {Object} Results API response
 */
export function createMockResultsResponse(results, paginationOverrides = {}) {
  return {
    results,
    ...createPaginatedResponse(results, paginationOverrides),
  };
}

/**
 * Create a mock dashboards response
 * @param {Array} dashboards - Dashboards to include
 * @param {Object} paginationOverrides - Pagination overrides
 * @returns {Object} Dashboards API response
 */
export function createMockDashboardsResponse(
  dashboards,
  paginationOverrides = {},
) {
  return {
    dashboards,
    ...createPaginatedResponse(dashboards, paginationOverrides),
  };
}

/**
 * Create multiple mock runs with varied data
 * @param {number} count - Number of runs to create
 * @returns {Array} Array of mock runs
 */
export function createMultipleMockRuns(count = 3) {
  const runs = [];
  const components = [
    TEST_COMPONENTS.FRONTEND,
    TEST_COMPONENTS.BACKEND_API,
    TEST_COMPONENTS.INTEGRATION,
  ];
  const environments = [
    TEST_ENVIRONMENTS.STAGING,
    TEST_ENVIRONMENTS.PRODUCTION,
    TEST_ENVIRONMENTS.QA,
  ];

  for (let i = 0; i < count; i++) {
    runs.push(
      createMockRun({
        id: `${TEST_UUIDS.RUN_1.slice(0, -1)}${i}`,
        component: components[i % components.length],
        env: environments[i % environments.length],
        source: `ci-pipeline-build-${1001 + i}`,
        duration: 100 + i * 20,
        metadata: {
          ...TEST_METADATA.COMPLEX_BUILD,
          build_system: {
            ...TEST_METADATA.COMPLEX_BUILD.build_system,
            build_number: `${1001 + i}`,
          },
        },
        summary: {
          failures: i,
          errors: i > 0 ? 1 : 0,
          xfailures: 0,
          xpasses: 0,
          skips: i,
          tests: 10 + i * 5,
          collected: 10 + i * 5,
          not_run: 0,
        },
      }),
    );
  }

  return runs;
}

/**
 * Create multiple mock results with varied outcomes
 * @param {number} count - Number of results to create
 * @param {string} runId - Run ID to associate with
 * @returns {Array} Array of mock results
 */
export function createMultipleMockResults(count = 5, runId = TEST_UUIDS.RUN_1) {
  const results = [];
  const outcomes = [
    TEST_RESULTS.PASSED,
    TEST_RESULTS.PASSED,
    TEST_RESULTS.FAILED,
    TEST_RESULTS.ERROR,
    TEST_RESULTS.SKIPPED,
  ];

  for (let i = 0; i < count; i++) {
    const outcome = outcomes[i % outcomes.length];
    const isFailure =
      outcome === TEST_RESULTS.FAILED || outcome === TEST_RESULTS.ERROR;

    results.push(
      createMockResult({
        id: `${TEST_UUIDS.RESULT_1.slice(0, -1)}${i}`,
        test_id: `test.example.module.test_case_${i}`,
        result: outcome,
        run_id: runId,
        duration: 1.0 + i * 0.5,
        metadata: {
          file: `tests/test_module_${i}.py`,
          markers: isFailure ? ['critical'] : ['smoke'],
          importance: isFailure ? 'high' : 'medium',
          ...(isFailure && {
            error: {
              type:
                outcome === TEST_RESULTS.ERROR
                  ? 'ConnectionError'
                  : 'AssertionError',
              message:
                outcome === TEST_RESULTS.ERROR
                  ? 'Failed to connect to database'
                  : 'Assertion failed',
            },
          }),
        },
      }),
    );
  }

  return results;
}

/**
 * Create mock widget data for result summary
 * @returns {Object} Widget data
 */
export function createMockResultSummaryData() {
  return {
    passed: 45,
    failed: 3,
    error: 1,
    skipped: 5,
    xfailed: 1,
    xpassed: 0,
    total: 55,
  };
}

/**
 * Create mock widget data for run aggregator
 * @returns {Array} Widget data
 */
export function createMockRunAggregatorData() {
  return [
    { date: '2025-10-01', passed: 10, failed: 2, error: 0, skipped: 1 },
    { date: '2025-10-02', passed: 12, failed: 1, error: 0, skipped: 2 },
    { date: '2025-10-03', passed: 11, failed: 0, error: 1, skipped: 1 },
    { date: '2025-10-04', passed: 15, failed: 1, error: 0, skipped: 3 },
    { date: '2025-10-05', passed: 13, failed: 2, error: 0, skipped: 2 },
  ];
}

/**
 * Reset test counters
 */
export function resetTestCounters() {
  testIdCounter = 0;
  emailCounter = 0;
}
