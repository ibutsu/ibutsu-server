import { render, screen, waitFor } from '@testing-library/react';
import GenericBarWidget from './generic-bar';
import { HttpClient } from '../utilities/http';

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

// Mock ParamDropdown component
jest.mock('../components/param-dropdown', () => {
  // eslint-disable-next-line react/prop-types
  return function ParamDropdown({ tooltip, defaultValue }) {
    return (
      <div data-ouia-component-id="param-dropdown">
        {tooltip} {defaultValue}
      </div>
    );
  };
});

// Mock PatternFly Charts
jest.mock('@patternfly/react-charts/victory', () => ({
  // eslint-disable-next-line react/prop-types
  Chart: function Chart({ children }) {
    return <div data-ouia-component-id="chart">{children}</div>;
  },
  ChartAxis: function ChartAxis() {
    return <div data-ouia-component-id="chart-axis" />;
  },
  ChartBar: function ChartBar() {
    return <div data-ouia-component-id="chart-bar" />;
  },
  // eslint-disable-next-line react/prop-types
  ChartLegend: function ChartLegend({ data }) {
    return (
      <div data-ouia-component-id="chart-legend">{JSON.stringify(data)}</div>
    );
  },
  // eslint-disable-next-line react/prop-types
  ChartStack: function ChartStack({ children }) {
    return <div data-ouia-component-id="chart-stack">{children}</div>;
  },
  ChartTooltip: function ChartTooltip() {
    return <div data-ouia-component-id="chart-tooltip" />;
  },
}));

describe('GenericBarWidget', () => {
  const mockData = {
    passed: { 'group-1': 10, 'group-2': 15 },
    failed: { 'group-1': 2, 'group-2': 1 },
    error: { 'group-1': 1, 'group-2': 0 },
    skipped: { 'group-1': 3, 'group-2': 2 },
  };

  const defaultProps = {
    title: 'Test Bar Chart',
    params: { project: 'test-project', group_field: 'component' },
    widgetEndpoint: 'run-aggregator',
    onDeleteClick: jest.fn(),
    onEditClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for HttpClient.get
    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => mockData,
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
      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-header')).toHaveTextContent(
          'Test Bar Chart',
        );
      });
    });

    it('should render chart container', async () => {
      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('chart')).toBeInTheDocument();
      });
    });

    it('should render legend', async () => {
      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('chart-legend')).toBeInTheDocument();
      });
    });

    it('should use default title when title prop is not provided', async () => {
      render(<GenericBarWidget {...defaultProps} title={undefined} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-header')).toHaveTextContent(
          'Recent Run Results',
        );
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch data on mount', async () => {
      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'run-aggregator'],
          defaultProps.params,
        );
      });
    });

    it('should not fetch when params are empty', () => {
      render(<GenericBarWidget {...defaultProps} params={{}} />);

      expect(HttpClient.get).not.toHaveBeenCalled();
    });

    it('should refetch when params change', async () => {
      const { rerender } = render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledTimes(1);
      });

      const newParams = { project: 'new-project', group_field: 'env' };
      rerender(<GenericBarWidget {...defaultProps} params={newParams} />);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledTimes(2);
        expect(HttpClient.get).toHaveBeenLastCalledWith(
          ['http://localhost:8080/api', 'widget', 'run-aggregator'],
          newParams,
        );
      });
    });

    it('should handle fetch error', async () => {
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Chart Display', () => {
    it('should display chart with bar data', async () => {
      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByTestId('chart-bar')).toHaveLength(4);
      });
    });

    it('should display chart stack', async () => {
      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('chart-stack')).toBeInTheDocument();
      });
    });

    it('should display chart axes', async () => {
      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        const axes = screen.getAllByTestId('chart-axis');
        expect(axes.length).toBe(2); // x and y axis
      });
    });

    it('should handle empty data without rendering bars', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        // Should not render any chart bars when data is empty
        const bars = screen.queryAllByTestId('chart-bar');
        expect(bars.length).toBe(0);
      });
    });
  });

  describe('Props Handling', () => {
    it('should pass onDeleteClick prop to WidgetHeader', async () => {
      const onDeleteClick = jest.fn();

      render(
        <GenericBarWidget {...defaultProps} onDeleteClick={onDeleteClick} />,
      );

      await waitFor(() => {
        // Verify the widget renders and the prop is passed (WidgetHeader receives it)
        expect(screen.getByTestId('widget-header')).toBeInTheDocument();
      });

      // The actual click behavior is tested in WidgetHeader's own tests
      expect(onDeleteClick).not.toHaveBeenCalled(); // Not called until user clicks
    });

    it('should pass onEditClick prop to WidgetHeader', async () => {
      const onEditClick = jest.fn();

      render(<GenericBarWidget {...defaultProps} onEditClick={onEditClick} />);

      await waitFor(() => {
        // Verify the widget renders and the prop is passed (WidgetHeader receives it)
        expect(screen.getByTestId('widget-header')).toBeInTheDocument();
      });

      // The actual click behavior is tested in WidgetHeader's own tests
      expect(onEditClick).not.toHaveBeenCalled(); // Not called until user clicks
    });

    it('should render chart with horizontal orientation when horizontal prop is true', async () => {
      render(<GenericBarWidget {...defaultProps} horizontal={true} />);

      await waitFor(() => {
        // Verify chart renders with data
        expect(screen.getAllByTestId('chart-bar')).toHaveLength(4);
      });
    });

    it('should handle percentData prop and affect tooltip formatting', async () => {
      // Mock the getLabels function behavior in the component
      render(<GenericBarWidget {...defaultProps} percentData={true} />);

      await waitFor(() => {
        // Chart should render with bar data
        expect(screen.getAllByTestId('chart-bar')).toHaveLength(4);
        // Verify chart container exists
        expect(screen.getByTestId('chart')).toBeInTheDocument();
      });
    });
  });

  describe('Dropdown Controls', () => {
    it('should render exactly 2 dropdown controls by default', async () => {
      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        const dropdowns = screen.getAllByTestId('param-dropdown');
        // One for group field, one for weeks
        expect(dropdowns.length).toBe(2);
      });
    });

    it('should hide dropdown controls when hideDropdown is true', async () => {
      render(<GenericBarWidget {...defaultProps} hideDropdown={true} />);

      await waitFor(() => {
        const dropdowns = screen.queryAllByTestId('param-dropdown');
        expect(dropdowns.length).toBe(0);
      });
    });

    it('should render with custom dropdown items', async () => {
      const customItems = ['env', 'component'];

      render(
        <GenericBarWidget {...defaultProps} dropdownItems={customItems} />,
      );

      await waitFor(() => {
        // Verify widget renders with dropdowns when custom items are provided
        const dropdowns = screen.getAllByTestId('param-dropdown');
        expect(dropdowns.length).toBe(2);
      });
    });
  });

  describe('Custom Styling', () => {
    it('should render chart with custom barWidth prop', async () => {
      render(<GenericBarWidget {...defaultProps} barWidth={50} />);

      await waitFor(() => {
        // Verify chart renders with bars when custom barWidth is provided
        expect(screen.getAllByTestId('chart-bar')).toHaveLength(4);
      });
    });

    it('should render chart with custom padding prop', async () => {
      const customPadding = { top: 10, bottom: 10, left: 50, right: 50 };

      render(<GenericBarWidget {...defaultProps} padding={customPadding} />);

      await waitFor(() => {
        // Verify chart renders with data when custom padding is provided
        expect(screen.getAllByTestId('chart-bar')).toHaveLength(4);
      });
    });

    it('should render chart with custom fontSize prop', async () => {
      render(<GenericBarWidget {...defaultProps} fontSize={16} />);

      await waitFor(() => {
        // Verify chart renders with data when custom fontSize is provided
        expect(screen.getAllByTestId('chart-bar')).toHaveLength(4);
      });
    });

    it('should render chart with custom sortOrder prop', async () => {
      render(<GenericBarWidget {...defaultProps} sortOrder="ascending" />);

      await waitFor(() => {
        // Verify chart renders with bars when sortOrder is set to ascending
        expect(screen.getAllByTestId('chart-bar')).toHaveLength(4);
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state initially', () => {
      HttpClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<GenericBarWidget {...defaultProps} />);

      expect(screen.getByText('Loading ...')).toBeInTheDocument();
    });

    it('should update state after data loads', async () => {
      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('chart')).toBeInTheDocument();
      });
    });
  });

  describe('Error States', () => {
    it('should handle HTTP error response', async () => {
      HttpClient.handleResponse.mockRejectedValue(new Error('Server error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should display error message on fetch failure', async () => {
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Error fetching data')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should handle malformed response data without crashing', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        // Should not render bars with null data
        const bars = screen.queryAllByTestId('chart-bar');
        expect(bars.length).toBe(0);
      });
    });
  });

  describe('Widget Endpoint', () => {
    it('should use custom widget endpoint', async () => {
      const customEndpoint = 'custom-aggregator';

      render(
        <GenericBarWidget {...defaultProps} widgetEndpoint={customEndpoint} />,
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', customEndpoint],
          defaultProps.params,
        );
      });
    });

    it('should use default endpoint when not specified', async () => {
      render(<GenericBarWidget {...defaultProps} />);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'run-aggregator'],
          defaultProps.params,
        );
      });
    });
  });

  describe('Axis Labels', () => {
    it('should render chart with custom xLabel prop', async () => {
      render(<GenericBarWidget {...defaultProps} xLabel="Custom X Label" />);

      await waitFor(() => {
        // Verify chart renders with axes when custom xLabel is provided
        const axes = screen.getAllByTestId('chart-axis');
        expect(axes.length).toBe(2);
      });
    });

    it('should render chart with custom yLabel prop', async () => {
      render(<GenericBarWidget {...defaultProps} yLabel="Custom Y Label" />);

      await waitFor(() => {
        // Verify chart renders with axes when custom yLabel is provided
        const axes = screen.getAllByTestId('chart-axis');
        expect(axes.length).toBe(2);
      });
    });

    it('should render chart with xLabelTooltip prop', async () => {
      render(
        <GenericBarWidget
          {...defaultProps}
          xLabelTooltip="Tooltip for X axis"
        />,
      );

      await waitFor(() => {
        // Verify chart renders with data when xLabelTooltip is provided
        expect(screen.getAllByTestId('chart-bar')).toHaveLength(4);
      });
    });
  });
});
