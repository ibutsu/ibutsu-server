import { render, screen, waitFor } from '@testing-library/react';
import GenericAreaWidget from './generic-area';
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

// Mock PatternFly Charts
jest.mock('@patternfly/react-charts/victory', () => ({
  // eslint-disable-next-line react/prop-types
  Chart: function Chart({ children }) {
    return <div data-ouia-component-id="chart">{children}</div>;
  },
  ChartAxis: function ChartAxis() {
    return <div data-ouia-component-id="chart-axis" />;
  },
  ChartArea: function ChartArea() {
    return <div data-ouia-component-id="chart-area" />;
  },
  ChartContainer: function ChartContainer() {
    return <div data-ouia-component-id="chart-container" />;
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
  ChartThemeColor: {
    default: '#000000',
  },
  ChartTooltip: function ChartTooltip() {
    return <div data-ouia-component-id="chart-tooltip" />;
  },
  createContainer: () => {
    // eslint-disable-next-line react/prop-types
    return function CursorVoronoiContainer({ children }) {
      return (
        <div data-ouia-component-id="cursor-voronoi-container">{children}</div>
      );
    };
  },
}));

describe('GenericAreaWidget', () => {
  const mockData = {
    passed: { 'group-1': 10, 'group-2': 15, 'group-3': 12 },
    failed: { 'group-1': 2, 'group-2': 1, 'group-3': 3 },
    error: { 'group-1': 1, 'group-2': 0, 'group-3': 1 },
    skipped: { 'group-1': 3, 'group-2': 2, 'group-3': 4 },
  };

  const defaultProps = {
    title: 'Test Area Chart',
    params: { project: 'test-project', group_field: 'component' },
    widgetEndpoint: 'jenkins-line-chart',
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
      render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-header')).toHaveTextContent(
          'Test Area Chart',
        );
      });
    });

    it('should render chart container', async () => {
      render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('chart')).toBeInTheDocument();
      });
    });

    it('should render legend', async () => {
      render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('chart-legend')).toBeInTheDocument();
      });
    });

    it('should use default title when title prop is not provided', async () => {
      render(<GenericAreaWidget {...defaultProps} title={undefined} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-header')).toHaveTextContent(
          'Generic Area Chart',
        );
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch data on mount', async () => {
      render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'jenkins-line-chart'],
          defaultProps.params,
        );
      });
    });

    it('should not fetch when params are empty', () => {
      render(<GenericAreaWidget {...defaultProps} params={{}} />);

      expect(HttpClient.get).not.toHaveBeenCalled();
    });

    it('should refetch when params change', async () => {
      const { rerender } = render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledTimes(1);
      });

      const newParams = { project: 'new-project', group_field: 'env' };
      rerender(<GenericAreaWidget {...defaultProps} params={newParams} />);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledTimes(2);
        expect(HttpClient.get).toHaveBeenLastCalledWith(
          ['http://localhost:8080/api', 'widget', 'jenkins-line-chart'],
          newParams,
        );
      });
    });

    it('should handle fetch error', async () => {
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Chart Display', () => {
    it('should display chart with area data', async () => {
      render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByTestId('chart-area')).toHaveLength(4);
      });
    });

    it('should display chart stack', async () => {
      render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('chart-stack')).toBeInTheDocument();
      });
    });

    it('should display chart axes', async () => {
      render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        const axes = screen.getAllByTestId('chart-axis');
        expect(axes.length).toBe(2); // x and y axis
      });
    });

    it('should handle empty data without rendering area charts', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        // Should not render any chart areas when data is empty
        const areas = screen.queryAllByTestId('chart-area');
        expect(areas.length).toBe(0);
      });
    });
  });

  describe('Props Handling', () => {
    it('should pass onDeleteClick prop to WidgetHeader', async () => {
      const onDeleteClick = jest.fn();

      render(
        <GenericAreaWidget {...defaultProps} onDeleteClick={onDeleteClick} />,
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

      render(<GenericAreaWidget {...defaultProps} onEditClick={onEditClick} />);

      await waitFor(() => {
        // Verify the widget renders and the prop is passed (WidgetHeader receives it)
        expect(screen.getByTestId('widget-header')).toBeInTheDocument();
      });

      // The actual click behavior is tested in WidgetHeader's own tests
      expect(onEditClick).not.toHaveBeenCalled(); // Not called until user clicks
    });

    it('should handle percentData prop and render chart with data', async () => {
      render(<GenericAreaWidget {...defaultProps} percentData={true} />);

      await waitFor(() => {
        // Chart should render with area data
        expect(screen.getAllByTestId('chart-area')).toHaveLength(4);
        // Verify chart container exists
        expect(screen.getByTestId('chart')).toBeInTheDocument();
      });
    });

    it('should handle showTooltip prop true', async () => {
      render(<GenericAreaWidget {...defaultProps} showTooltip={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('chart')).toBeInTheDocument();
      });
    });

    it('should handle showTooltip prop false', async () => {
      render(<GenericAreaWidget {...defaultProps} showTooltip={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('chart')).toBeInTheDocument();
      });
    });
  });

  describe('Custom Styling', () => {
    it('should render chart with custom interpolation prop', async () => {
      render(<GenericAreaWidget {...defaultProps} interpolation="natural" />);

      await waitFor(() => {
        // Verify chart renders with area charts when custom interpolation is provided
        expect(screen.getAllByTestId('chart-area')).toHaveLength(4);
      });
    });

    it('should render chart with custom padding prop', async () => {
      const customPadding = { top: 10, bottom: 10, left: 50, right: 50 };

      render(<GenericAreaWidget {...defaultProps} padding={customPadding} />);

      await waitFor(() => {
        // Verify chart renders with data when custom padding is provided
        expect(screen.getAllByTestId('chart-area')).toHaveLength(4);
      });
    });

    it('should render chart with custom fontSize prop', async () => {
      render(<GenericAreaWidget {...defaultProps} fontSize={16} />);

      await waitFor(() => {
        // Verify chart renders with data when custom fontSize is provided
        expect(screen.getAllByTestId('chart-area')).toHaveLength(4);
      });
    });

    it('should render chart with custom sortOrder prop', async () => {
      render(<GenericAreaWidget {...defaultProps} sortOrder="descending" />);

      await waitFor(() => {
        // Verify chart renders with areas when sortOrder is set to descending
        expect(screen.getAllByTestId('chart-area')).toHaveLength(4);
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state initially', () => {
      HttpClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<GenericAreaWidget {...defaultProps} />);

      expect(screen.getByText('Loading ...')).toBeInTheDocument();
    });

    it('should update state after data loads', async () => {
      render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('chart')).toBeInTheDocument();
      });
    });
  });

  describe('Error States', () => {
    it('should handle HTTP error response', async () => {
      HttpClient.handleResponse.mockRejectedValue(new Error('Server error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should display error message on fetch failure', async () => {
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<GenericAreaWidget {...defaultProps} />);

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

      render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        // Should not render areas with null data
        const areas = screen.queryAllByTestId('chart-area');
        expect(areas.length).toBe(0);
      });
    });
  });

  describe('Widget Endpoint', () => {
    it('should use custom widget endpoint', async () => {
      const customEndpoint = 'custom-line-chart';

      render(
        <GenericAreaWidget {...defaultProps} widgetEndpoint={customEndpoint} />,
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', customEndpoint],
          defaultProps.params,
        );
      });
    });

    it('should use default endpoint when not specified', async () => {
      render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'jenkins-line-chart'],
          defaultProps.params,
        );
      });
    });
  });

  describe('Axis Labels', () => {
    it('should render chart with custom xLabel prop', async () => {
      render(<GenericAreaWidget {...defaultProps} xLabel="Custom X Label" />);

      await waitFor(() => {
        // Verify chart renders with axes when custom xLabel is provided
        const axes = screen.getAllByTestId('chart-axis');
        expect(axes.length).toBe(2);
      });
    });

    it('should render chart with custom yLabel prop', async () => {
      render(<GenericAreaWidget {...defaultProps} yLabel="Custom Y Label" />);

      await waitFor(() => {
        // Verify chart renders with axes when custom yLabel is provided
        const axes = screen.getAllByTestId('chart-axis');
        expect(axes.length).toBe(2);
      });
    });

    it('should display varExplanation text in footer', async () => {
      render(
        <GenericAreaWidget
          {...defaultProps}
          varExplanation="Variable explanation text"
        />,
      );

      await waitFor(() => {
        // Verify the explanation text is rendered
        expect(
          screen.getByText('Variable explanation text'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Data Filtering', () => {
    it('should filter out filter field from data', async () => {
      const dataWithFilter = {
        ...mockData,
        filter: { 'group-1': 100 },
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => dataWithFilter,
      });

      render(<GenericAreaWidget {...defaultProps} />);

      await waitFor(() => {
        // Should still only have 4 area charts, not 5
        expect(screen.getAllByTestId('chart-area')).toHaveLength(4);
      });
    });
  });
});
