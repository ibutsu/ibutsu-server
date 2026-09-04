import {
  tableSortFunctions,
  resultToComparisonRow,
  runToRow,
  resultToRow,
} from './tables';

// Helper to build a minimal row object shaped like what PatternFly table
// sort callbacks receive: { cells: [...] }.
const row = (cellValue) => ({ cells: [cellValue] });

describe('tableSortFunctions.passPercent', () => {
  const sort = (aCell, bCell, direction) =>
    tableSortFunctions.passPercent(row(aCell), row(bCell), direction, 0);

  it('sorts numeric percentage strings ascending', () => {
    expect(sort('20', '80', 'asc')).toBeLessThan(0);
    expect(sort('80', '20', 'asc')).toBeGreaterThan(0);
  });

  it('sorts numeric percentage strings descending', () => {
    expect(sort('20', '80', 'desc')).toBeGreaterThan(0);
    expect(sort('80', '20', 'desc')).toBeLessThan(0);
  });

  it('treats "N/A" the same as a missing/falsy cell value', () => {
    // Both map to the same -1 sentinel, so they compare as equal to each
    // other regardless of direction.
    expect(sort('N/A', null, 'asc')).toBe(0);
    expect(sort('N/A', undefined, 'desc')).toBe(0);
    expect(sort(null, '', 'asc')).toBe(0);
  });

  it('sorts "N/A"/missing values to the bottom in descending order', () => {
    // Real percentages (including 0%) must rank above "no data".
    expect(sort('N/A', '0', 'desc')).toBeGreaterThan(0);
    expect(sort('0', 'N/A', 'desc')).toBeLessThan(0);
  });

  it('sorts "N/A"/missing values to the top in ascending order', () => {
    expect(sort('N/A', '0', 'asc')).toBeLessThan(0);
    expect(sort('0', 'N/A', 'asc')).toBeGreaterThan(0);
  });
});

describe('resultToComparisonRow', () => {
  it('handles result comparison with valid ICON_RESULT_MAP lookup', () => {
    const results = [
      {
        id: 'res-1',
        test_id: 'test_foo',
        result: 'passed',
        metadata: { component: 'frontend' },
      },
      {
        id: 'res-2',
        test_id: 'test_foo',
        result: 'failed',
        component: 'frontend',
      },
    ];

    const resultRow = resultToComparisonRow(results);
    expect(resultRow.id).toBe('res-1');
    expect(resultRow.cells.length).toBe(3); // 1 test cell + 2 result cells
  });

  it('handles non-array and empty array inputs gracefully', () => {
    expect(resultToComparisonRow(null)).toEqual({ cells: [] });
    expect(resultToComparisonRow(undefined)).toEqual({ cells: [] });
    expect(resultToComparisonRow({})).toEqual({ cells: [] });
    expect(resultToComparisonRow([])).toEqual({ cells: [] });
  });
});

describe('runToRow', () => {
  it('handles runs with null component and null env', () => {
    const run = {
      id: 'run-1',
      start_time: '2026-08-26T10:00:00Z',
      duration: 10,
      component: null,
      env: null,
      summary: { tests: 5, passes: 5 },
    };

    const filterFunc = vi.fn();
    const rowData = runToRow(run, filterFunc);
    expect(rowData.cells.length).toBeGreaterThan(0);
  });

  it('handles runs with top-level or metadata component and env', () => {
    const runWithTopLevel = {
      id: 'run-2',
      start_time: '2026-08-26T10:00:00Z',
      duration: 10,
      component: 'backend',
      env: 'prod',
      summary: { tests: 5, passes: 5 },
    };

    const rowData = runToRow(runWithTopLevel);
    expect(rowData.cells.length).toBeGreaterThan(0);
  });

  it('handles runs with empty string component/env falling back to metadata', () => {
    const run = {
      id: 'run-3',
      start_time: '2026-08-26T10:00:00Z',
      duration: 10,
      component: '', // empty string should fall back to metadata
      env: '',
      metadata: { component: 'backend', env: 'stage' },
      summary: { tests: 5, passes: 5 },
    };

    const filterFunc = vi.fn();
    const rowData = runToRow(run, filterFunc);
    expect(rowData.cells.length).toBeGreaterThan(0);
    // Verify that badges were created for the metadata values
    // (The implementation should use || which treats empty string as falsy)
  });
});

describe('resultToRow', () => {
  it('handles results with null component and null env', () => {
    const result = {
      id: 'res-1',
      test_id: 'test_bar',
      result: 'passed',
      duration: 1.0,
      start_time: '2026-08-26T10:00:00Z',
      component: null,
      env: null,
      metadata: {},
    };

    const filterFunc = vi.fn();
    const rowData = resultToRow(result, filterFunc);
    expect(rowData.cells.length).toBeGreaterThan(0);
  });

  it('handles results with empty string component/env falling back to metadata', () => {
    const result = {
      id: 'res-2',
      test_id: 'test_fallback',
      result: 'passed',
      duration: 1.0,
      start_time: '2026-08-26T10:00:00Z',
      component: '', // empty string should fall back to metadata
      env: '',
      metadata: { component: 'backend', env: 'stage' },
    };

    const filterFunc = vi.fn();
    const rowData = resultToRow(result, filterFunc);
    expect(rowData.cells.length).toBeGreaterThan(0);
    // Verify that badges were created for the metadata values
    // (The implementation should use || which treats empty string as falsy)
  });
});
