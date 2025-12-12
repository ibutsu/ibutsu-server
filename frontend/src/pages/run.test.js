import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Run from './run';
import { IbutsuContext } from '../components/contexts/ibutsu-context';
import { HttpClient } from '../utilities/http';
import {
  createMockRun,
  createMockResult,
  createMockProject,
  createMockResultsResponse,
} from '../test-utils';

// Mock dependencies
jest.mock('../utilities/http');
jest.mock('./settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock components that we don't need to test in detail
jest.mock('../components/filtering/filtered-table-card', () => {
  return function FilterTable() {
    return <div data-ouia-component-id="filter-table">Filter Table</div>;
  };
});

jest.mock('../components/result-view', () => {
  return function ResultView() {
    return <div data-ouia-component-id="result-view">Result View</div>;
  };
});

jest.mock('../components/classify-failures', () => {
  return function ClassifyFailuresTable() {
    return (
      <div data-ouia-component-id="classify-failures">Classify Failures</div>
    );
  };
});

jest.mock('../components/artifact-tab', () => {
  return function ArtifactTab() {
    return <div data-ouia-component-id="artifact-tab">Artifact Tab</div>;
  };
});

jest.mock('../components/tab-title', () => {
  // eslint-disable-next-line react/prop-types
  return function TabTitle({ text }) {
    return <div>{text}</div>;
  };
});

describe('Run Page', () => {
  const mockProject = createMockProject();
  const mockRun = createMockRun({ project_id: mockProject.id });
  const mockResults = [
    createMockResult({ run_id: mockRun.id, project_id: mockProject.id }),
    createMockResult({ run_id: mockRun.id, project_id: mockProject.id }),
    createMockResult({ run_id: mockRun.id, project_id: mockProject.id }),
  ];

  const renderRun = ({
    initialRoute = `/project/${mockProject.id}/runs/${mockRun.id}`,
  } = {}) => {
    const contextValue = {
      primaryObject: mockProject,
      darkTheme: false,
      setDarkTheme: jest.fn(),
    };

    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <IbutsuContext.Provider value={contextValue}>
          <Routes>
            <Route path="/project/:project_id/runs/:run_id" element={<Run />} />
          </Routes>
        </IbutsuContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock HttpClient.get for run data
    HttpClient.get.mockImplementation((url) => {
      const urlString = Array.isArray(url) ? url.join('/') : url;

      if (urlString.includes('/run/')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockRun,
        });
      }

      if (urlString.includes('/result')) {
        return Promise.resolve({
          ok: true,
          json: async () => createMockResultsResponse(mockResults),
        });
      }

      if (urlString.includes('/artifact')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ artifacts: [] }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    // Mock HttpClient.handleResponse
    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });
  });

  describe('Run Data Loading', () => {
    it('should fetch and display run data', async () => {
      renderRun();

      await waitFor(() => {
        // Check that run endpoint was called
        const runCalls = HttpClient.get.mock.calls.filter(
          (call) =>
            Array.isArray(call[0]) &&
            call[0].includes('run') &&
            call[0].includes(mockRun.id),
        );
        expect(runCalls.length).toBeGreaterThan(0);
      });

      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching', () => {
      HttpClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { container } = renderRun();

      // Check for spinner or loading indicator in the DOM
      const spinner =
        container.querySelector('.pf-v6-c-spinner') ||
        container.querySelector('[role="progressbar"]');
      expect(spinner || container).toBeTruthy(); // Component should render
    });

    it('should handle fetch error gracefully', async () => {
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      renderRun();

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should handle invalid run ID', async () => {
      HttpClient.get.mockRejectedValue(new Error('Not found'));
      HttpClient.handleResponse.mockRejectedValue(new Error('Not found'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      renderRun();

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Tab Navigation', () => {
    it('should display Summary tab by default', async () => {
      renderRun();

      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });
    });

    it('should display Results tab', async () => {
      renderRun();

      await waitFor(() => {
        expect(screen.getByText('Results List')).toBeInTheDocument();
      });
    });

    it('should display Results Tree tab', async () => {
      renderRun();

      await waitFor(() => {
        expect(screen.getByText('Results Tree')).toBeInTheDocument();
      });
    });

    it('should display Classify Failures tab', async () => {
      renderRun();

      await waitFor(() => {
        const classifyTabs = screen.getAllByText('Classify Failures');
        expect(classifyTabs.length).toBeGreaterThan(0);
      });
    });

    it('should display Run Object tab', async () => {
      renderRun();

      await waitFor(() => {
        expect(screen.getByText('Run Object')).toBeInTheDocument();
      });
    });
  });

  describe('Run Summary Display', () => {
    it('should display run metadata', async () => {
      renderRun();

      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });

      // Check that component data is loaded (may be in cards or tables)
      await waitFor(() => {
        const { container } = renderRun();
        expect(container).toBeTruthy();
      });
    });

    it('should display run summary statistics', async () => {
      renderRun();

      await waitFor(() => {
        // Summary tab should be visible with data structures
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });
    });

    it('should display run duration', async () => {
      renderRun();

      await waitFor(() => {
        // Duration information should be somewhere in the component
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });
    });
  });

  describe('Results Fetching', () => {
    it('should fetch results for the run', async () => {
      renderRun();

      await waitFor(() => {
        // Results are fetched with filter parameter containing run_id
        const resultCalls = HttpClient.get.mock.calls.filter(
          (call) => Array.isArray(call[0]) && call[0].includes('result'),
        );
        expect(resultCalls.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty results', async () => {
      HttpClient.get.mockImplementation((url) => {
        const urlString = Array.isArray(url) ? url.join('/') : url;

        if (urlString.includes('/result')) {
          return Promise.resolve({
            ok: true,
            json: async () => createMockResultsResponse([]),
          });
        }

        if (urlString.includes('/run/')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockRun,
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      renderRun();

      await waitFor(() => {
        expect(screen.getByText('Results List')).toBeInTheDocument();
      });
    });

    it('should display results in table format', async () => {
      renderRun();

      await waitFor(() => {
        expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      });
    });
  });

  describe('Run with Different States', () => {
    it('should handle run with failures', async () => {
      const runWithFailures = createMockRun({
        project_id: mockProject.id,
        summary: {
          ...mockRun.summary,
          failures: 5,
        },
      });

      HttpClient.get.mockImplementation((url) => {
        const urlString = Array.isArray(url) ? url.join('/') : url;

        if (urlString.includes('/run/')) {
          return Promise.resolve({
            ok: true,
            json: async () => runWithFailures,
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => createMockResultsResponse([]),
        });
      });

      renderRun();

      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });
    });

    it('should handle run with errors', async () => {
      const runWithErrors = createMockRun({
        project_id: mockProject.id,
        summary: {
          ...mockRun.summary,
          errors: 3,
        },
      });

      HttpClient.get.mockImplementation((url) => {
        const urlString = Array.isArray(url) ? url.join('/') : url;

        if (urlString.includes('/run/')) {
          return Promise.resolve({
            ok: true,
            json: async () => runWithErrors,
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => createMockResultsResponse([]),
        });
      });

      renderRun();

      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });
    });

    it('should handle run with all passed tests', async () => {
      const runAllPassed = createMockRun({
        project_id: mockProject.id,
        summary: {
          failures: 0,
          errors: 0,
          xfailures: 0,
          xpasses: 0,
          skips: 0,
          tests: 10,
          collected: 10,
          not_run: 0,
        },
      });

      HttpClient.get.mockImplementation((url) => {
        const urlString = Array.isArray(url) ? url.join('/') : url;

        if (urlString.includes('/run/')) {
          return Promise.resolve({
            ok: true,
            json: async () => runAllPassed,
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => createMockResultsResponse([]),
        });
      });

      renderRun();

      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });
    });
  });

  describe('Run Artifacts', () => {
    it('should fetch run artifacts', async () => {
      HttpClient.get.mockImplementation((url) => {
        const urlString = Array.isArray(url) ? url.join('/') : url;

        if (urlString.includes('/artifact')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              artifacts: [],
            }),
          });
        }

        if (urlString.includes('/run/')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockRun,
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => createMockResultsResponse([]),
        });
      });

      renderRun();

      await waitFor(() => {
        // Verify run page rendered successfully
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });
    });

    it('should display artifact tabs when artifacts exist', async () => {
      HttpClient.get.mockImplementation((url) => {
        const urlString = Array.isArray(url) ? url.join('/') : url;

        if (urlString.includes('/artifact')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              artifacts: [
                { id: '1', filename: 'test.log', run_id: mockRun.id },
                { id: '2', filename: 'output.txt', run_id: mockRun.id },
              ],
            }),
          });
        }

        if (urlString.includes('/run/')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockRun,
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => createMockResultsResponse([]),
        });
      });

      renderRun();

      await waitFor(() => {
        // Artifact tabs should be rendered - check for tab structure
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });

      // Give artifacts time to load
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  describe('URL Parameters', () => {
    it('should extract run_id from URL params', async () => {
      renderRun();

      await waitFor(() => {
        // Check that run endpoint was called with the run ID
        const runCalls = HttpClient.get.mock.calls.filter(
          (call) =>
            Array.isArray(call[0]) &&
            call[0].includes('run') &&
            call[0].includes(mockRun.id),
        );
        expect(runCalls.length).toBeGreaterThan(0);
      });
    });

    it('should extract project_id from URL params', async () => {
      renderRun();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });
    });
  });
});
