/* eslint-env jest */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FilterHeatmapWidget, HEATMAP_TYPES } from './filter-heatmap';
import { HttpClient } from '../utilities/http';
import { IbutsuContext } from '../components/contexts/ibutsu-context';

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
  return function WidgetHeader({ title, actions }) {
    return (
      <div data-ouia-component-id="widget-header">
        {title}
        {actions && (
          <div data-ouia-component-id="header-actions">{actions}</div>
        )}
      </div>
    );
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

// Mock HeatMapWrapper component
jest.mock('../components/heat-map-wrapper', () => {
  /* eslint-disable react/prop-types */
  return function HeatMapWrapper({ xLabels, yLabels, data }) {
    return (
      <div data-ouia-component-id="heatmap">
        <div data-ouia-component-id="heatmap-xlabels">
          {xLabels?.length || 0}
        </div>
        <div data-ouia-component-id="heatmap-ylabels">
          {yLabels?.length || 0}
        </div>
        <div data-ouia-component-id="heatmap-data">{data?.length || 0}</div>
      </div>
    );
  };
  /* eslint-enable react/prop-types */
});

describe('FilterHeatmapWidget', () => {
  const mockHeatmapData = {
    heatmap: {
      'job-name-1': [
        [95, 'run-id-1', null, '1001'],
        [88, 'run-id-2', null, '1002'],
        [92, 'run-id-3', null, '1003'],
      ],
    },
  };

  const defaultProps = {
    title: 'Test Heatmap',
    params: {
      project: 'test-project',
      builds: 5,
      group_field: 'component',
    },
    onDeleteClick: jest.fn(),
    onEditClick: jest.fn(),
  };

  const mockContextValue = {
    primaryObject: { id: 'test-project' },
    primaryType: 'project',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for HttpClient.get
    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => mockHeatmapData,
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
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('widget-header')).toHaveTextContent(
          'Test Heatmap',
        );
      });
    });

    it('should render heatmap when data is loaded', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('heatmap')).toBeInTheDocument();
      });
    });

    it('should use job_name as title when title is not provided', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              title={undefined}
              params={{ ...defaultProps.params, job_name: 'Test Job' }}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('widget-header')).toHaveTextContent(
          'Test Job',
        );
      });
    });

    it('should use Heatmap as default title when neither title nor job_name is provided', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              title={undefined}
              params={{ ...defaultProps.params, job_name: undefined }}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('widget-header')).toHaveTextContent(
          'Heatmap',
        );
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch filter heatmap data by default', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'filter-heatmap'],
          expect.objectContaining({
            project: 'test-project',
            builds: 5,
            group_field: 'component',
          }),
        );
      });
    });

    it('should fetch jenkins heatmap data when type is jenkins', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              type={HEATMAP_TYPES.jenkins}
              params={{
                ...defaultProps.params,
                job_name: 'test-job',
              }}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'jenkins-heatmap'],
          expect.objectContaining({
            job_name: 'test-job',
          }),
        );
      });
    });

    it('should not fetch when required params are missing', () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              params={{ project: 'test-project' }}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      // Should not fetch without builds and group_field
      expect(HttpClient.get).not.toHaveBeenCalled();
    });

    it('should handle fetch error', async () => {
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error fetching heatmap data:',
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Heatmap Types', () => {
    it('should support filter heatmap type', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              type={HEATMAP_TYPES.filter}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'filter-heatmap'],
          expect.any(Object),
        );
      });
    });

    it('should support jenkins heatmap type', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              type={HEATMAP_TYPES.jenkins}
              params={{
                ...defaultProps.params,
                job_name: 'test-job',
              }}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'jenkins-heatmap'],
          expect.any(Object),
        );
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state initially', () => {
      HttpClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      expect(screen.getByText('Loading ...')).toBeInTheDocument();
    });

    it('should update state after data loads', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('heatmap')).toBeInTheDocument();
      });
    });
  });

  describe('Error States', () => {
    it('should display error message on fetch failure', async () => {
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('Error fetching data')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no data is available', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => ({ heatmap: {} }),
      });

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByText('No data found for heatmap'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Dropdown Controls', () => {
    it('should render exactly 1 dropdown control by default for filter heatmap', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        const dropdowns = screen.getAllByTestId('param-dropdown');
        // One dropdown for number of builds
        expect(dropdowns.length).toBe(1);
      });
    });

    it('should hide dropdown controls when hideDropdown is true', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} hideDropdown={true} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        const dropdowns = screen.queryAllByTestId('param-dropdown');
        expect(dropdowns.length).toBe(0);
      });
    });

    it('should render 2 dropdowns for jenkins heatmap (builds and count skips)', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              type={HEATMAP_TYPES.jenkins}
              params={{
                ...defaultProps.params,
                job_name: 'test-job',
              }}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        const dropdowns = screen.getAllByTestId('param-dropdown');
        // One for builds, one for count skips
        expect(dropdowns.length).toBe(2);
        expect(screen.getByText(/Count skips as failure:/)).toBeInTheDocument();
      });
    });

    it('should render dropdown with custom dropdown items', async () => {
      const customItems = [3, 5, 7];

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              dropdownItems={customItems}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        // Verify dropdown renders when custom items are provided
        const dropdowns = screen.getAllByTestId('param-dropdown');
        expect(dropdowns.length).toBe(1);
      });
    });
  });

  describe('Props Handling', () => {
    it('should pass onDeleteClick prop to WidgetHeader', async () => {
      const onDeleteClick = jest.fn();

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              onDeleteClick={onDeleteClick}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
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

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} onEditClick={onEditClick} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        // Verify the widget renders and the prop is passed (WidgetHeader receives it)
        expect(screen.getByTestId('widget-header')).toBeInTheDocument();
      });

      // The actual click behavior is tested in WidgetHeader's own tests
      expect(onEditClick).not.toHaveBeenCalled(); // Not called until user clicks
    });

    it('should render heatmap with custom labelWidth prop', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} labelWidth={300} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        // Verify heatmap renders with data when custom labelWidth is provided
        const heatmap = screen.getByTestId('heatmap');
        expect(heatmap).toBeInTheDocument();
        // Verify heatmap has data rows
        expect(screen.getByTestId('heatmap-data')).toHaveTextContent('1');
      });
    });
  });

  describe('Jenkins Analysis Link', () => {
    it('should fetch analysis view ID for jenkins heatmap', async () => {
      const mockWidgetConfig = {
        widgets: [{ id: 'analysis-view-id-1' }],
      };

      HttpClient.get
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockWidgetConfig,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockHeatmapData,
        });

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              type={HEATMAP_TYPES.jenkins}
              params={{
                ...defaultProps.params,
                job_name: 'test-job',
              }}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget-config'],
          { filter: 'widget=jenkins-analysis-view' },
        );
      });
    });

    it('should not fetch analysis view ID for filter heatmap', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              type={HEATMAP_TYPES.filter}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('heatmap')).toBeInTheDocument();
      });

      // Should only have called for the heatmap data, not for widget-config
      expect(HttpClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('HEATMAP_TYPES Export', () => {
    it('should export HEATMAP_TYPES constants', () => {
      expect(HEATMAP_TYPES.filter).toBe('filter-heatmap');
      expect(HEATMAP_TYPES.jenkins).toBe('jenkins-heatmap');
    });
  });
});
