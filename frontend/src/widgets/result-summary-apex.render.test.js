// Renders the real widget against the real apexcharts and react-apexcharts
// packages (chart entry points are intentionally NOT mocked) so apexcharts
// upgrades that break chart registration or rendering are caught. Only the
// HTTP layer is mocked.
import { render } from '@testing-library/react';

import {
  expectApexChartRendered,
  setupRealApexCharts,
  teardownRealApexCharts,
} from '../test-utils';
import { HttpClient } from '../utilities/http';
import ResultSummaryApex from './result-summary-apex';

vi.mock('../utilities/http', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    HttpClient: { get: vi.fn(), handleResponse: vi.fn() },
  };
});

vi.mock('../pages/settings', () => ({
  Settings: { serverUrl: 'http://localhost:8080/api' },
}));

describe('ResultSummaryApex real chart rendering', () => {
  let consoleError;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ consoleError } = setupRealApexCharts());
    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => ({
        passed: 10,
        failed: 3,
        error: 1,
        skipped: 2,
        total: 16,
      }),
    });
    HttpClient.handleResponse.mockImplementation((response) => response.json());
  });

  afterEach(teardownRealApexCharts);

  it('draws one donut slice per non-zero result type', async () => {
    const { container } = render(
      <ResultSummaryApex
        title="Summary"
        params={{ project: 'test-project' }}
      />,
    );

    await expectApexChartRendered(container, {
      shapeSelector: '.apexcharts-pie-area',
      expectedShapes: 4,
      consoleError,
    });
  });
});
