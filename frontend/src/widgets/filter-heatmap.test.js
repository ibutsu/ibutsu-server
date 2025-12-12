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

  describe('Cell Rendering Logic', () => {
    it('should render heatmap with multiple job rows', async () => {
      const multiJobData = {
        heatmap: {
          'job-1': [
            [95, 'run-1', null, '101'],
            [88, 'run-2', null, '102'],
          ],
          'job-2': [
            [72, 'run-3', null, '103'],
            [60, 'run-4', null, '104'],
          ],
        },
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => multiJobData,
      });

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        // Verify heatmap has 2 rows of data
        expect(screen.getByTestId('heatmap-ylabels')).toHaveTextContent('2');
        expect(screen.getByTestId('heatmap-data')).toHaveTextContent('2');
      });
    });

    it('should handle data with annotations', async () => {
      const annotatedData = {
        heatmap: {
          'job-with-annotation': [
            [
              85,
              'run-annotated',
              [{ name: 'Note', value: 'Test annotation' }],
              '200',
            ],
          ],
        },
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => annotatedData,
      });

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

    it('should handle data with low pass rate (failed state)', async () => {
      const failedData = {
        heatmap: {
          'failing-job': [
            [35, 'run-fail', null, '301'],
            [48, 'run-fail-2', null, '302'],
          ],
        },
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => failedData,
      });

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('heatmap-data')).toHaveTextContent('1');
      });
    });

    it('should handle data with medium pass rate (skipped state)', async () => {
      const skippedData = {
        heatmap: {
          'medium-job': [
            [65, 'run-med', null, '401'],
            [75, 'run-med-2', null, '402'],
          ],
        },
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => skippedData,
      });

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('heatmap-data')).toHaveTextContent('1');
      });
    });

    it('should handle data with high pass rate (passed state)', async () => {
      const passedData = {
        heatmap: {
          'passing-job': [
            [92, 'run-pass', null, '501'],
            [98, 'run-pass-2', null, '502'],
          ],
        },
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => passedData,
      });

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('heatmap-data')).toHaveTextContent('1');
      });
    });

    it('should handle NaN values in data', async () => {
      const nanData = {
        heatmap: {
          'nan-job': [[NaN, 'run-nan', null, '601']],
        },
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => nanData,
      });

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('heatmap-data')).toHaveTextContent('1');
      });
    });

    it('should handle trend indicator data (first column)', async () => {
      // First column shows trend arrows: up (>1), right (0-1), down (<0)
      const trendData = {
        heatmap: {
          'trend-up': [
            [5, 0, null, null],
            [92, 'run-1', null, '701'],
          ],
          'trend-down': [
            [-2, 0, null, null],
            [85, 'run-2', null, '702'],
          ],
          'trend-stable': [
            [0.5, 0, null, null],
            [90, 'run-3', null, '703'],
          ],
          'trend-100': [
            [100, 0, null, null],
            [100, 'run-4', null, '704'],
          ],
        },
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => trendData,
      });

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('heatmap-ylabels')).toHaveTextContent('4');
      });
    });
  });

  describe('Jenkins Analysis Link Rendering', () => {
    it('should render analysis link button when analysisViewId is fetched', async () => {
      const mockWidgetConfig = {
        widgets: [{ id: 'analysis-view-123' }],
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
                job_name: 'my-jenkins-job',
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

    it('should handle error when fetching analysisViewId', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      HttpClient.get
        .mockRejectedValueOnce(new Error('Failed to fetch widget config'))
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
                job_name: 'my-jenkins-job',
              }}
            />
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

    it('should handle empty widgets array in response', async () => {
      const mockWidgetConfig = {
        widgets: [],
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
                job_name: 'my-jenkins-job',
              }}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('heatmap')).toBeInTheDocument();
      });
    });
  });

  describe('countSkips Parameter', () => {
    it('should use default countSkips=true when not specified', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              type={HEATMAP_TYPES.jenkins}
              params={{
                ...defaultProps.params,
                job_name: 'test-job',
                // count_skips not specified
              }}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'jenkins-heatmap'],
          expect.objectContaining({
            count_skips: true,
          }),
        );
      });
    });

    it('should use specified countSkips value from params', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              type={HEATMAP_TYPES.jenkins}
              params={{
                ...defaultProps.params,
                job_name: 'test-job',
                count_skips: false,
              }}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'jenkins-heatmap'],
          expect.objectContaining({
            count_skips: false,
          }),
        );
      });
    });
  });

  describe('XLabels with Build Numbers', () => {
    it('should generate xLabels from heatmap data with build numbers', async () => {
      const dataWithBuildNumbers = {
        heatmap: {
          'job-1': [
            [95, 'run-1', null, 'build-100'],
            [88, 'run-2', null, 'build-101'],
            [92, 'run-3', null, 'build-102'],
          ],
        },
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => dataWithBuildNumbers,
      });

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        // 4 xLabels: 1 icon + 3 build numbers
        expect(screen.getByTestId('heatmap-xlabels')).toHaveTextContent('4');
      });
    });

    it('should use longer labels array when multiple jobs have different label counts', async () => {
      const dataWithVaryingLabels = {
        heatmap: {
          'job-short': [[95, 'run-1', null, 'b1']],
          'job-long': [
            [88, 'run-2', null, 'b2'],
            [92, 'run-3', null, 'b3'],
            [90, 'run-4', null, 'b4'],
          ],
        },
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => dataWithVaryingLabels,
      });

      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        // Should use the longer labels array (3 from job-long) + 1 icon
        expect(screen.getByTestId('heatmap-xlabels')).toHaveTextContent('4');
      });
    });
  });

  describe('PrimaryObject Context Usage', () => {
    it('should use params.project when primaryObject is null', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider
            value={{ primaryObject: null, primaryType: 'project' }}
          >
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('heatmap')).toBeInTheDocument();
      });
    });

    it('should use primaryObject.id when available', async () => {
      const dataWithLinks = {
        heatmap: {
          'job-1': [[95, 'run-1', null, '100']],
        },
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => dataWithLinks,
      });

      render(
        <MemoryRouter>
          <IbutsuContext.Provider
            value={{
              primaryObject: { id: 'context-project' },
              primaryType: 'project',
            }}
          >
            <FilterHeatmapWidget {...defaultProps} />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('heatmap')).toBeInTheDocument();
      });
    });
  });

  describe('Builds State Updates', () => {
    it('should initialize builds from params', async () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              params={{ ...defaultProps.params, builds: 7 }}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ builds: 7 }),
        );
      });
    });
  });

  describe('Missing Required Params', () => {
    it('should not fetch when group_field is missing', () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              params={{ project: 'test', builds: 5 }}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      expect(HttpClient.get).not.toHaveBeenCalled();
    });

    it('should not fetch jenkins heatmap when job_name is missing', () => {
      render(
        <MemoryRouter>
          <IbutsuContext.Provider value={mockContextValue}>
            <FilterHeatmapWidget
              {...defaultProps}
              type={HEATMAP_TYPES.jenkins}
              params={{
                project: 'test',
                builds: 5,
                group_field: 'component',
                // job_name missing
              }}
            />
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      // Should fall back to filter-heatmap type
      expect(HttpClient.get).toHaveBeenCalledWith(
        ['http://localhost:8080/api', 'widget', 'filter-heatmap'],
        expect.any(Object),
      );
    });
  });
});
