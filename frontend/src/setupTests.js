// src/setupTests.js
import '../jest.polyfills.cjs';
import '@testing-library/jest-dom';
import { resetTestCounters } from './test-utils/mock-data';

// Suppress console errors from PatternFly Popper component
// These warnings are about internal PatternFly animations that use timers
// and don't indicate actual test issues. The Popper component updates its
// internal state for positioning after the initial render, which happens
// outside of our test's control.
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args) => {
  const errorString = args[0]?.toString() || '';
  if (
    // just ignore these warnings, not relevant to the test coverage broadly
    errorString.includes(
      'Warning: An update to Popper inside a test was not wrapped in act',
    ) ||
    errorString.includes(
      'Not implemented: HTMLFormElement.prototype.requestSubmit',
    ) ||
    errorString.includes(
      'When testing, code that causes React state updates should be wrapped into act',
    ) ||
    // Suppress React DOM property warnings (common in PatternFly components)
    errorString.includes('Warning: Invalid DOM property') ||
    errorString.includes('Did you mean `className`?') ||
    // Suppress other common React/testing warnings
    errorString.includes('Warning: ReactDOM.render') ||
    errorString.includes('Warning: useLayoutEffect') ||
    errorString.includes("Warning: Can't perform a React state update") ||
    // Suppress expected errors from test cases
    errorString.includes('Error fetching analysis view ID') ||
    errorString.includes('Widget config error') ||
    errorString.includes('No analysis view ID found')
  ) {
    return;
  }
  originalError.call(console, ...args);
};

console.warn = (...args) => {
  const warnString = args[0]?.toString() || '';
  if (
    warnString.includes('React Router Future Flag Warning') ||
    warnString.includes('⚠️') ||
    // Suppress common React/component warnings
    warnString.includes('componentWillReceiveProps') ||
    warnString.includes('componentWillMount') ||
    warnString.includes('findDOMNode')
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};

// Optionally suppress console.info and console.log during tests
// Uncomment these if you want to suppress all info/log messages
// const originalInfo = console.info;
// const originalLog = console.log;
// console.info = () => {};
// console.log = () => {};

// Reset test counters before each test to avoid cross-test leakage
beforeEach(() => {
  resetTestCounters();
});
