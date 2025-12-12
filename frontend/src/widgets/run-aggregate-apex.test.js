import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import RunAggregateApex from './run-aggregate-apex';
import { HttpClient } from '../utilities/http';

// Mock dependencies
jest.mock('../utilities/http');
jest.mock('../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock utilities
jest.mock('../utilities', () => ({
  getDarkTheme: jest.fn(() => false),
  toTitleCase: jest.fn((str) => str.charAt(0).toUpperCase() + str.slice(1)),
}));

// Mock ApexCharts
jest.mock('react-apexcharts', () => {
  const PropTypes = require('prop-types');
  const MockChart = ({ series, type, height }) => (
    <div
      data-ouia-component-id="apex-chart"
      data-type={type}
      data-height={height}
      data-series-count={series?.length || 0}
    >
      ApexCharts Mock
    </div>
  );
  MockChart.propTypes = {
    series: PropTypes.array,
    type: PropTypes.string,
    height: PropTypes.number,
  };
  return MockChart;
});

// Mock child components
jest.mock('../components/widget-header', () => {
  const PropTypes = require('prop-types');
  const MockWidgetHeader = ({ title, onEditClick, onDeleteClick }) => (
    <div data-ouia-component-id="widget-header">
      <span data-ouia-component-id="widget-title">{title}</span>
      {onEditClick && (
        <button data-ouia-component-id="edit-button" onClick={onEditClick}>
          Edit
        </button>
      )}
      {onDeleteClick && (
        <button data-ouia-component-id="delete-button" onClick={onDeleteClick}>
          Delete
        </button>
      )}
    </div>
  );
  MockWidgetHeader.propTypes = {
    title: PropTypes.string,
    onEditClick: PropTypes.func,
    onDeleteClick: PropTypes.func,
  };
  return MockWidgetHeader;
});

jest.mock('../components/param-dropdown', () => {
  const PropTypes = require('prop-types');
  const MockParamDropdown = ({
    dropdownItems,
    defaultValue,
    handleSelect,
    tooltip,
  }) => (
    <div data-ouia-component-id="param-dropdown" data-tooltip={tooltip}>
      <select
        data-ouia-component-id={`param-select-${tooltip?.replace(/[^a-z]/gi, '-')}`}
        value={defaultValue}
        onChange={(e) => handleSelect(e.target.value)}
      >
        {dropdownItems.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
  MockParamDropdown.propTypes = {
    dropdownItems: PropTypes.array,
    defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    handleSelect: PropTypes.func,
    tooltip: PropTypes.string,
  };
  return MockParamDropdown;
});

jest.mock('./result-widget-legend', () => {
  const PropTypes = require('prop-types');
  const MockLegend = ({ datum, x, y }) => (
    <g
      data-ouia-component-id={`legend-${datum.name}`}
      transform={`translate(${x},${y})`}
    >
      <text>{datum.name}</text>
    </g>
  );
  MockLegend.propTypes = {
    datum: PropTypes.object,
    x: PropTypes.number,
    y: PropTypes.number,
    style: PropTypes.object,
  };
  return MockLegend;
});

jest.mock('../components/hooks/use-svg-container-dimensions', () => ({
  useSVGContainerDimensions: () => ({
    containerRef: { current: null },
    width: 400,
  }),
}));

describe('RunAggregateApex', () => {
  const defaultParams = {
    project: 'test-project',
    group_field: 'component',
    weeks: 1,
  };

  const mockChartData = {
    passed: { frontend: 10, backend: 15 },
    failed: { frontend: 2, backend: 3 },
    error: { frontend: 1, backend: 0 },
    skipped: { frontend: 1, backend: 2 },
  };

  const renderComponent = (props = {}) => {
    return render(
      <RunAggregateApex
        title="Test Widget"
        params={defaultParams}
        {...props}
      />,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => mockChartData,
    });

    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });

    // Mock ResizeObserver
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  describe('Rendering', () => {
    it('should render the widget card', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('widget-header')).toBeInTheDocument();
      });
    });

    it('should render custom title', async () => {
      renderComponent({ title: 'Custom Widget Title' });

      await waitFor(() => {
        expect(screen.getByTestId('widget-title')).toHaveTextContent(
          'Custom Widget Title',
        );
      });
    });

    it('should render default title when not provided', async () => {
      renderComponent({ title: undefined });

      await waitFor(() => {
        expect(screen.getByTestId('widget-title')).toHaveTextContent(
          'Recent Run Results',
        );
      });
    });

    it('should render ApexCharts when data loaded', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('apex-chart')).toBeInTheDocument();
      });
    });

    it('should render param dropdowns', async () => {
      renderComponent();

      await waitFor(() => {
        const dropdowns = screen.getAllByTestId('param-dropdown');
        expect(dropdowns.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should show loading state initially', () => {
      renderComponent();

      expect(screen.getByText('Loading ...')).toBeInTheDocument();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch data on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'run-aggregator'],
          expect.objectContaining({
            project: 'test-project',
            group_field: 'component',
            weeks: 1,
          }),
        );
      });
    });

    it('should handle API error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      HttpClient.get.mockResolvedValue({
        ok: false,
        status: 400,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Widget Error')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should display error message for 400 response', async () => {
      HttpClient.get.mockResolvedValue({
        ok: false,
        status: 400,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/Bad request for widget data/i),
        ).toBeInTheDocument();
      });
    });

    it('should display error message for 500 response', async () => {
      HttpClient.get.mockResolvedValue({
        ok: false,
        status: 500,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/Backend error processing widget data/i),
        ).toBeInTheDocument();
      });
    });

    it('should handle fetch exception', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Widget Error')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching run aggregator data:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('User Interactions', () => {
    it('should call onEditClick when edit button clicked', async () => {
      const onEditClick = jest.fn();

      renderComponent({ onEditClick });

      await waitFor(() => {
        expect(screen.getByTestId('edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('edit-button'));

      expect(onEditClick).toHaveBeenCalled();
    });

    it('should call onDeleteClick when delete button clicked', async () => {
      const onDeleteClick = jest.fn();

      renderComponent({ onDeleteClick });

      await waitFor(() => {
        expect(screen.getByTestId('delete-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-button'));

      expect(onDeleteClick).toHaveBeenCalled();
    });

    it('should refetch data when group field changes', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('apex-chart')).toBeInTheDocument();
      });

      const initialCallCount = HttpClient.get.mock.calls.length;

      // Change group field
      const groupFieldSelect = screen.getByTestId(
        'param-select-Group-data-by-',
      );
      fireEvent.change(groupFieldSelect, { target: { value: 'env' } });

      await waitFor(() => {
        expect(HttpClient.get.mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });

    it('should refetch data when weeks changes', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('apex-chart')).toBeInTheDocument();
      });

      const initialCallCount = HttpClient.get.mock.calls.length;

      // Change weeks
      const weeksSelect = screen.getByTestId('param-select-Set-weeks-to-');
      fireEvent.change(weeksSelect, { target: { value: '2' } });

      await waitFor(() => {
        expect(HttpClient.get.mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });
  });

  describe('Legend Rendering', () => {
    it('should render legend items for each result type', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('legend-Passed')).toBeInTheDocument();
        expect(screen.getByTestId('legend-Failed')).toBeInTheDocument();
      });
    });
  });

  describe('Chart Configuration', () => {
    it('should render horizontal bar chart by default', async () => {
      renderComponent();

      await waitFor(() => {
        const chart = screen.getByTestId('apex-chart');
        expect(chart).toHaveAttribute('data-type', 'bar');
      });
    });

    it('should pass series data to chart', async () => {
      renderComponent();

      await waitFor(() => {
        const chart = screen.getByTestId('apex-chart');
        expect(
          parseInt(chart.getAttribute('data-series-count')),
        ).toBeGreaterThan(0);
      });
    });
  });

  describe('Props Handling', () => {
    it('should use custom dropdownItems', async () => {
      const customItems = ['custom1', 'custom2', 'custom3'];
      renderComponent({ dropdownItems: customItems });

      await waitFor(() => {
        const groupFieldSelect = screen.getByTestId(
          'param-select-Group-data-by-',
        );
        expect(groupFieldSelect.options.length).toBe(customItems.length);
      });
    });

    it('should not fetch when params is empty', async () => {
      renderComponent({ params: {} });

      // Should not call API with empty params
      await waitFor(() => {
        expect(HttpClient.get).not.toHaveBeenCalled();
      });
    });
  });

  describe('Empty Data Handling', () => {
    it('should handle empty chart data', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      renderComponent();

      await waitFor(() => {
        // Should not crash, loading should complete
        expect(screen.queryByText('Loading ...')).not.toBeInTheDocument();
      });
    });
  });
});
