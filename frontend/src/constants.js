import packageJson from '../package.json';

import {
  CheckCircleIcon,
  ChevronCircleRightIcon,
  ClockIcon,
  ExclamationCircleIcon,
  InfoAltIcon,
  QuestionCircleIcon,
  TimesCircleIcon,
  FlagIcon,
} from '@patternfly/react-icons';

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
  eq: { opChar: '=', opString: 'equals' },
  ne: { opChar: '!', opString: 'not equals' },
  in: { opChar: '*', opString: 'contains' },
  exists: { opChar: '@', opString: 'exists' },
  regex: { opChar: '~', opString: 'matches regex' },
};
export const NUMERIC_OPERATIONS = {
  eq: { opChar: '=', opString: 'equals' },
  ne: { opChar: '!', opString: 'not equals' },
  gt: { opChar: '>', opString: 'greater than' },
  lt: { opChar: '<', opString: 'less than' },
  gte: { opChar: ')', opString: 'greater than or equal' },
  lte: { opChar: '(', opString: 'less than or equal' },
};
export const ARRAY_OPERATIONS = {
  eq: { opChar: '=', opString: 'equals' },
  exists: { opChar: '@', opString: 'exists' },
  in: { opChar: '*', opString: 'contains' },
};
export const OPERATIONS = { ...STRING_OPERATIONS, ...NUMERIC_OPERATIONS };

// TODO create groups of these for presentation layer SelectGroup
export const ARRAY_RESULT_FIELDS = [
  { value: 'metadata.markers', children: 'Metadata Markers' },
];

export const NUMERIC_RESULT_FIELDS = [
  { value: 'duration', children: 'Duration' },
  {
    value: 'metadata.jenkins.build_number',
    children: 'Metadata Jenkins Build Number',
  },
];

export const STRING_RESULT_FIELDS = [
  { value: 'env', children: 'Environment' },
  { value: 'component', children: 'Component' },
  { value: 'run_id', children: 'Run ID' },
  { value: 'params', children: 'Params' },
  { value: 'result', children: 'Result' },
  { value: 'source', children: 'Source' },
  { value: 'start_time', children: 'Start Time' },
  { value: 'test_id', children: 'Test ID' },
  { value: 'metadata.assignee', children: 'Metadata Assignee' },
  {
    value: 'metadata.automation_status',
    children: 'Metadata Automation Status',
  },
  { value: 'metadata.team', children: 'Metadata Team' },
  { value: 'metadata.caseautomation', children: 'Metadata Case Automation' },
  { value: 'metadata.jenkins.job_name', children: 'Metadata Jenkins Job Name' },
  { value: 'metadata.importance', children: 'Metadata Importance' },
  { value: 'metadata.interface_type', children: 'Metadata Interface Type' },
  { value: 'metadata.project', children: 'Metadata Project' },
  { value: 'metadata.title', children: 'Metadata Title' },
  { value: 'metadata.endpoint', children: 'Metadata Endpoint' },
  { value: 'metadata.exception_name', children: 'Metadata Exception Name' },
];

const RESULT_FIELDS = [
  ...NUMERIC_RESULT_FIELDS,
  ...STRING_RESULT_FIELDS,
  ...ARRAY_RESULT_FIELDS,
];

const SRF = [...RESULT_FIELDS].sort((a, b) => a.value.localeCompare(b.value));
export { SRF as RESULT_FIELDS };

export const ARRAY_RUN_FIELDS = [
  { value: 'metadata.tags', children: 'Metadata Tags' },
];

export const NUMERIC_RUN_FIELDS = [
  { value: 'duration', children: 'Duration' },
  { value: 'summary.errors', children: 'Summary Error Count' },
  { value: 'summary.failures', children: 'Summary Failure Count' },
  { value: 'summary.skips', children: 'Summary Skip Count' },
  { value: 'summary.xfailures', children: 'Summary Xfailure Count' },
  { value: 'summary.xpasses', children: 'Summary Xpasses Count' },
  { value: 'summary.tests', children: 'Summary Total Count' },
];

export const STRING_RUN_FIELDS = [
  { value: 'id', children: 'ID' },
  { value: 'component', children: 'Component' },
  { value: 'env', children: 'Env' },
  { value: 'source', children: 'Source' },
];

const RUN_FIELDS = [
  ...NUMERIC_RUN_FIELDS,
  ...STRING_RUN_FIELDS,
  ...ARRAY_RUN_FIELDS,
];

const SRUF = [...RUN_FIELDS].sort((a, b) => a.value.localeCompare(b.value));
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

// TODO more user filtering on active and admin
export const STRING_USER_FIELDS = [
  { value: 'name', children: 'Name' },
  { value: 'email', children: 'Email' },
];

export const USER_COLUMNS = {
  name: 'Display Name',
  email: 'Email',
  projects: 'Projects',
  status: 'Status',
  edit: 'Edit Action',
  delete: 'Delete Action',
};

// TODO more project filtering on owner and title
export const STRING_PROJECT_FIELDS = [{ value: 'name', children: 'Name' }];

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
  manual: 'manual',
};

export const RUN_RESULTS_COLUMNS = [
  'Test',
  'Result',
  'Duration',
  'Run',
  'Started',
];

export const CHART_COLOR_MAP = {
  passed: 'var(--pf-t--chart--color--green--100)',
  failed: 'var(--pf-t--chart--color--red-orange--300)',
  error: 'var(--pf-t--chart--color--orange--300)',
  skipped: 'var(--pf-t--chart--color--yellow--300)',
  xfailed: 'var(--pf-t--chart--color--purple--200)',
  xpassed: 'var(--pf-t--chart--color--blue--100)',
  manual: 'var(--pf-t--chart--color--cyan--500)',
  default: 'var(--pf-t--chart--color--black--100)',
};

export const FILE_IMPORT_KEY = 'importFile';

export const ICON_RESULT_MAP = {
  passed: <CheckCircleIcon style={{ color: CHART_COLOR_MAP.passed }} />,
  failed: <TimesCircleIcon style={{ color: CHART_COLOR_MAP.failed }} />,
  error: <ExclamationCircleIcon style={{ color: CHART_COLOR_MAP.error }} />,
  skipped: (
    <ChevronCircleRightIcon style={{ color: CHART_COLOR_MAP.skipped }} />
  ),
  xfailed: <CheckCircleIcon style={{ color: CHART_COLOR_MAP.xfailed }} />,
  xpassed: <TimesCircleIcon style={{ color: CHART_COLOR_MAP.xpassed }} />,
  manual: <FlagIcon style={{ color: CHART_COLOR_MAP.manual }} />,
  pending: <QuestionCircleIcon style={{ color: CHART_COLOR_MAP.skipped }} />,
};

export const ICON_STATUS_MAP = {
  done: <CheckCircleIcon />,
  pending: <QuestionCircleIcon />,
  running: <ClockIcon />,
  error: <ExclamationCircleIcon />,
  empty: <InfoAltIcon />,
};
