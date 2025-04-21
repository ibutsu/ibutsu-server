import {
  CheckCircleIcon,
  ChevronCircleRightIcon,
  ClockIcon,
  ExclamationCircleIcon,
  InfoAltIcon,
  QuestionCircleIcon,
  TimesCircleIcon,
} from '@patternfly/react-icons';
import {
  cleanPath,
  getIconForResult,
  getIconForStatus,
  toTitleCase,
  processPyTestPath,
} from './utilities';

describe('getIconForResult', () => {
  it('should return a CheckCircleIcon for a passed result', () => {
    expect(getIconForResult('passed')).toEqual(<CheckCircleIcon />);
  });

  it('should return a TimesCircleIcon for a failed result', () => {
    expect(getIconForResult('failed')).toEqual(<TimesCircleIcon />);
  });

  it('should return a ExclamationCircleIcon for an error result', () => {
    expect(getIconForResult('error')).toEqual(<ExclamationCircleIcon />);
  });

  it('should return a ChevronCircleRightIcon for a skipped result', () => {
    expect(getIconForResult('skipped')).toEqual(<ChevronCircleRightIcon />);
  });
});

describe('getIconForStatus', () => {
  it('should return a CheckCircleIcon for a done status', () => {
    expect(getIconForStatus('done')).toEqual(<CheckCircleIcon />);
  });

  it('should return a QuestionCircleIcon for a pending status', () => {
    expect(getIconForStatus('pending')).toEqual(<QuestionCircleIcon />);
  });

  it('should return a ClockIcon for a running status', () => {
    expect(getIconForStatus('running')).toEqual(<ClockIcon />);
  });

  it('should return a ExclamationCircleIcon for an error status', () => {
    expect(getIconForStatus('error')).toEqual(<ExclamationCircleIcon />);
  });

  it('should return an InfoAltIcon for an empty status', () => {
    expect(getIconForStatus('empty')).toEqual(<InfoAltIcon />);
  });
});

describe('toTitleCase', () => {
  it('should convert words to title case', () => {
    expect(toTitleCase('this is a title')).toEqual('This Is A Title');
  });
});

describe('cleanPath', () => {
  it('should remove anything before "site-packages"', () => {
    const TEST_PATH = 'python3.7/lib/site-packages/my_package/tests/test_ui.py';
    expect(cleanPath(TEST_PATH)).toEqual('my_package/tests/test_ui.py');
  });

  it('should remove any portions of the path with ".." before the rest of the path', () => {
    const TEST_PATH = '../../my_package/tests/test_ui.py';
    expect(cleanPath(TEST_PATH)).toEqual('my_package/tests/test_ui.py');
  });

  it('should not remove any portions of the path with ".." anywhere else', () => {
    const TEST_PATH = 'my_package/../tests/test_ui.py';
    expect(cleanPath(TEST_PATH)).toEqual('my_package/../tests/test_ui.py');
  });
});

describe('processPyTestPath', () => {
  const TEST_NAME = 'test_urls';
  const TEST_PATH = 'my_package/tests/test_ui.py';
  const TEST_NORM_PARAM = '[hostname]';
  const TEST_PATH_PARAM = '[api/object/method]';

  it('should correctly parse a path without parameters', () => {
    const PATH_TO_PROCESS = [TEST_PATH, TEST_NAME].join('/');
    const EXPECTED_PATH = ['my_package', 'tests', 'test_ui.py', 'test_urls'];
    expect(processPyTestPath(PATH_TO_PROCESS)).toEqual(EXPECTED_PATH);
  });

  it('should correctly parse a path with a normal parameter', () => {
    const PATH_TO_PROCESS = [TEST_PATH, TEST_NAME].join('/') + TEST_NORM_PARAM;
    const EXPECTED_PATH = [
      'my_package',
      'tests',
      'test_ui.py',
      'test_urls[hostname]',
    ];
    expect(processPyTestPath(PATH_TO_PROCESS)).toEqual(EXPECTED_PATH);
  });

  it('should correctly parse a path with a path parameter', () => {
    const PATH_TO_PROCESS = [TEST_PATH, TEST_NAME].join('/') + TEST_PATH_PARAM;
    const EXPECTED_PATH = [
      'my_package',
      'tests',
      'test_ui.py',
      'test_urls[api/object/method]',
    ];
    expect(processPyTestPath(PATH_TO_PROCESS)).toEqual(EXPECTED_PATH);
  });
});
