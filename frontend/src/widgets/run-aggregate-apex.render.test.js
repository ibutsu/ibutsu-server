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
import RunAggregateApex from './run-aggregate-apex';

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

describe('RunAggregateApex real chart rendering', () => {
  let consoleError;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ consoleError } = setupRealApexCharts());
    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => ({
        passed: { frontend: 10, backend: 15 },
        failed: { frontend: 2, backend: 3 },
      }),
    });
    HttpClient.handleResponse.mockImplementation((response) => response.json());
  });

  afterEach(teardownRealApexCharts);

  it('draws a stacked bar per series and category', async () => {
    const { container } = render(
      <RunAggregateApex
        title="Runs"
        params={{ project: 'test-project', group_field: 'component', weeks: 1 }}
      />,
    );

    await expectApexChartRendered(container, {
      shapeSelector: '.apexcharts-bar-area',
      expectedShapes: 4,
      consoleError,
    });
  });
});
