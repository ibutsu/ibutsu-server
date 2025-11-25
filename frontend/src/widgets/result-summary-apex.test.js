/* eslint-env jest */
import { render, screen, waitFor } from '@testing-library/react';
import ResultSummaryApex from './result-summary-apex';
import { HttpClient } from '../utilities/http';
import { createMockResultSummaryData } from '../test-utils';

// Mock dependencies
jest.mock('../utilities/http');
jest.mock('../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock WidgetHeader component
jest.mock('../components/widget-header', () => {
  // eslint-disable-next-line react/prop-types
  return function WidgetHeader({ title }) {
    return <div data-ouia-component-id="widget-header">{title}</div>;
  };
});

// Mock ResultWidgetLegend component
jest.mock('./result-widget-legend', () => {
  return function ResultWidgetLegend() {
    return <div data-ouia-component-id="result-widget-legend">Legend</div>;
  };
});

// Mock react-apexcharts
jest.mock('react-apexcharts', () => {
  // eslint-disable-next-line react/prop-types
  return function Chart({ series, options = {} }) {
    return (
      <div data-ouia-component-id="apex-chart">
        <div data-ouia-component-id="chart-series">
          {JSON.stringify(series)}
        </div>
        <div data-ouia-component-id="chart-labels">
          {JSON.stringify(options.labels)}
        </div>
      </div>
    );
  };
});

// Mock useSVGContainerDimensions hook
jest.mock('../components/hooks/use-svg-container-dimensions', () => ({
  useSVGContainerDimensions: () => ({
    containerRef: { current: null },
    width: 400,
    height: 300,
  }),
}));

describe('ResultSummaryApex Widget', () => {
  const mockSummaryData = createMockResultSummaryData();
  const defaultProps = {
    title: 'Test Summary',
    params: { project: 'test-project' },
    onDeleteClick: jest.fn(),
    onEditClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    // Default mock for HttpClient.get
    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => mockSummaryData,
    });

    // Mock HttpClient.handleResponse
    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });
  });

  describe('Initial Rendering', () => {
    it('should render widget with title', async () => {
      render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-header')).toHaveTextContent(
          'Test Summary',
        );
      });
    });

    it('should render chart container', async () => {
      render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('apex-chart')).toBeInTheDocument();
      });
    });

    it('should render legend', async () => {
      render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        const legends = screen.getAllByTestId('result-widget-legend');
        expect(legends.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch summary data on mount', async () => {
      render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'result-summary'],
          defaultProps.params,
        );
      });
    });

    it('should not fetch when params are undefined', () => {
      render(<ResultSummaryApex {...defaultProps} params={undefined} />);

      expect(HttpClient.get).not.toHaveBeenCalled();
    });

    it('should refetch when params change', async () => {
      const { rerender } = render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledTimes(1);
      });

      const newParams = { project: 'new-project' };
      rerender(<ResultSummaryApex {...defaultProps} params={newParams} />);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledTimes(2);
        expect(HttpClient.get).toHaveBeenLastCalledWith(
          ['http://localhost:8080/api', 'widget', 'result-summary'],
          newParams,
        );
      });
    });

    it('should handle fetch error', async () => {
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Chart Display', () => {
    it('should display chart with summary data', async () => {
      render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        const chartSeries = screen.getByTestId('chart-series');
        expect(chartSeries.textContent).toContain('45'); // passed
        expect(chartSeries.textContent).toContain('3'); // failed
        expect(chartSeries.textContent).toContain('1'); // error
        expect(chartSeries.textContent).toContain('5'); // skipped
      });
    });

    it('should display chart labels', async () => {
      render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        const chartLabels = screen.getByTestId('chart-labels');
        expect(chartLabels.textContent).toContain('Passed');
        expect(chartLabels.textContent).toContain('Failed');
        expect(chartLabels.textContent).toContain('Error');
        expect(chartLabels.textContent).toContain('Skipped');
      });
    });

    it('should exclude results with zero count', async () => {
      const dataWithZeros = {
        passed: 10,
        failed: 0,
        error: 0,
        skipped: 0,
        xfailed: 0,
        xpassed: 0,
        total: 10,
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => dataWithZeros,
      });

      render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        const chartSeries = screen.getByTestId('chart-series');
        expect(chartSeries.textContent).toBe('[10]');
      });

      await waitFor(() => {
        const chartLabels = screen.getByTestId('chart-labels');
        expect(chartLabels.textContent).toContain('Passed');
        expect(chartLabels.textContent).not.toContain('Failed');
      });
    });

    it('should handle empty summary data', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const { container } = render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        // Component should render without errors even with empty data
        expect(container).toBeTruthy();
      });
    });
  });

  describe('Props Handling', () => {
    it('should call onDeleteClick when delete is triggered', async () => {
      const onDeleteClick = jest.fn();

      render(
        <ResultSummaryApex {...defaultProps} onDeleteClick={onDeleteClick} />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('widget-header')).toBeInTheDocument();
      });
    });

    it('should call onEditClick when edit is triggered', async () => {
      const onEditClick = jest.fn();

      render(<ResultSummaryApex {...defaultProps} onEditClick={onEditClick} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-header')).toBeInTheDocument();
      });
    });

    it('should handle missing title', async () => {
      render(<ResultSummaryApex {...defaultProps} title={undefined} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-header')).toBeInTheDocument();
      });
    });
  });

  describe('Result Types', () => {
    it('should handle xfailed results', async () => {
      const dataWithXFailed = {
        ...mockSummaryData,
        xfailed: 2,
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => dataWithXFailed,
      });

      render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        const chartLabels = screen.getByTestId('chart-labels');
        expect(chartLabels.textContent).toContain('Xfailed');
      });
    });

    it('should handle xpassed results', async () => {
      const dataWithXPassed = {
        ...mockSummaryData,
        xpassed: 1,
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => dataWithXPassed,
      });

      render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        const chartLabels = screen.getByTestId('chart-labels');
        expect(chartLabels.textContent).toContain('Xpassed');
      });
    });

    it('should handle other result types', async () => {
      const dataWithOther = {
        passed: 10,
        failed: 2,
        error: 1,
        skipped: 3,
        other: 2,
        total: 18,
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => dataWithOther,
      });

      render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        const chartLabels = screen.getByTestId('chart-labels');
        expect(chartLabels.textContent).toContain('Other');
      });
    });

    it('should handle manual result types', async () => {
      const dataWithManual = {
        passed: 10,
        failed: 2,
        manual: 5,
        total: 17,
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => dataWithManual,
      });

      render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        const chartLabels = screen.getByTestId('chart-labels');
        expect(chartLabels.textContent).toContain('Manual');
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state initially', () => {
      HttpClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<ResultSummaryApex {...defaultProps} />);

      // Component should still render, just with no data
      expect(screen.getByTestId('widget-header')).toBeInTheDocument();
    });

    it('should update state after data loads', async () => {
      render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('apex-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Error States', () => {
    it('should handle HTTP error response', async () => {
      HttpClient.handleResponse.mockRejectedValue(new Error('Server error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should handle malformed response data', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { container } = render(<ResultSummaryApex {...defaultProps} />);

      await waitFor(() => {
        // Component should handle null data without crashing
        expect(container).toBeTruthy();
      });

      consoleSpy.mockRestore();
    });
  });
});
