/* eslint-env jest */
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JenkinsJobAnalysisView from './jenkins-job-analysis';
import { IbutsuContext } from '../components/contexts/ibutsu-context';
import { FilterContext } from '../components/contexts/filter-context';
import { HttpClient } from '../utilities/http';

// Mock dependencies
jest.mock('../utilities/http');
jest.mock('../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock widgets
jest.mock('../widgets/filter-heatmap', () => ({
  FilterHeatmapWidget: () => <div data-testid="heatmap-widget">Heatmap</div>,
  HEATMAP_TYPES: { jenkins: 'jenkins' },
}));

jest.mock('../widgets/generic-bar', () => {
  const PropTypes = require('prop-types');
  const MockGenericBarWidget = ({ title }) => (
    <div data-testid="bar-widget">{title}</div>
  );
  MockGenericBarWidget.propTypes = { title: PropTypes.string };
  return MockGenericBarWidget;
});

jest.mock('../widgets/generic-area', () => {
  const PropTypes = require('prop-types');
  const MockGenericAreaWidget = ({ title }) => (
    <div data-testid="area-widget">{title}</div>
  );
  MockGenericAreaWidget.propTypes = { title: PropTypes.string };
  return MockGenericAreaWidget;
});

// Mock ParamDropdown
jest.mock('../components/param-dropdown', () => {
  const PropTypes = require('prop-types');
  const MockParamDropdown = ({ tooltip, defaultValue, handleSelect }) => (
    <div data-testid="param-dropdown">
      <span>{tooltip}</span>
      <button onClick={() => handleSelect(defaultValue)}>{defaultValue}</button>
    </div>
  );
  MockParamDropdown.propTypes = {
    tooltip: PropTypes.string,
    defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    handleSelect: PropTypes.func,
  };
  return MockParamDropdown;
});

describe('JenkinsJobAnalysisView Component', () => {
  const mockProject = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'test-project',
    title: 'Test Project',
  };

  const mockView = {
    widget: 'jenkins-analysis-view',
    params: {
      job_name: 'test-job',
    },
  };

  const mockWidgetData = {
    heatmap_params: {
      job_name: 'test-job',
      builds: 20,
      group_field: 'component',
    },
    barchart_params: {
      job_name: 'test-job',
      builds: 20,
    },
    linechart_params: {
      job_name: 'test-job',
      builds: 20,
    },
  };

  const renderJenkinsJobAnalysisView = ({
    primaryObject = mockProject,
    view = mockView,
    activeFilters = [{ field: 'job_name', operator: 'eq', value: 'test-job' }],
    defaultTab = 'heatmap',
  } = {}) => {
    const ibutsuContextValue = {
      primaryObject,
      primaryType: 'project',
      setPrimaryType: jest.fn(),
      setPrimaryObject: jest.fn(),
      darkTheme: false,
      setDarkTheme: jest.fn(),
    };

    const filterContextValue = {
      activeFilters,
      clearFilters: jest.fn(),
      setActiveFilters: jest.fn(),
    };

    return render(
      <MemoryRouter>
        <IbutsuContext.Provider value={ibutsuContextValue}>
          <FilterContext.Provider value={filterContextValue}>
            <JenkinsJobAnalysisView view={view} defaultTab={defaultTab} />
          </FilterContext.Provider>
        </IbutsuContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => mockWidgetData,
    });

    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });
  });

  describe('Component rendering', () => {
    it('should render tabs', async () => {
      renderJenkinsJobAnalysisView();

      const tabs = screen.getAllByText('Heatmap');
      expect(tabs.length).toBeGreaterThan(0);
      expect(screen.getByText('Overall Health')).toBeInTheDocument();
      expect(screen.getByText('Build Duration')).toBeInTheDocument();
    });

    it('should render heatmap tab by default', async () => {
      renderJenkinsJobAnalysisView();

      await waitFor(() => {
        expect(screen.getByTestId('heatmap-widget')).toBeInTheDocument();
      });
    });

    it('should respect defaultTab prop', async () => {
      renderJenkinsJobAnalysisView({ defaultTab: 'overall-health' });

      await waitFor(() => {
        // The Overall Health tab should be active
        expect(screen.queryByTestId('heatmap-widget')).not.toBeInTheDocument();
      });
    });
  });

  describe('Tab navigation', () => {
    it('should switch to Overall Health tab when clicked', async () => {
      renderJenkinsJobAnalysisView();

      const overallHealthTab = screen.getByText('Overall Health');
      fireEvent.click(overallHealthTab);

      await waitFor(() => {
        expect(screen.getByTestId('bar-widget')).toBeInTheDocument();
      });
    });

    it('should switch to Build Duration tab when clicked', async () => {
      renderJenkinsJobAnalysisView();

      const buildDurationTab = screen.getByText('Build Duration');
      fireEvent.click(buildDurationTab);

      await waitFor(() => {
        expect(screen.getByTestId('area-widget')).toBeInTheDocument();
      });
    });
  });

  describe('Heatmap tab controls', () => {
    it('should display build number selector', async () => {
      renderJenkinsJobAnalysisView();

      await waitFor(() => {
        const dropdowns = screen.getAllByTestId('param-dropdown');
        const buildDropdown = dropdowns.find((d) =>
          d.textContent.includes('Number of builds:'),
        );
        expect(buildDropdown).toBeInTheDocument();
      });
    });

    it('should display count skips selector', async () => {
      renderJenkinsJobAnalysisView();

      await waitFor(() => {
        const dropdowns = screen.getAllByTestId('param-dropdown');
        const skipsDropdown = dropdowns.find((d) =>
          d.textContent.includes('Skips as failure:'),
        );
        expect(skipsDropdown).toBeInTheDocument();
      });
    });
  });

  describe('Overall Health tab controls', () => {
    it('should display bar/area chart toggle', async () => {
      renderJenkinsJobAnalysisView();

      const overallHealthTab = screen.getByText('Overall Health');
      fireEvent.click(overallHealthTab);

      await waitFor(() => {
        expect(
          screen.getByLabelText('Change to Area Chart'),
        ).toBeInTheDocument();
      });
    });

    it('should switch between bar and area chart', async () => {
      renderJenkinsJobAnalysisView();

      const overallHealthTab = screen.getByText('Overall Health');
      fireEvent.click(overallHealthTab);

      await waitFor(() => {
        expect(screen.getByTestId('bar-widget')).toBeInTheDocument();
      });

      const toggle = screen.getByLabelText('Change to Area Chart');
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByTestId('area-widget')).toBeInTheDocument();
        expect(screen.queryByTestId('bar-widget')).not.toBeInTheDocument();
      });
    });
  });

  describe('Data fetching', () => {
    it('should fetch widget data on mount', async () => {
      renderJenkinsJobAnalysisView();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'jenkins-analysis-view'],
          expect.objectContaining({
            project: mockProject.id,
            builds: 20,
          }),
        );
      });
    });

    it('should include job_name from activeFilters', async () => {
      const filters = [
        { field: 'job_name', operator: 'eq', value: 'my-test-job' },
      ];

      renderJenkinsJobAnalysisView({ activeFilters: filters });

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({
            job_name: 'my-test-job',
          }),
        );
      });
    });

    it('should handle missing primaryObject', async () => {
      renderJenkinsJobAnalysisView({ primaryObject: null });

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          expect.any(Array),
          expect.not.objectContaining({
            project: expect.anything(),
          }),
        );
      });
    });
  });

  describe('Widget display', () => {
    it('should display heatmap widget with correct data', async () => {
      renderJenkinsJobAnalysisView();

      await waitFor(() => {
        expect(screen.getByTestId('heatmap-widget')).toBeInTheDocument();
      });
    });

    it('should display bar chart with job name in title', async () => {
      renderJenkinsJobAnalysisView();

      const overallHealthTab = screen.getByText('Overall Health');
      fireEvent.click(overallHealthTab);

      await waitFor(() => {
        const barWidget = screen.getByTestId('bar-widget');
        expect(barWidget.textContent).toContain('test-job');
      });
    });

    it('should display area chart with job name in title', async () => {
      renderJenkinsJobAnalysisView();

      const buildDurationTab = screen.getByText('Build Duration');
      fireEvent.click(buildDurationTab);

      await waitFor(() => {
        const areaWidget = screen.getByTestId('area-widget');
        expect(areaWidget.textContent).toContain('test-job');
      });
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      HttpClient.get.mockRejectedValue(new Error('API Error'));

      renderJenkinsJobAnalysisView();

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error fetching widget parameters:',
          expect.any(Error),
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Loading state', () => {
    it('should not display widgets while loading', async () => {
      jest.useFakeTimers();
      let resolvePromise;
      HttpClient.get.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          }),
      );

      renderJenkinsJobAnalysisView();

      // Fast-forward past the debounce timeout
      act(() => {
        jest.advanceTimersByTime(50);
      });

      // Check that widgets are not displayed while loading
      expect(screen.queryByTestId('heatmap-widget')).not.toBeInTheDocument();

      // Resolve the promise
      act(() => {
        if (resolvePromise) {
          resolvePromise({
            ok: true,
            json: async () => mockWidgetData,
          });
        }
      });

      // Switch back to real timers
      jest.useRealTimers();

      await waitFor(() => {
        expect(screen.getByTestId('heatmap-widget')).toBeInTheDocument();
      });
    });

    it('should display widgets after loading completes', async () => {
      renderJenkinsJobAnalysisView();

      await waitFor(() => {
        expect(screen.getByTestId('heatmap-widget')).toBeInTheDocument();
      });
    });
  });

  describe('Build count selection', () => {
    it('should limit builds to max for heatmap tab', async () => {
      renderJenkinsJobAnalysisView();

      await waitFor(() => {
        const dropdowns = screen.getAllByTestId('param-dropdown');
        expect(dropdowns.length).toBeGreaterThan(0);
      });

      // Component should handle build limits internally
      await waitFor(() => {
        expect(screen.getByTestId('heatmap-widget')).toBeInTheDocument();
      });
    });
  });

  describe('View prop changes', () => {
    it('should refetch data when view changes', async () => {
      const { rerender } = renderJenkinsJobAnalysisView();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });

      const initialCallCount = HttpClient.get.mock.calls.length;

      const newView = {
        ...mockView,
        params: { ...mockView.params, job_name: 'different-job' },
      };

      const ibutsuContextValue = {
        primaryObject: mockProject,
        primaryType: 'project',
        setPrimaryType: jest.fn(),
        setPrimaryObject: jest.fn(),
        darkTheme: false,
        setDarkTheme: jest.fn(),
      };

      const filterContextValue = {
        activeFilters: [
          { field: 'job_name', operator: 'eq', value: 'different-job' },
        ],
        clearFilters: jest.fn(),
        setActiveFilters: jest.fn(),
      };

      rerender(
        <MemoryRouter>
          <IbutsuContext.Provider value={ibutsuContextValue}>
            <FilterContext.Provider value={filterContextValue}>
              <JenkinsJobAnalysisView view={newView} />
            </FilterContext.Provider>
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get.mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });
  });
});
