/* eslint-env jest */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JenkinsJobView from './jenkins-job';
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

// Mock FilterTable
jest.mock('../components/filtering/filtered-table-card', () => {
  const PropTypes = require('prop-types');
  const MockFilterTable = ({ columns, rows, fetching, isError }) => (
    <div data-testid="filter-table">
      {fetching && <div>Loading...</div>}
      {isError && <div>Error loading data</div>}
      <table>
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows &&
            rows.map((row, idx) => (
              <tr key={idx}>
                {row.cells.map((cell, cidx) => {
                  // Handle PatternFly table cell format { title: <Component /> }
                  if (cell && typeof cell === 'object' && cell.title) {
                    return <td key={cidx}>{cell.title}</td>;
                  }
                  // Render React elements directly
                  if (typeof cell === 'object' && cell !== null) {
                    return <td key={cidx}>{cell}</td>;
                  }
                  return <td key={cidx}>{cell}</td>;
                })}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
  MockFilterTable.propTypes = {
    columns: PropTypes.array,
    rows: PropTypes.array,
    fetching: PropTypes.bool,
    isError: PropTypes.bool,
  };
  return MockFilterTable;
});

// Mock RunSummary
jest.mock('../components/run-summary', () => {
  const PropTypes = require('prop-types');
  const MockRunSummary = ({ summary }) => (
    <div data-testid="run-summary">
      {summary.passes} passes, {summary.failures} failures
    </div>
  );
  MockRunSummary.propTypes = {
    summary: PropTypes.object,
  };
  return MockRunSummary;
});

// Mock ActiveFilters
jest.mock('../components/filtering/active-filters', () => {
  const PropTypes = require('prop-types');
  const MockActiveFilters = () => <div data-testid="active-filters" />;
  MockActiveFilters.propTypes = {
    activeFilters: PropTypes.array,
    hideFilters: PropTypes.array,
  };
  return MockActiveFilters;
});

describe('JenkinsJobView Component', () => {
  const mockProject = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'test-project',
    title: 'Test Project',
  };

  const mockView = {
    widget: 'jenkins-heatmap',
    params: {
      job_name: 'test-job',
      builds: 10,
    },
  };

  const mockJobsData = {
    jobs: [
      {
        job_name: 'test-job-1',
        build_number: '123',
        build_url: 'http://jenkins.example.com/job/test-job-1/123',
        summary: { passes: 10, failures: 2, errors: 0, skips: 1 },
        source: 'jenkins',
        env: 'production',
        start_time: '2024-01-01T10:00:00Z',
      },
      {
        job_name: 'test-job-2',
        build_number: '124',
        build_url: 'http://jenkins.example.com/job/test-job-2/124',
        summary: { passes: 8, failures: 0, errors: 1, skips: 0 },
        source: 'jenkins',
        env: 'staging',
        start_time: '2024-01-02T10:00:00Z',
      },
    ],
    pagination: {
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
    },
  };

  const mockWidgetConfigResponse = {
    widgets: [
      {
        id: '750e8400-e29b-41d4-a716-446655440000',
        widget: 'jenkins-analysis-view',
      },
    ],
  };

  const renderJenkinsJobView = ({
    primaryObject = mockProject,
    view = mockView,
    activeFilters = [{ field: 'job_name', operator: 'eq', value: 'test-job' }],
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
      <MemoryRouter
        initialEntries={[`/project/${mockProject.id}/jenkins-jobs`]}
      >
        <IbutsuContext.Provider value={ibutsuContextValue}>
          <FilterContext.Provider value={filterContextValue}>
            <JenkinsJobView view={view} />
          </FilterContext.Provider>
        </IbutsuContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock for widget config endpoint
    HttpClient.get.mockImplementation((url) => {
      if (url[1] === 'widget-config') {
        return Promise.resolve({
          ok: true,
          json: async () => mockWidgetConfigResponse,
        });
      }
      // Mock for jobs endpoint
      return Promise.resolve({
        ok: true,
        json: async () => mockJobsData,
      });
    });

    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });
  });

  describe('Component rendering', () => {
    it('should render FilterTable', async () => {
      renderJenkinsJobView();

      await waitFor(() => {
        expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      });
    });

    it('should display correct column headers', async () => {
      renderJenkinsJobView();

      await waitFor(() => {
        expect(screen.getByText('Job name')).toBeInTheDocument();
        expect(screen.getByText('Build number')).toBeInTheDocument();
        expect(screen.getByText('Summary')).toBeInTheDocument();
        expect(screen.getByText('Source')).toBeInTheDocument();
        expect(screen.getByText('Env')).toBeInTheDocument();
        expect(screen.getByText('Started')).toBeInTheDocument();
      });
    });
  });

  describe('Data fetching', () => {
    it('should fetch widget config on mount', async () => {
      renderJenkinsJobView();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget-config'],
          expect.objectContaining({
            filter: 'widget=jenkins-analysis-view',
          }),
        );
      });
    });

    it('should fetch jenkins jobs data with correct parameters', async () => {
      renderJenkinsJobView();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'jenkins-heatmap'],
          expect.objectContaining({
            page: 1,
            page_size: 20,
            project: mockProject.id,
          }),
        );
      });
    });

    it('should include active filters in request', async () => {
      const filters = [
        { field: 'job_name', operator: 'eq', value: 'test-job' },
        { field: 'env', operator: 'eq', value: 'production' },
      ];

      renderJenkinsJobView({ activeFilters: filters });

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });
    });

    it('should not include project param when primaryObject is null', async () => {
      renderJenkinsJobView({ primaryObject: null });

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'jenkins-heatmap'],
          expect.not.objectContaining({
            project: expect.anything(),
          }),
        );
      });
    });
  });

  describe('Data display', () => {
    it('should display job data in table', async () => {
      renderJenkinsJobView();

      // Wait for data to load by checking for text that should be present
      await waitFor(
        () => {
          expect(screen.getByText('production')).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      // Then check all expected data is present
      expect(screen.getByText('123')).toBeInTheDocument();
      expect(screen.getByText('124')).toBeInTheDocument();
      expect(screen.getByText('staging')).toBeInTheDocument();
    });

    it('should render run summaries', async () => {
      renderJenkinsJobView();

      await waitFor(() => {
        const summaries = screen.getAllByTestId('run-summary');
        expect(summaries.length).toBe(2);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle jobs API errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      HttpClient.get.mockImplementation((url) => {
        if (url[1] === 'widget-config') {
          return Promise.resolve({
            ok: true,
            json: async () => mockWidgetConfigResponse,
          });
        }
        return Promise.reject(new Error('API Error'));
      });

      renderJenkinsJobView();

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error fetching Jenkins data:',
          expect.any(Error),
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle missing jobs in response', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      HttpClient.get.mockImplementation((url) => {
        if (url[1] === 'widget-config') {
          return Promise.resolve({
            ok: true,
            json: async () => mockWidgetConfigResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ pagination: mockJobsData.pagination }),
        });
      });

      renderJenkinsJobView();

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle widget config API errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      HttpClient.get.mockImplementation((url) => {
        if (url[1] === 'widget-config') {
          return Promise.reject(new Error('Widget config error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockJobsData,
        });
      });

      renderJenkinsJobView();

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Loading state', () => {
    it('should show loading state initially', async () => {
      HttpClient.get.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockJobsData,
                }),
              100,
            ),
          ),
      );

      renderJenkinsJobView();

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('View updates', () => {
    it('should refetch data when filters change', async () => {
      const { rerender } = renderJenkinsJobView();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });

      const initialCallCount = HttpClient.get.mock.calls.length;

      // Change filters
      const newFilters = [
        { field: 'env', operator: 'eq', value: 'production' },
      ];

      const ibutsuContextValue = {
        primaryObject: mockProject,
        primaryType: 'project',
        setPrimaryType: jest.fn(),
        setPrimaryObject: jest.fn(),
        darkTheme: false,
        setDarkTheme: jest.fn(),
      };

      const filterContextValue = {
        activeFilters: newFilters,
        clearFilters: jest.fn(),
        setActiveFilters: jest.fn(),
      };

      rerender(
        <MemoryRouter
          initialEntries={[`/project/${mockProject.id}/jenkins-jobs`]}
        >
          <IbutsuContext.Provider value={ibutsuContextValue}>
            <FilterContext.Provider value={filterContextValue}>
              <JenkinsJobView view={mockView} />
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
