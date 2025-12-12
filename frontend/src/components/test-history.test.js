import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TestHistoryTable from './test-history';
import { HttpClient } from '../utilities/http';
import {
  createMockResult,
  createMockResultsResponse,
  createMultipleMockResults,
  createMockJenkinsResult,
} from '../test-utils';

// Mock dependencies
jest.mock('../utilities/http');
jest.mock('../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock child components that are tested separately
jest.mock('./run-summary', () => {
  const PropTypes = require('prop-types');
  const MockRunSummary = ({ summary }) => (
    <div data-ouia-component-id="run-summary">
      {summary ? `${summary.passes || 0} passes` : 'No summary'}
    </div>
  );
  MockRunSummary.propTypes = { summary: PropTypes.object };
  return MockRunSummary;
});

jest.mock('./last-passed', () => {
  return function LastPassed() {
    return <div data-ouia-component-id="last-passed">Last passed mock</div>;
  };
});

jest.mock('./result-view', () => {
  return function ResultView() {
    return <div data-ouia-component-id="result-view">Result View Mock</div>;
  };
});

jest.mock('./filtering/filtered-table-card', () => {
  const PropTypes = require('prop-types');
  const MockFilterTable = ({
    columns,
    rows,
    fetching,
    headerChildren,
    footerChildren,
    filters,
  }) => (
    <div data-ouia-component-id="filter-table">
      {fetching && <div data-ouia-component-id="loading">Loading...</div>}
      {headerChildren}
      {filters}
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
      {footerChildren}
    </div>
  );
  MockFilterTable.propTypes = {
    columns: PropTypes.array,
    rows: PropTypes.array,
    fetching: PropTypes.bool,
    headerChildren: PropTypes.node,
    footerChildren: PropTypes.node,
    filters: PropTypes.node,
  };
  return MockFilterTable;
});

jest.mock('./filtering/active-filters', () => {
  return function ActiveFilters() {
    return <div data-ouia-component-id="active-filters">Active Filters</div>;
  };
});

describe('TestHistoryTable', () => {
  const mockTestResult = createMockResult({
    test_id: 'test.example.module.test_feature',
    component: 'frontend',
    env: 'staging',
    start_time: '2025-10-01T10:00:00+00:00',
  });

  const mockResults = createMultipleMockResults(5);
  const mockResultsResponse = createMockResultsResponse(mockResults, {
    page: 1,
    pageSize: 20,
    totalItems: 5,
  });

  const mockAggregatorResponse = [
    { _id: 'passed', count: 10 },
    { _id: 'failed', count: 2 },
    { _id: 'error', count: 1 },
  ];

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouter>
        <TestHistoryTable testResult={mockTestResult} {...props} />
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    HttpClient.get.mockImplementation((url) => {
      const urlPath = Array.isArray(url) ? url.join('/') : url;

      if (urlPath.includes('result-aggregator')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockAggregatorResponse,
        });
      }

      if (urlPath.includes('result')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockResultsResponse,
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
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
        expect(screen.getByText('Result')).toBeInTheDocument();
        expect(screen.getByText('Source')).toBeInTheDocument();
        expect(screen.getByText('Exception Name')).toBeInTheDocument();
        expect(screen.getByText('Duration')).toBeInTheDocument();
        expect(screen.getByText('Start Time')).toBeInTheDocument();
      });
    });

    it('should display failures checkbox', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(
          screen.getByText(/Failures and Errors Only/i),
        ).toBeInTheDocument();
      });
    });

    it('should display time range selector', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByText('Time Range')).toBeInTheDocument();
        expect(screen.getByText('1 Week')).toBeInTheDocument();
      });
    });

    it('should display summary card', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
        expect(screen.getByTestId('run-summary')).toBeInTheDocument();
      });
    });

    it('should display last passed card', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByText('Last passed mock')).toBeInTheDocument();
        expect(screen.getByTestId('last-passed')).toBeInTheDocument();
      });
    });

    it('should display disclaimer note', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(
          screen.getByText(/for performance reasons/i),
        ).toBeInTheDocument();
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
          expect.any(Object),
        );
      });
    });

    it('should fetch result aggregator for summary', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'widget', 'result-aggregator'],
          expect.any(Object),
        );
      });
    });

    it('should handle fetch error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should show loading state initially', () => {
      renderComponent();

      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });
  });

  describe('Comparison Results Mode', () => {
    it('should use comparisonResults when provided', async () => {
      const comparisonRows = [
        { id: '1', cells: ['Passed', 'source1', 'N/A', '1s', '2025-01-01'] },
        { id: '2', cells: ['Failed', 'source2', 'Error', '2s', '2025-01-02'] },
      ];

      renderComponent({ comparisonResults: comparisonRows });
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        // Should not fetch when comparisonResults provided
        expect(HttpClient.get).not.toHaveBeenCalledWith(
          expect.arrayContaining(['result']),
          expect.any(Object),
        );
      });
    });
  });

  describe('Jenkins Metadata Handling', () => {
    it('should display results with Jenkins metadata', async () => {
      const jenkinsResult = createMockJenkinsResult({
        result: 'passed',
        source: 'jenkins-pipeline',
      });

      const jenkinsResponse = createMockResultsResponse([jenkinsResult]);

      HttpClient.get.mockImplementation((url) => {
        const urlPath = Array.isArray(url) ? url.join('/') : url;
        if (urlPath.includes('result') && !urlPath.includes('aggregator')) {
          return Promise.resolve({
            ok: true,
            json: async () => jenkinsResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockAggregatorResponse,
        });
      });

      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      });
    });

    it('should display results without Jenkins metadata', async () => {
      const simpleResult = createMockResult({
        result: 'passed',
        source: 'manual-upload',
        metadata: { file: 'tests/test.py' },
      });

      const simpleResponse = createMockResultsResponse([simpleResult]);

      HttpClient.get.mockImplementation((url) => {
        const urlPath = Array.isArray(url) ? url.join('/') : url;
        if (urlPath.includes('result') && !urlPath.includes('aggregator')) {
          return Promise.resolve({
            ok: true,
            json: async () => simpleResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockAggregatorResponse,
        });
      });

      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should toggle failures only checkbox', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(
          screen.getByLabelText('only-failures-checkbox'),
        ).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText('only-failures-checkbox');
      fireEvent.click(checkbox);

      // Checkbox state should toggle
      expect(checkbox).toBeChecked();
    });

    it('should open time range selector on click', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByText('1 Week')).toBeInTheDocument();
      });

      // Click on the time range toggle
      const toggle = screen.getByText('1 Week');
      fireEvent.click(toggle);

      // Select options should become visible
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });
  });

  describe('Props Handling', () => {
    it('should render without testResult prop', async () => {
      render(
        <MemoryRouter>
          <TestHistoryTable />
        </MemoryRouter>,
      );
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      });
    });

    it('should handle testResult without env', async () => {
      const testResultNoEnv = createMockResult({
        test_id: 'test.module.test_func',
        component: 'backend',
        env: undefined,
      });

      render(
        <MemoryRouter>
          <TestHistoryTable testResult={testResultNoEnv} />
        </MemoryRouter>,
      );
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      });
    });

    it('should handle testResult without start_time', async () => {
      const testResultNoTime = createMockResult({
        test_id: 'test.module.test_func',
        component: 'backend',
        start_time: undefined,
      });

      render(
        <MemoryRouter>
          <TestHistoryTable testResult={testResultNoTime} />
        </MemoryRouter>,
      );
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      });
    });
  });

  describe('Error States', () => {
    it('should handle empty results', async () => {
      HttpClient.get.mockImplementation((url) => {
        const urlPath = Array.isArray(url) ? url.join('/') : url;
        if (urlPath.includes('result') && !urlPath.includes('aggregator')) {
          return Promise.resolve({
            ok: true,
            json: async () => createMockResultsResponse([]),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      });

      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      });
    });

    it('should handle aggregator fetch error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      HttpClient.get.mockImplementation((url) => {
        const urlPath = Array.isArray(url) ? url.join('/') : url;
        if (urlPath.includes('result-aggregator')) {
          return Promise.reject(new Error('Aggregator error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockResultsResponse,
        });
      });

      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });
});
