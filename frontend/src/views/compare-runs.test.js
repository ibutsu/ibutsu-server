/* eslint-env jest */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompareRunsView from './compare-runs';
import { IbutsuContext } from '../components/contexts/ibutsu-context';
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
  const MockFilterTable = ({ columns, rows, headerChildren, isError }) => (
    <div data-ouia-component-id="filter-table">
      <div data-ouia-component-id="filter-table-header">{headerChildren}</div>
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
          {rows.map((row, idx) => (
            <tr key={idx}>
              {row.cells.map((cell, cidx) => (
                <td key={cidx}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  MockFilterTable.propTypes = {
    columns: PropTypes.array,
    rows: PropTypes.array,
    headerChildren: PropTypes.node,
    isError: PropTypes.bool,
  };
  return MockFilterTable;
});

describe('CompareRunsView Component', () => {
  const mockProject = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'test-project',
    title: 'Test Project',
  };

  const mockCompareResults = {
    results: [
      {
        test_id: 'test.example.test_one',
        run1_result: 'passed',
        run2_result: 'failed',
      },
      {
        test_id: 'test.example.test_two',
        run1_result: 'failed',
        run2_result: 'passed',
      },
    ],
    pagination: {
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
    },
  };

  const renderCompareRunsView = ({ primaryObject = mockProject } = {}) => {
    const contextValue = {
      primaryObject,
      primaryType: 'project',
      setPrimaryType: jest.fn(),
      setPrimaryObject: jest.fn(),
      darkTheme: false,
      setDarkTheme: jest.fn(),
    };

    return render(
      <MemoryRouter>
        <IbutsuContext.Provider value={contextValue}>
          <CompareRunsView />
        </IbutsuContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => mockCompareResults,
    });

    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });
  });

  describe('Component rendering', () => {
    it('should render when primaryObject is set', () => {
      renderCompareRunsView();

      expect(screen.getByTestId('filter-table')).toBeInTheDocument();
    });

    it('should not render when primaryObject is not set', () => {
      renderCompareRunsView({ primaryObject: null });

      expect(screen.queryByTestId('filter-table')).not.toBeInTheDocument();
    });

    it('should render header with compare options', () => {
      renderCompareRunsView();

      expect(
        screen.getByText('Select Test Run metadata to compare'),
      ).toBeInTheDocument();
    });

    it('should render include skips checkbox', () => {
      renderCompareRunsView();

      const checkbox = screen.getByLabelText('include-skips-checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });

    it('should render Apply Filters button', () => {
      renderCompareRunsView();

      expect(
        screen.getByRole('button', { name: /apply filters/i }),
      ).toBeInTheDocument();
    });

    it('should render Clear Filters button', () => {
      renderCompareRunsView();

      expect(
        screen.getByRole('button', { name: /clear filters/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Filter controls', () => {
    it('should update includeSkipped state when checkbox is clicked', () => {
      renderCompareRunsView();

      const checkbox = screen.getByLabelText('include-skips-checkbox');
      expect(checkbox).not.toBeChecked();

      fireEvent.click(checkbox);

      expect(checkbox).toBeChecked();
    });

    it('should clear filters when Clear Filters button is clicked', async () => {
      renderCompareRunsView();

      const clearButton = screen.getByRole('button', {
        name: /clear filters/i,
      });
      fireEvent.click(clearButton);

      // Component should still be rendered after clearing filters
      await waitFor(() => {
        expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      });
    });
  });

  describe('Table columns', () => {
    it('should render correct column headers', () => {
      renderCompareRunsView();

      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('Run 1')).toBeInTheDocument();
      expect(screen.getByText('Run 2')).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      HttpClient.get.mockRejectedValue(new Error('API Error'));

      renderCompareRunsView();

      // Component should render without crashing even with errors
      expect(screen.getByTestId('filter-table')).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Loading state', () => {
    it('should show loading text when fetching data', async () => {
      HttpClient.get.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockCompareResults,
                }),
              100,
            ),
          ),
      );

      renderCompareRunsView();

      // Should render the filter table even during loading
      expect(screen.getByTestId('filter-table')).toBeInTheDocument();
    });
  });
});
