// Helpers for tests that render REAL ApexCharts (no mocks of apexcharts or
// react-apexcharts) in jsdom.
//
// Keep each such test in its own file: apexcharts chart types register
// themselves globally on import, so another widget importing the same entry
// point in the same test file would mask a missing import.
import { waitFor } from '@testing-library/react';

import { mockMatchMedia } from './test-helpers';

const LAYOUT = { width: 400, height: 300 };

/**
 * Prepare jsdom for real ApexCharts rendering. Call from beforeEach and pair
 * with `teardownRealApexCharts` in afterEach.
 *
 * jsdom performs no layout, so ApexCharts would measure a 0x0 canvas and draw
 * nothing; elements get a fixed size and SVG a bounding box. ResizeObserver
 * (required by ApexCharts) and matchMedia (used by getDarkTheme) are stubbed.
 *
 * @returns {{ consoleError: import('vitest').MockInstance }} console.error spy
 */
export function setupRealApexCharts() {
  const consoleError = vi.spyOn(console, 'error');

  mockMatchMedia(false);
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(
    LAYOUT.width,
  );
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(
    LAYOUT.height,
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(
    LAYOUT.width,
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
    LAYOUT.height,
  );
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    ...LAYOUT,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: LAYOUT.width,
    bottom: LAYOUT.height,
  });
  SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, ...LAYOUT });

  return { consoleError };
}

export function teardownRealApexCharts() {
  vi.restoreAllMocks();
  delete SVGElement.prototype.getBBox;
  delete global.ResizeObserver;
}

/**
 * Wait until ApexCharts has drawn `expectedShapes` elements matching
 * `shapeSelector` (e.g. donut slices or bars) and assert that nothing was
 * logged to console.error (ApexCharts reports unregistered chart types there).
 */
export async function expectApexChartRendered(
  container,
  { shapeSelector, expectedShapes, consoleError },
) {
  await waitFor(() => {
    expect(container.querySelector('svg.apexcharts-svg')).not.toBeNull();
    expect(container.querySelectorAll(shapeSelector)).toHaveLength(
      expectedShapes,
    );
  });

  const unexpected = consoleError.mock.calls.filter(
    ([message]) => !String(message).includes('not wrapped in act'),
  );
  expect(unexpected).toEqual([]);
}
