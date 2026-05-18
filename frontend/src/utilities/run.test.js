import { getRunPassPercent } from './run';

describe('getRunPassPercent', () => {
  it('should return N/A when summary is null or undefined', () => {
    expect(getRunPassPercent(null)).toBe('N/A');
    expect(getRunPassPercent(undefined)).toBe('N/A');
  });

  it('should return 0 when summary has no tests, matching backend semantics', () => {
    expect(getRunPassPercent({})).toBe('0');
    expect(getRunPassPercent({ tests: 0 })).toBe('0');
  });

  it('should return stored pass_percent when available', () => {
    expect(getRunPassPercent({ tests: 100, pass_percent: 95 })).toBe('95');
    expect(getRunPassPercent({ tests: 100, pass_percent: 0 })).toBe('0');
  });

  it('should calculate pass_percent from passes when pass_percent is missing', () => {
    const summary = { tests: 100, passes: 80, failures: 20 };
    expect(getRunPassPercent(summary)).toBe('80');
  });

  it('should derive passes from counters when passes is missing', () => {
    const summary = {
      tests: 100,
      failures: 10,
      errors: 5,
      skips: 5,
      xpasses: 0,
    };
    expect(getRunPassPercent(summary)).toBe('80');
  });

  it('should subtract xfailures when deriving passes from counters', () => {
    // 100 tests - 10 failures - 5 xfailures = 85 passes -> 85
    const summary = { tests: 100, failures: 10, xfailures: 5 };
    expect(getRunPassPercent(summary)).toBe('85');
  });

  it('should subtract both xpasses and xfailures when deriving passes', () => {
    // 100 tests - 10 failures - 5 errors - 5 skips - 3 xpasses - 7 xfailures = 70 passes -> 70
    const summary = {
      tests: 100,
      failures: 10,
      errors: 5,
      skips: 5,
      xpasses: 3,
      xfailures: 7,
    };
    expect(getRunPassPercent(summary)).toBe('70');
  });

  it('should treat missing xfailures as 0 when deriving passes', () => {
    // xfailures absent — should behave identically to xfailures: 0
    const withXfailures = { tests: 100, failures: 10, xfailures: 0 };
    const withoutXfailures = { tests: 100, failures: 10 };
    expect(getRunPassPercent(withXfailures)).toBe(
      getRunPassPercent(withoutXfailures),
    );
  });

  it('should floor the percentage instead of rounding', () => {
    const summary = { tests: 1000, passes: 999, failures: 1 };
    expect(getRunPassPercent(summary)).toBe('99');
  });

  it('should floor at boundary values', () => {
    const summary = { tests: 3, passes: 1, failures: 2 };
    // 1/3 * 100 = 33.33... -> floor = 33
    expect(getRunPassPercent(summary)).toBe('33');
  });

  it('should return 100 when all tests pass', () => {
    const summary = { tests: 500, passes: 500 };
    expect(getRunPassPercent(summary)).toBe('100');
  });

  it('should clamp to 100 when passes exceeds tests in a malformed summary', () => {
    const summary = { tests: 10, passes: 15 };
    expect(getRunPassPercent(summary)).toBe('100');
  });

  it('should clamp to 0 when derived counters exceed tests in a malformed summary', () => {
    // 10 tests - 4 failures - 4 errors - 2 skips - 1 xpass - 1 xfailure = -2 derived passes
    const summary = {
      tests: 10,
      failures: 4,
      errors: 4,
      skips: 2,
      xpasses: 1,
      xfailures: 1,
    };
    expect(getRunPassPercent(summary)).toBe('0');
  });
});
