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
import ResultAggregateApex from './result-aggregate-apex';

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

describe('ResultAggregateApex real chart rendering', () => {
  let consoleError;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ consoleError } = setupRealApexCharts());
    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => [
        { _id: 'passed', count: 45 },
        { _id: 'failed', count: 5 },
        { _id: 'error', count: 2 },
      ],
    });
    HttpClient.handleResponse.mockImplementation((response) => response.json());
  });

  afterEach(teardownRealApexCharts);

  it('draws one donut slice per aggregated group', async () => {
    const { container } = render(
      <ResultAggregateApex
        title="Aggregate"
        params={{ project: 'test-project' }}
        days={7}
        groupField="result"
      />,
    );

    await expectApexChartRendered(container, {
      shapeSelector: '.apexcharts-pie-area',
      expectedShapes: 3,
      consoleError,
    });
  });
});
