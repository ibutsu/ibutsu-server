import packageJson from '../package.json';

export const VERSION = packageJson.version;
export const MONITOR_UPLOAD_TIMEOUT = 1 * 1000; // 1 second
export const ALERT_TIMEOUT = 5 * 1000; // 5 seconds
export const KNOWN_WIDGETS = [
  'jenkins-heatmap',
  'filter-heatmap',
  'run-aggregator',
  'result-summary',
  'result-aggregator',
  'jenkins-bar-chart',
  'jenkins-line-chart',
  'importance-component',
];
export const STRING_OPERATIONS = {
  eq: '=',
  ne: '!',
  in: '*',
  exists: '@',
  regex: '~',
};
export const NUMERIC_OPERATIONS = {
  eq: '=',
  ne: '!',
  gt: '>',
  lt: '<',
  gte: ')',
  lte: '(',
};
export const ARRAY_OPERATIONS = {
  eq: '=',
  exists: '@',
  in: '*',
};
export const OPERATIONS = { ...STRING_OPERATIONS, ...NUMERIC_OPERATIONS };
export const ARRAY_RESULT_FIELDS = ['metadata.tags', 'metadata.markers'];
export const NUMERIC_RESULT_FIELDS = [
  'duration',
  'metadata.durations.call',
  'metadata.durations.setup',
  'metadata.durations.teardown',
  'metadata.jenkins.build_number',
];
export const STRING_RESULT_FIELDS = [
  'env',
  'component',
  'run_id',
  'project_id',
  'metadata.assignee',
  'metadata.team',
  'metadata.caseautomation',
  'metadata.fspath',
  'metadata.jenkins.job_name',
  'metadata.id',
  'metadata.nodeid',
  'metadata.params',
  'metadata.project',
  'metadata.title',
  'metadata.endpoint',
  'params',
  'result',
  'source',
  'start_time', // TODO: handle this with a calendar widget?
  'test_id',
];
const RESULT_FIELDS = [
  ...NUMERIC_RESULT_FIELDS,
  ...STRING_RESULT_FIELDS,
  ...ARRAY_RESULT_FIELDS,
];
const SRF = [...RESULT_FIELDS].sort();
export { SRF as RESULT_FIELDS };

export const ARRAY_RUN_FIELDS = ['metadata.tags'];
export const NUMERIC_RUN_FIELDS = [
  'duration',
  'summary.errors',
  'summary.failures',
  'summary.skips',
  'summary.xfailures',
  'summary.xpasses',
  'summary.tests',
];
export const STRING_RUN_FIELDS = ['id', 'component', 'env', 'source'];
const RUN_FIELDS = [
  ...NUMERIC_RUN_FIELDS,
  ...STRING_RUN_FIELDS,
  ...ARRAY_RUN_FIELDS,
];
const SRUF = [...RUN_FIELDS].sort();
export { SRUF as RUN_FIELDS };

export const STRING_ACCESSIBILITY_FIELDS = [
  'run_id',
  'summary',
  'source',
  'env',
];
export const NUMERIC_ACCESSIBILITY_FIELDS = ['start_time'];
export const ACCESSIBILITY_FIELDS = [
  ...STRING_ACCESSIBILITY_FIELDS,
  ...NUMERIC_ACCESSIBILITY_FIELDS,
];
export const STRING_JJV_FIELDS = ['job_name', 'source', 'build_number', 'env'];
export const NUMERIC_JJV_FIELDS = ['start_time'];
export const JJV_FIELDS = [...STRING_JJV_FIELDS, ...NUMERIC_JJV_FIELDS];

export const STRING_USER_FIELDS = [
  {
    value: 'name',
    children: 'Display Name',
  },
  {
    value: 'email',
    children: 'Email Address',
  },
];

export const USER_COLUMNS = {
  name: 'Display Name',
  email: 'Email',
  projects: 'Projects',
  status: 'Status',
  edit: 'Edit Action',
  delete: 'Delete Action',
};

export const CLASSIFICATION = {
  dependency_outage: 'Dependency Outage',
  environment_failure: 'Environment Failure',
  product_failure: 'Product Failure',
  product_rfe: 'Product RFE', // sometimes tests are skipped because functionality is not yet present
  test_failure: 'Test Failure',
  unknown: 'Unknown',
};
export const HEATMAP_MAX_BUILDS = 40;

export const THEME_KEY = 'theme';

export const WEEKS = {
  '1 Week': 0.25,
  '2 Weeks': 0.5,
  '1 Month': 1.0,
  '2 Months': 2.0,
  '3 Months': 3.0,
  '5 Months': 5.0,
};

export const RESULT_STATES = {
  passed: 'passes',
  failed: 'failures',
  error: 'errors',
  skipped: 'skips',
  xfailed: 'xfailures',
  xpassed: 'xpasses',
};

export const RUN_RESULTS_COLUMNS = [
  'Test',
  'Result',
  'Duration',
  'Run',
  'Started',
];
