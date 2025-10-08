/* eslint-env jest */
import { render } from '@testing-library/react';

// Import all utility functions from their respective modules
import {
  toTitleCase,
  processPyTestPath,
  convertDate,
  cleanPath,
} from './strings';

import {
  filtersToAPIParams,
  filtersToSearchParams,
  parseSearchToFilter,
  parseFilterValueToSearch,
  parseFilter,
  apiParamsToFilters,
  getOperationsFromField,
} from './filters';

import { buildBadge, exceptionToBadge } from './badges';

import { projectToOption, dashboardToOption } from './projects';

import { getDarkTheme, setDocumentDarkTheme } from './themes';

import { tableSortFunctions } from './tables';

// Test constants
const TEST_PATHS = {
  SITE_PACKAGES: 'python3.7/lib/site-packages/my_package/tests/test_ui.py',
  RELATIVE_UP: '../../my_package/tests/test_ui.py',
  RELATIVE_MIXED: 'my_package/../tests/test_ui.py',
  STANDARD: 'my_package/tests/test_ui.py',
};

const TEST_NAMES = {
  URLS: 'test_urls',
};

const TEST_PARAMS = {
  NORMAL: '[hostname]',
  PATH: '[api/object/method]',
};

// Mock constants
jest.mock('../constants', () => ({
  OPERATIONS: {
    eq: { opChar: '=' },
    ne: { opChar: '!' },
    gt: { opChar: '>' },
    gte: { opChar: ')' },
    lt: { opChar: '<' },
    lte: { opChar: '(' },
    regex: { opChar: '~' },
  },
  ARRAY_OPERATIONS: {
    eq: { opChar: '=' },
    in: { opChar: '*' },
    exists: { opChar: '@' },
  },
  STRING_OPERATIONS: {
    eq: { opChar: '=' },
    ne: { opChar: '!' },
    in: { opChar: '*' },
    exists: { opChar: '@' },
    regex: { opChar: '~' },
  },
  NUMERIC_OPERATIONS: {
    eq: { opChar: '=' },
    ne: { opChar: '!' },
    gt: { opChar: '>' },
    gte: { opChar: ')' },
    lt: { opChar: '<' },
    lte: { opChar: '(' },
  },
  ARRAY_RESULT_FIELDS: [{ value: 'tags' }],
  ARRAY_RUN_FIELDS: [{ value: 'metadata.tags' }],
  STRING_RESULT_FIELDS: [{ value: 'test_id' }],
  STRING_RUN_FIELDS: [{ value: 'component' }],
  STRING_JJV_FIELDS: ['env'],
  NUMERIC_RESULT_FIELDS: [{ value: 'duration' }],
  NUMERIC_RUN_FIELDS: [{ value: 'duration' }],
  NUMERIC_JJV_FIELDS: ['build_number'],
  THEME_KEY: 'theme',
  ICON_RESULT_MAP: {
    passed: '✓',
    failed: '✗',
    error: '!',
    skipped: '-',
  },
  MISSING_META_EXCEPTION: 'No exception data',
}));

describe('String Utilities', () => {
  describe('toTitleCase', () => {
    it('should convert words to title case', () => {
      expect(toTitleCase('this is a title')).toEqual('This Is A Title');
    });

    it('should handle empty strings', () => {
      expect(toTitleCase('')).toEqual('');
      expect(toTitleCase(null)).toEqual(null);
      expect(toTitleCase(undefined)).toEqual(undefined);
    });

    it('should convert underscores to spaces when convertToSpace is true', () => {
      expect(toTitleCase('test_case_name', true)).toEqual('Test Case Name');
    });

    it('should not convert underscores when convertToSpace is false', () => {
      expect(toTitleCase('test_case_name', false)).toEqual('Test_case_name');
    });
  });

  describe('cleanPath', () => {
    it('should remove anything before "site-packages"', () => {
      expect(cleanPath(TEST_PATHS.SITE_PACKAGES)).toEqual(
        'my_package/tests/test_ui.py',
      );
    });

    it('should remove any portions of the path with ".." before the rest of the path', () => {
      expect(cleanPath(TEST_PATHS.RELATIVE_UP)).toEqual(
        'my_package/tests/test_ui.py',
      );
    });

    it('should not remove any portions of the path with ".." anywhere else', () => {
      expect(cleanPath(TEST_PATHS.RELATIVE_MIXED)).toEqual(
        'my_package/../tests/test_ui.py',
      );
    });

    it('should return "Tests" for null or undefined paths', () => {
      expect(cleanPath(null)).toEqual('Tests');
      expect(cleanPath(undefined)).toEqual('Tests');
      expect(cleanPath('')).toEqual('Tests');
    });
  });

  describe('processPyTestPath', () => {
    it('should correctly parse a path without parameters', () => {
      const PATH_TO_PROCESS = [TEST_PATHS.STANDARD, TEST_NAMES.URLS].join('/');
      const EXPECTED_PATH = ['my_package', 'tests', 'test_ui.py', 'test_urls'];
      expect(processPyTestPath(PATH_TO_PROCESS)).toEqual(EXPECTED_PATH);
    });

    it('should correctly parse a path with a normal parameter', () => {
      const PATH_TO_PROCESS =
        [TEST_PATHS.STANDARD, TEST_NAMES.URLS].join('/') + TEST_PARAMS.NORMAL;
      const EXPECTED_PATH = [
        'my_package',
        'tests',
        'test_ui.py',
        'test_urls[hostname]',
      ];
      expect(processPyTestPath(PATH_TO_PROCESS)).toEqual(EXPECTED_PATH);
    });

    it('should correctly parse a path with a path parameter', () => {
      const PATH_TO_PROCESS =
        [TEST_PATHS.STANDARD, TEST_NAMES.URLS].join('/') + TEST_PARAMS.PATH;
      const EXPECTED_PATH = [
        'my_package',
        'tests',
        'test_ui.py',
        'test_urls[api/object/method]',
      ];
      expect(processPyTestPath(PATH_TO_PROCESS)).toEqual(EXPECTED_PATH);
    });

    it('should handle paths starting with /', () => {
      const PATH_TO_PROCESS =
        '/' + [TEST_PATHS.STANDARD, TEST_NAMES.URLS].join('/');
      const EXPECTED_PATH = ['my_package', 'tests', 'test_ui.py', 'test_urls'];
      expect(processPyTestPath(PATH_TO_PROCESS)).toEqual(EXPECTED_PATH);
    });

    it('should handle single segment paths', () => {
      expect(processPyTestPath('test_single')).toEqual(['test_single']);
    });
  });

  describe('convertDate', () => {
    it('should convert seconds to formatted duration string', () => {
      expect(convertDate(90061)).toEqual('[1 day, 01:01:01]'); // 86400 + 3600 + 60 + 1
      expect(convertDate(3661)).toEqual('[01:01:01]'); // 3600 + 60 + 1
      expect(convertDate(3600)).toEqual('[01:00:00]');
      expect(convertDate(61)).toEqual('[00:01:01]');
      expect(convertDate(1)).toEqual('[00:00:01]');
    });

    it('should handle multiple days', () => {
      expect(convertDate(172800)).toEqual('[2 days, 00:00:00]');
    });

    it('should handle zero seconds', () => {
      expect(convertDate(0)).toEqual('[00:00:00]');
    });
  });
});

describe('Filter Utilities', () => {
  describe('filtersToAPIParams', () => {
    it('should convert filters to API parameter format', () => {
      const filters = [
        { field: 'test_id', operator: 'eq', value: 'test1' },
        { field: 'result', operator: 'ne', value: 'failed' },
      ];
      expect(filtersToAPIParams(filters)).toEqual([
        'test_id=test1',
        'result!failed',
      ]);
    });

    it('should return empty array for empty filters', () => {
      expect(filtersToAPIParams([])).toEqual([]);
      expect(filtersToAPIParams()).toEqual([]);
    });

    it('should handle unknown operators with fallback', () => {
      const filters = [
        { field: 'test_id', operator: 'unknown', value: 'test1' },
      ];
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      expect(filtersToAPIParams(filters)).toEqual(['test_id=test1']);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('filtersToSearchParams', () => {
    it('should convert filters to URLSearchParams format', () => {
      const filters = [
        { field: 'test_id', operator: 'eq', value: 'test1' },
        { field: 'result', operator: 'ne', value: 'failed' },
      ];
      const result = filtersToSearchParams(filters);
      expect(result.get('test_id')).toEqual('[eq]test1');
      expect(result.get('result')).toEqual('[ne]failed');
    });

    it('should return empty URLSearchParams for empty filters', () => {
      const result = filtersToSearchParams([]);
      expect(result.toString()).toEqual('');
    });
  });

  describe('parseSearchToFilter', () => {
    it('should parse search param tuple to filter object', () => {
      const tuple = ['test_id', '[eq]test1'];
      expect(parseSearchToFilter(tuple)).toEqual({
        field: 'test_id',
        operator: 'eq',
        value: 'test1',
      });
    });

    it('should return default object for invalid format', () => {
      const tuple = ['test_id', 'invalid'];
      expect(parseSearchToFilter(tuple)).toEqual({
        field: 'test_id',
        operator: 'eq',
        value: 'invalid',
      });
    });
  });

  describe('parseFilterValueToSearch', () => {
    it('should format filter to search value', () => {
      const filter = { operator: 'eq', value: 'test1' };
      expect(parseFilterValueToSearch(filter)).toEqual('[eq]test1');
    });
  });

  describe('parseFilter', () => {
    it('should parse parameter key with operator', () => {
      expect(parseFilter('test_id[eq]')).toEqual({
        key: 'test_id',
        operator: 'eq',
      });
    });

    it('should default to eq operator when no operator specified', () => {
      expect(parseFilter('test_id')).toEqual({
        key: 'test_id',
        operator: 'eq',
      });
    });
  });

  describe('apiParamsToFilters', () => {
    it('should convert API filter string to filter objects', () => {
      const filterString = 'test_id=test1,result!failed';
      expect(apiParamsToFilters(filterString)).toEqual([
        { field: 'test_id', operator: 'eq', value: 'test1' },
        { field: 'result', operator: 'ne', value: 'failed' },
      ]);
    });

    it('should handle multi-character operators', () => {
      const filterString = 'duration)100,count(50';
      expect(apiParamsToFilters(filterString)).toEqual([
        { field: 'duration', operator: 'gte', value: '100' },
        { field: 'count', operator: 'lte', value: '50' },
      ]);
    });

    it('should return empty array for invalid input', () => {
      expect(apiParamsToFilters('')).toEqual([]);
      expect(apiParamsToFilters(null)).toEqual([]);
      expect(apiParamsToFilters(123)).toEqual([]);
    });
  });

  describe('getOperationsFromField', () => {
    it('should return array operations for array fields', () => {
      expect(getOperationsFromField('tags')).toEqual({
        eq: { opChar: '=' },
        in: { opChar: '*' },
        exists: { opChar: '@' },
      });
    });

    it('should return string operations for string fields', () => {
      expect(getOperationsFromField('test_id')).toEqual({
        eq: { opChar: '=' },
        ne: { opChar: '!' },
        in: { opChar: '*' },
        exists: { opChar: '@' },
        regex: { opChar: '~' },
      });
    });

    it('should return numeric operations for numeric fields', () => {
      expect(getOperationsFromField('duration')).toEqual({
        eq: { opChar: '=' },
        ne: { opChar: '!' },
        gt: { opChar: '>' },
        gte: { opChar: ')' },
        lt: { opChar: '<' },
        lte: { opChar: '(' },
      });
    });
  });
});

describe('UI Utilities', () => {
  describe('buildBadge', () => {
    it('should create a simple badge', () => {
      const badge = buildBadge('test-key', 'test-value', false);
      const { container } = render(badge);
      expect(container.querySelector('.pf-v6-c-badge')).toBeTruthy();
    });

    it('should create a clickable badge when onClick is provided', () => {
      const onClick = jest.fn();
      const badge = buildBadge('test-key', 'test-value', false, onClick);
      const { container } = render(badge);
      expect(container.querySelector('button')).toBeTruthy();
    });

    it('should handle null/undefined values', () => {
      const badge1 = buildBadge('test-key', null, false);
      const badge2 = buildBadge('test-key', undefined, false);
      const { container: container1 } = render(badge1);
      const { container: container2 } = render(badge2);
      expect(container1.textContent).toContain('N/A');
      expect(container2.textContent).toContain('N/A');
    });

    it('should handle object values by stringifying them', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const badge = buildBadge('test-key', { test: 'object' }, false);
      const { container } = render(badge);
      expect(container.textContent).toContain('{"test":"object"}');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('exceptionToBadge', () => {
    it('should create badge with exception name', () => {
      const badge = exceptionToBadge('ValueError');
      const { container } = render(badge);
      expect(container.textContent).toContain('ValueError');
    });

    it('should use default exception when none provided', () => {
      const badge = exceptionToBadge();
      const { container } = render(badge);
      expect(container.textContent).toContain('No exception data');
    });

    it('should create clickable badge when filterFunc provided', () => {
      const filterFunc = jest.fn();
      const badge = exceptionToBadge('ValueError', filterFunc);
      const { container } = render(badge);
      expect(container.querySelector('button')).toBeTruthy();
    });
  });
});

describe('Data Utilities', () => {
  describe('projectToOption', () => {
    it('should convert project to option format', () => {
      const project = { id: '1', name: 'test-project', title: 'Test Project' };
      const option = projectToOption(project);
      expect(option.project).toEqual(project);
      expect(option.toString()).toEqual('Test Project');
    });

    it('should handle null project', () => {
      expect(projectToOption(null)).toEqual('');
    });

    it('should implement compareTo correctly', () => {
      const project = { id: '1', name: 'test-project', title: 'Test Project' };
      const option = projectToOption(project);

      // Compare with another project option
      const otherProject = {
        id: '1',
        name: 'test-project',
        title: 'Test Project',
      };
      expect(option.compareTo({ project: otherProject })).toBe(true);

      // Compare with string
      expect(option.compareTo('test')).toBe(true);
      expect(option.compareTo('Test')).toBe(true);
      expect(option.compareTo('nonexistent')).toBe(false);
    });
  });

  describe('dashboardToOption', () => {
    it('should convert dashboard to option format', () => {
      const dashboard = { id: '1', title: 'Test Dashboard' };
      const option = dashboardToOption(dashboard);
      expect(option.dashboard).toEqual(dashboard);
      expect(option.toString()).toEqual('Test Dashboard');
    });

    it('should handle null dashboard', () => {
      expect(dashboardToOption(null)).toEqual('');
    });

    it('should implement compareTo correctly', () => {
      const dashboard = { id: '1', title: 'Test Dashboard' };
      const option = dashboardToOption(dashboard);

      // Compare with another dashboard option
      const otherDashboard = { id: '1', title: 'Test Dashboard' };
      expect(option.compareTo({ dashboard: otherDashboard })).toBe(true);

      // Compare with string
      expect(option.compareTo('test')).toBe(true);
      expect(option.compareTo('Dashboard')).toBe(true);
      expect(option.compareTo('nonexistent')).toBe(false);
    });
  });
});

describe('Theme Utilities', () => {
  beforeEach(() => {
    // Clear localStorage and reset DOM
    localStorage.clear();
    document.firstElementChild.classList.remove('pf-v6-theme-dark');
  });

  describe('getDarkTheme', () => {
    it('should return theme from localStorage when available', () => {
      localStorage.setItem('theme', 'dark');
      expect(getDarkTheme()).toBe(true);

      localStorage.setItem('theme', 'light');
      expect(getDarkTheme()).toBe(false);
    });

    it('should fallback to browser preference when localStorage is empty', () => {
      // Mock matchMedia
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
        })),
      });

      expect(getDarkTheme()).toBe(true);
    });
  });

  describe('setDocumentDarkTheme', () => {
    it('should set dark theme when true', () => {
      setDocumentDarkTheme(true);
      expect(localStorage.getItem('theme')).toBe('dark');
      expect(
        document.firstElementChild.classList.contains('pf-v6-theme-dark'),
      ).toBe(true);
    });

    it('should set light theme when false', () => {
      setDocumentDarkTheme(false);
      expect(localStorage.getItem('theme')).toBe('light');
      expect(
        document.firstElementChild.classList.contains('pf-v6-theme-dark'),
      ).toBe(false);
    });

    it('should use getDarkTheme when no theme provided', () => {
      localStorage.setItem('theme', 'dark');
      setDocumentDarkTheme();
      expect(
        document.firstElementChild.classList.contains('pf-v6-theme-dark'),
      ).toBe(true);
    });
  });
});

describe('Table Utilities', () => {
  describe('tableSortFunctions', () => {
    describe('duration', () => {
      it('should sort duration values correctly', () => {
        const rows = [
          { cells: ['test1', '120s'] },
          { cells: ['test2', '60s'] },
          { cells: ['test3', '180s'] },
        ];

        const sorted = rows.sort((a, b) =>
          tableSortFunctions.duration(a, b, 'asc', 1),
        );
        expect(sorted[0].cells[1]).toBe('60s');
        expect(sorted[2].cells[1]).toBe('180s');
      });

      it('should handle missing duration values', () => {
        const rows = [{ cells: ['test1', null] }, { cells: ['test2', '60s'] }];

        const sorted = rows.sort((a, b) =>
          tableSortFunctions.duration(a, b, 'asc', 1),
        );
        expect(sorted[0].cells[1]).toBe(null);
        expect(sorted[1].cells[1]).toBe('60s');
      });

      it('should sort in descending order', () => {
        const rows = [
          { cells: ['test1', '60s'] },
          { cells: ['test2', '180s'] },
        ];

        const sorted = rows.sort((a, b) =>
          tableSortFunctions.duration(a, b, 'desc', 1),
        );
        expect(sorted[0].cells[1]).toBe('180s');
        expect(sorted[1].cells[1]).toBe('60s');
      });
    });

    describe('started', () => {
      it('should sort date values correctly', () => {
        const rows = [
          { cells: ['test1', '1/2/2023, 10:00:00 AM'] },
          { cells: ['test2', '1/1/2023, 10:00:00 AM'] },
          { cells: ['test3', '1/3/2023, 10:00:00 AM'] },
        ];

        const sorted = rows.sort((a, b) =>
          tableSortFunctions.started(a, b, 'asc', 1),
        );
        expect(sorted[0].cells[1]).toBe('1/1/2023, 10:00:00 AM');
        expect(sorted[2].cells[1]).toBe('1/3/2023, 10:00:00 AM');
      });

      it('should handle invalid date values', () => {
        const rows = [
          { cells: ['test1', 'invalid-date'] },
          { cells: ['test2', '1/1/2023, 10:00:00 AM'] },
        ];

        const sorted = rows.sort((a, b) =>
          tableSortFunctions.started(a, b, 'asc', 1),
        );
        expect(sorted[0].cells[1]).toBe('invalid-date');
        expect(sorted[1].cells[1]).toBe('1/1/2023, 10:00:00 AM');
      });

      it('should handle null date values', () => {
        const rows = [
          { cells: ['test1', null] },
          { cells: ['test2', '1/1/2023, 10:00:00 AM'] },
        ];

        const sorted = rows.sort((a, b) =>
          tableSortFunctions.started(a, b, 'asc', 1),
        );
        expect(sorted[0].cells[1]).toBe(null);
        expect(sorted[1].cells[1]).toBe('1/1/2023, 10:00:00 AM');
      });
    });
  });
});
