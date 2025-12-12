import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ResultAggregateApex from './result-aggregate-apex';

// Mock dependencies
jest.mock('../utilities', () => ({
  getDarkTheme: jest.fn(() => false),
  toTitleCase: jest.fn((str) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1) : '',
  ),
  HttpClient: {
    get: jest.fn(),
    handleResponse: jest.fn(),
  },
}));

// Import HttpClient after mocking
import { HttpClient } from '../utilities';

jest.mock('../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock ApexCharts
jest.mock('react-apexcharts', () => {
  const PropTypes = require('prop-types');
  const MockChart = ({ options, series, type }) => (
    <div
      data-ouia-component-id="apex-chart"
      data-type={type}
      data-series-count={series?.length || 0}
      data-labels={JSON.stringify(options?.labels || [])}
    >
      ApexCharts Mock - Total: {series?.reduce((a, b) => a + b, 0) || 0}
    </div>
  );
  MockChart.propTypes = {
    options: PropTypes.object,
    series: PropTypes.array,
    type: PropTypes.string,
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

describe('ResultAggregateApex', () => {
  const defaultParams = {
    project: 'test-project',
  };

  const mockAggregatorData = [
    { _id: 'passed', count: 45 },
    { _id: 'failed', count: 5 },
    { _id: 'error', count: 2 },
    { _id: 'skipped', count: 3 },
  ];

  const renderComponent = (props = {}) => {
    return render(
      <ResultAggregateApex
        title="Test Widget"
        params={defaultParams}
        days={7}
        groupField="result"
        {...props}
      />,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => mockAggregatorData,
    });

    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });
  });

  describe('Rendering', () => {
    it('should render the widget card', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('widget-header')).toBeInTheDocument();
      });
    });

    it('should render custom title', async () => {
      renderComponent({ title: 'Custom Result Widget' });

      await waitFor(() => {
        expect(screen.getByTestId('widget-title')).toHaveTextContent(
          'Custom Result Widget',
        );
      });
    });

    it('should render default title when not provided', async () => {
      renderComponent({ title: undefined });

      await waitFor(() => {
        expect(screen.getByTestId('widget-title')).toHaveTextContent(
          'Result Aggregator',
        );
      });
    });

    it('should render ApexCharts when data loaded', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('apex-chart')).toBeInTheDocument();
      });
    });

    it('should render donut chart', async () => {
      renderComponent();

      await waitFor(() => {
        const chart = screen.getByTestId('apex-chart');
        expect(chart).toHaveAttribute('data-type', 'donut');
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
          ['http://localhost:8080/api', 'widget', 'result-aggregator'],
          expect.objectContaining({
            project: 'test-project',
            days: 7,
            group_field: 'result',
          }),
        );
      });
    });

    it('should pass additional_filters when provided', async () => {
      renderComponent({
        params: {
          project: 'test-project',
          additional_filters: ['component=frontend'],
        },
      });

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({
            additional_filters: ['component=frontend'],
          }),
        );
      });
    });

    it('should pass run_id when provided', async () => {
      renderComponent({
        params: {
          project: 'test-project',
          run_id: 'run-123',
        },
      });

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({
            run_id: 'run-123',
          }),
        );
      });
    });

    it('should handle API error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Error fetching data')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching result aggregator data:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Empty Data Handling', () => {
    it('should show no data message when total is 0', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/No data returned, try changing the days/i),
        ).toBeInTheDocument();
      });
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
      fireEvent.change(groupFieldSelect, { target: { value: 'component' } });

      await waitFor(() => {
        expect(HttpClient.get.mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });

    it('should refetch data when days changes', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('apex-chart')).toBeInTheDocument();
      });

      const initialCallCount = HttpClient.get.mock.calls.length;

      // Change days
      const daysSelect = screen.getByTestId('param-select-Set-days-to-');
      fireEvent.change(daysSelect, { target: { value: '14' } });

      await waitFor(() => {
        expect(HttpClient.get.mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });
  });

  describe('Legend Rendering', () => {
    it('should render legend items for result types', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('legend-Passed (45)')).toBeInTheDocument();
        expect(screen.getByTestId('legend-Failed (5)')).toBeInTheDocument();
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

    it('should generate default dropdownItems', async () => {
      renderComponent({ dropdownItems: undefined });

      await waitFor(() => {
        expect(screen.getByTestId('apex-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Chart Configuration', () => {
    it('should calculate total from series data', async () => {
      renderComponent();

      await waitFor(() => {
        const chart = screen.getByTestId('apex-chart');
        // Total should be 45 + 5 + 2 + 3 = 55
        expect(chart).toHaveTextContent('Total: 55');
      });
    });

    it('should include all labels in chart', async () => {
      renderComponent();

      await waitFor(() => {
        const chart = screen.getByTestId('apex-chart');
        const labels = JSON.parse(chart.getAttribute('data-labels'));
        expect(labels).toContain('Passed');
        expect(labels).toContain('Failed');
      });
    });
  });
});
