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
    errorString.includes('When testing, code that causes React state updates should be wrapped into act')
  ) {
    return;
  }
  originalError.call(console, ...args);
};

console.warn = (...args) => {
  const warnString = args[0]?.toString() || '';
  if (
    warnString.includes('React Router Future Flag Warning') ||
    warnString.includes('⚠️')
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};

// Reset test counters before each test to avoid cross-test leakage
beforeEach(() => {
  resetTestCounters();
});
