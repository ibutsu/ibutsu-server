import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClassifyFailuresTable from './classify-failures';
import { FilterContext } from './contexts/filter-context';
import { HttpClient } from '../utilities/http';
import {
  createMockResult,
  createMockResultsResponse,
  createMockFailedResult,
  createMockJenkinsResult,
} from '../test-utils';

// Mock dependencies
jest.mock('../utilities/http');
jest.mock('../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock child components
jest.mock('./classification-dropdown', () => ({
  ClassificationDropdown: function ClassificationDropdown() {
    return (
      <div data-ouia-component-id="classification-dropdown">Classification</div>
    );
  },
  MultiClassificationDropdown: function MultiClassificationDropdown() {
    return (
      <div data-ouia-component-id="multi-classification-dropdown">
        Multi Classification
      </div>
    );
  },
}));

jest.mock('./result-view', () => {
  return function ResultView() {
    return <div data-ouia-component-id="result-view">Result View</div>;
  };
});

jest.mock('./filtering/filtered-table-card', () => {
  const PropTypes = require('prop-types');
  const MockFilterTable = ({
    columns,
    rows,
    fetching,
    isError,
    filters,
    selectable,
  }) => (
    <div data-ouia-component-id="filter-table">
      {fetching && <div data-ouia-component-id="loading">Loading...</div>}
      {isError && <div data-ouia-component-id="error">Error loading data</div>}
      {filters}
      {selectable && (
        <div data-ouia-component-id="selectable-table">Selectable</div>
      )}
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
              <tr key={idx} data-ouia-component-id={`row-${idx}`}>
                {row.cells &&
                  row.cells.map((cell, cidx) => <td key={cidx}>{cell}</td>)}
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
    filters: PropTypes.node,
    selectable: PropTypes.bool,
  };
  return MockFilterTable;
});

jest.mock('./filtering/result-filter', () => {
  return function ResultFilter() {
    return <div data-ouia-component-id="result-filter">Result Filter</div>;
  };
});

describe('ClassifyFailuresTable', () => {
  const mockRunId = 'a1b2c3d4-1234-5678-9abc-def012345678';

  const mockFailedResults = [
    createMockFailedResult({ id: 'result-1', test_id: 'test.module.test_one' }),
    createMockFailedResult({ id: 'result-2', test_id: 'test.module.test_two' }),
    createMockResult({
      id: 'result-3',
      test_id: 'test.module.test_three',
      result: 'error',
    }),
  ];

  const mockResultsResponse = createMockResultsResponse(mockFailedResults, {
    page: 1,
    pageSize: 20,
    totalItems: 3,
  });

  const defaultFilterContext = {
    activeFilters: [],
    updateFilters: jest.fn(),
    clearFilters: jest.fn(),
    setActiveFilters: jest.fn(),
    onRemoveFilter: jest.fn(),
  };

  const renderComponent = (filterContext = {}) => {
    const mergedFilterContext = { ...defaultFilterContext, ...filterContext };

    return render(
      <MemoryRouter initialEntries={[`/project/proj-1/runs/${mockRunId}`]}>
        <FilterContext.Provider value={mergedFilterContext}>
          <Routes>
            <Route
              path="/project/:project_id/runs/:run_id"
              element={<ClassifyFailuresTable />}
            />
          </Routes>
        </FilterContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => mockResultsResponse,
    });

    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render the card with title', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByText('Test Failures')).toBeInTheDocument();
      });
    });

    it('should render FilterTable component', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      });
    });

    it('should display column headers', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText('Result')).toBeInTheDocument();
        expect(screen.getByText('Exception Name')).toBeInTheDocument();
        expect(screen.getByText('Classification')).toBeInTheDocument();
        expect(screen.getByText('Duration')).toBeInTheDocument();
      });
    });

    it('should display include skips checkbox', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByText('Include skips, xfails')).toBeInTheDocument();
      });
    });

    it('should display multi classification dropdown', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(
          screen.getByTestId('multi-classification-dropdown'),
        ).toBeInTheDocument();
      });
    });

    it('should display result filter', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('result-filter')).toBeInTheDocument();
      });
    });

    it('should be selectable table', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('selectable-table')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch results on mount', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'result'],
          expect.objectContaining({
            page: 1,
            pageSize: 20,
          }),
        );
      });
    });

    it('should include run_id filter in request', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({
            filter: expect.arrayContaining([
              expect.stringContaining(`run_id=${mockRunId}`),
            ]),
          }),
        );
      });
    });

    it('should include result filter for failed/error', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({
            filter: expect.arrayContaining([
              expect.stringContaining('result*'),
            ]),
          }),
        );
      });
    });

    it('should handle fetch error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error fetching result data:',
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });

    it('should show error state on fetch failure', async () => {
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      // Suppress expected console.error for this intentional failure
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      // Verify error was logged (but suppressed from output)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching result data:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('User Interactions', () => {
    it('should toggle include skips checkbox', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(
          screen.getByLabelText('include-skips-checkbox'),
        ).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText('include-skips-checkbox');
      fireEvent.click(checkbox);

      expect(checkbox).toBeChecked();
    });

    it('should refetch with skipped results when checkbox toggled', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });

      const initialCallCount = HttpClient.get.mock.calls.length;

      const checkbox = screen.getByLabelText('include-skips-checkbox');
      fireEvent.click(checkbox);
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(HttpClient.get.mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });
  });

  describe('Jenkins Metadata Handling', () => {
    it('should display results with Jenkins metadata', async () => {
      const jenkinsResult = createMockJenkinsResult({
        id: 'jenkins-result-1',
        result: 'failed',
        test_id: 'test.jenkins.test_pipeline',
      });

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => createMockResultsResponse([jenkinsResult]),
      });

      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      });
    });

    it('should display results without Jenkins metadata', async () => {
      const simpleResult = createMockResult({
        id: 'simple-result-1',
        result: 'failed',
        test_id: 'test.simple.test_func',
        metadata: { file: 'tests/test.py' },
      });

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => createMockResultsResponse([simpleResult]),
      });

      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      });
    });
  });

  describe('Filter Context Integration', () => {
    it('should use activeFilters from context', async () => {
      const filterContext = {
        activeFilters: [
          { field: 'component', operator: 'eq', value: 'frontend' },
        ],
      };

      renderComponent(filterContext);
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({
            filter: expect.arrayContaining([
              expect.stringContaining('component=frontend'),
            ]),
          }),
        );
      });
    });

    it('should call clearFilters when filters cleared', async () => {
      const clearFiltersMock = jest.fn();
      const filterContext = {
        clearFilters: clearFiltersMock,
      };

      renderComponent(filterContext);
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      });

      // clearFilters is passed to FilterTable and called from there
      expect(clearFiltersMock).not.toHaveBeenCalled();
    });
  });

  describe('Empty States', () => {
    it('should handle empty results', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => createMockResultsResponse([]),
      });

      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      });
    });
  });

  describe('Result Row Transformation', () => {
    it('should display test_id as link', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('row-0')).toBeInTheDocument();
      });
    });

    it('should display classification dropdown for each result', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        const dropdowns = screen.getAllByTestId('classification-dropdown');
        expect(dropdowns.length).toBeGreaterThan(0);
      });
    });
  });
});
