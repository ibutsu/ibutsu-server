import { tableSortFunctions } from './tables';

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
