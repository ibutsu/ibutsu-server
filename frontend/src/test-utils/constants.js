// Test constants for frontend tests
// Inspired by backend fixtures pattern

// Fixed UUIDs for consistent testing
export const TEST_UUIDS = {
  PROJECT_1: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  PROJECT_2: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',

  RUN_1: 'a1b2c3d4-1234-5678-9abc-def012345678',
  RUN_2: 'b2c3d4e5-2345-6789-0bcd-ef1234567890',
  RUN_3: 'c3d4e5f6-3456-7890-1cde-f23456789012',

  RESULT_1: 'd4e5f6a7-4567-8901-2def-345678901234',
  RESULT_2: 'e5f6a7b8-5678-9012-3ef0-456789012345',
  RESULT_3: 'f6a7b8c9-6789-0123-4f01-567890123456',
  RESULT_4: 'a7b8c9d0-7890-1234-5012-678901234567',
  RESULT_5: 'b8c9d0e1-8901-2345-6123-789012345678',

  DASHBOARD_1: '650e8400-e29b-41d4-a716-446655440001',
  DASHBOARD_2: '650e8400-e29b-41d4-a716-446655440002',

  WIDGET_1: '750e8400-e29b-41d4-a716-446655440001',
  WIDGET_2: '750e8400-e29b-41d4-a716-446655440002',

  ARTIFACT_1: '850e8400-e29b-41d4-a716-446655440001',
  ARTIFACT_2: '850e8400-e29b-41d4-a716-446655440002',

  USER_1: '950e8400-e29b-41d4-a716-446655440001',
  USER_2: '950e8400-e29b-41d4-a716-446655440002',
};

// Fixed timestamps for consistent testing
export const TEST_TIMESTAMPS = {
  RUN_START_1: '2025-10-01T10:00:00+00:00',
  RUN_START_2: '2025-10-05T14:30:00+00:00',
  RUN_START_3: '2025-10-10T02:00:00+00:00',

  RESULT_START_1: '2025-10-01T10:01:00+00:00',
  RESULT_START_2: '2025-10-01T10:02:00+00:00',
  RESULT_START_3: '2025-10-01T10:03:00+00:00',
};

// Test result outcomes
export const TEST_RESULTS = {
  PASSED: 'passed',
  FAILED: 'failed',
  ERROR: 'error',
  SKIPPED: 'skipped',
  XFAILED: 'xfailed',
  XPASSED: 'xpassed',
};

// Test components
export const TEST_COMPONENTS = {
  FRONTEND: 'frontend',
  BACKEND_API: 'backend-api',
  INTEGRATION: 'integration',
  DATABASE: 'database',
};

// Test environments
export const TEST_ENVIRONMENTS = {
  STAGING: 'staging',
  PRODUCTION: 'production',
  QA: 'qa',
  DEV: 'development',
};

// Common metadata patterns
export const TEST_METADATA = {
  SIMPLE: {
    importance: 'medium',
    interface_type: 'ui',
  },

  COMPLEX_BUILD: {
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

  WITH_ERROR: {
    importance: 'critical',
    interface_type: 'api',
    error: {
      type: 'AssertionError',
      message: 'Expected 200 but got 404',
    },
  },
};

// Widget types
export const WIDGET_TYPES = {
  RESULT_SUMMARY: 'result-summary',
  RUN_AGGREGATE: 'run-aggregator',
  JENKINS_HEATMAP: 'jenkins-heatmap',
  RESULT_AGGREGATE: 'result-aggregator',
  GENERIC_BAR: 'generic-bar',
  GENERIC_AREA: 'generic-area',
};

// API pagination defaults
export const TEST_PAGINATION = {
  PAGE: 1,
  PAGE_SIZE: 50,
  TOTAL_ITEMS: 100,
  TOTAL_PAGES: 2,
};

// Jenkins-specific metadata patterns
export const TEST_JENKINS_METADATA = {
  BASIC: {
    jenkins: {
      job_name: 'test-pipeline/main',
      build_number: '123',
      build_url: 'https://jenkins.example.com/job/test-pipeline/main/123/',
    },
  },

  WITH_PARAMS: {
    jenkins: {
      job_name: 'parameterized-job',
      build_number: '456',
      build_url: 'https://jenkins.example.com/job/parameterized-job/456/',
      parameters: {
        BRANCH: 'feature',
        ENV: 'staging',
      },
    },
  },

  FULL: {
    jenkins: {
      job_name: 'full-pipeline/integration-tests',
      build_number: '789',
      build_url:
        'https://jenkins.example.com/job/full-pipeline/integration-tests/789/',
      node: 'linux-agent-1',
      executor: '2',
      parameters: {
        BRANCH: 'main',
        ENV: 'production',
        DEBUG: 'false',
      },
    },
  },
};

// Multi-level nested metadata patterns
export const TEST_NESTED_METADATA = {
  DEEP: {
    level1: {
      level2: {
        level3: {
          value: 'deeply nested',
        },
      },
    },
  },

  WITH_ARRAYS: {
    markers: ['smoke', 'ui', 'critical'],
    phase_durations: {
      setup: 0.1,
      call: 1.5,
      teardown: 0.05,
    },
  },

  CLASSIFICATION: {
    classification: {
      category: 'flaky',
      confidence: 0.85,
      reason: 'timing-sensitive',
    },
  },

  ERROR_DETAILS: {
    error: {
      type: 'AssertionError',
      message: 'Expected 200 but got 404',
      traceback:
        'Traceback (most recent call last):\n  File "tests/test_api.py", line 42\n    assert response.status_code == 200\nAssertionError: 404 != 200',
    },
  },
};
