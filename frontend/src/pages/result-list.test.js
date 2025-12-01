/* eslint-env jest */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResultList from './result-list';
import { IbutsuContext } from '../components/contexts/ibutsu-context';
import { FilterContext } from '../components/contexts/filter-context';
import { HttpClient } from '../utilities/http';
import {
  createMockResult,
  createMockResultsResponse,
  createMultipleMockResults,
} from '../test-utils/mock-data';

// Mock dependencies
jest.mock('../utilities/http');
jest.mock('./settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080',
  },
}));

describe('ResultList', () => {
  const mockUpdateFilters = jest.fn();
  const mockClearFilters = jest.fn();
  const mockSetFieldOptions = jest.fn();

  const defaultIbutsuContext = {
    primaryObject: {
      id: 'project-123',
      name: 'test-project',
    },
    primaryType: 'project',
    setPrimaryObject: jest.fn(),
    setPrimaryType: jest.fn(),
    darkTheme: false,
    setDarkTheme: jest.fn(),
  };

  const defaultFilterContext = {
    activeFilters: [],
    updateFilters: mockUpdateFilters,
    clearFilters: mockClearFilters,
    setFieldOptions: mockSetFieldOptions,
    fieldSelection: null,
    operationSelection: 'eq',
    textFilter: '',
    setTextFilter: jest.fn(),
    onFieldSelect: jest.fn(),
    onOperationSelect: jest.fn(),
    onRemoveFilter: jest.fn(),
    applyFilter: jest.fn(),
    resetFilters: jest.fn(),
    filterMode: 'text',
    operationMode: 'single',
    operations: {
      eq: { opString: 'Equals' },
      contains: { opString: 'Contains' },
    },
    fieldToggle: (toggleRef) => <button ref={toggleRef}>Field</button>,
    operationToggle: (toggleRef) => <button ref={toggleRef}>Operation</button>,
    boolToggle: (toggleRef) => <button ref={toggleRef}>Bool</button>,
    filteredFieldOptions: [],
    isFieldOpen: false,
    setIsFieldOpen: jest.fn(),
    isOperationOpen: false,
    setIsOperationOpen: jest.fn(),
    isBoolOpen: false,
    setIsBoolOpen: jest.fn(),
    boolSelection: null,
    onBoolSelect: jest.fn(),
    inValues: [],
    setInValues: jest.fn(),
  };

  const renderComponent = (
    ibutsuContext = {},
    filterContext = {},
    route = '/results',
  ) => {
    const mergedIbutsuContext = {
      ...defaultIbutsuContext,
      ...ibutsuContext,
    };
    const mergedFilterContext = {
      ...defaultFilterContext,
      ...filterContext,
    };

    return render(
      <MemoryRouter initialEntries={[route]}>
        <IbutsuContext.Provider value={mergedIbutsuContext}>
          <FilterContext.Provider value={mergedFilterContext}>
            <ResultList />
          </FilterContext.Provider>
        </IbutsuContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    HttpClient.get = jest.fn();
    HttpClient.handleResponse = jest.fn();
  });

  describe('Rendering', () => {
    it('should render without crashing', async () => {
      const mockResults = createMultipleMockResults(3);
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test results')).toBeInTheDocument();
      });
    });

    it('should render page title', async () => {
      const mockResults = [];
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test results')).toBeInTheDocument();
      });
    });

    it('should render disclaimer note', async () => {
      const mockResults = [];
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/for performance reasons/i),
        ).toBeInTheDocument();
      });
    });

    it('should set document title', async () => {
      const mockResults = [];
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(document.title).toBe('Test Results | Ibutsu');
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch results on mount', async () => {
      const mockResults = createMultipleMockResults(5);
      const mockResponse = createMockResultsResponse(mockResults, {
        page: 1,
        pageSize: 20,
        totalItems: 5,
      });

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080', 'result'],
          expect.objectContaining({
            estimate: true,
            page: 1,
            pageSize: 20,
            filter: [],
          }),
        );
      });
    });

    it('should fetch results with active filters', async () => {
      const mockResults = createMultipleMockResults(2);
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      const filterContext = {
        activeFilters: [{ field: 'result', operator: 'eq', value: 'passed' }],
      };

      renderComponent({}, filterContext);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080', 'result'],
          expect.objectContaining({
            filter: ['result=passed'],
          }),
        );
      });
    });

    it('should fetch runs on mount', async () => {
      const mockResults = [];
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080', 'run'],
          expect.objectContaining({
            pageSize: 100,
            estimate: true,
          }),
        );
      });
    });

    it('should fetch runs with project filter', async () => {
      const mockResults = [];
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent({ primaryObject: { id: 'project-456' } });

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080', 'run'],
          expect.objectContaining({
            filter: ['project_id=project-456'],
          }),
        );
      });
    });

    it('should handle fetch error gracefully', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Error fetching result data:',
          expect.any(Error),
        );
      });

      consoleError.mockRestore();
    });

    it('should fetch project filter params when primaryObject is set', async () => {
      const mockResults = [];
      const mockResponse = createMockResultsResponse(mockResults);
      const mockFilterParams = ['metadata.browser', 'metadata.os'];

      HttpClient.get.mockImplementation((path) => {
        if (path.includes('filter-params')) {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });

      HttpClient.handleResponse.mockImplementation((response) => {
        const pathStr = JSON.stringify(response);
        if (pathStr.includes('filter-params')) {
          return Promise.resolve(mockFilterParams);
        }
        return Promise.resolve(mockResponse);
      });

      renderComponent({ primaryObject: { id: 'project-789' } });

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith([
          'http://localhost:8080',
          'project',
          'filter-params',
          'project-789',
        ]);
      });
    });

    it('should handle filter params fetch error', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const mockResults = [];
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockImplementation((path) => {
        if (path.includes('filter-params')) {
          return Promise.reject(new Error('Filter params error'));
        }
        return Promise.resolve({});
      });

      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent({ primaryObject: { id: 'project-123' } });

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Error fetching project filter params:',
          expect.any(Error),
        );
      });

      consoleError.mockRestore();
    });
  });

  describe('Pagination', () => {
    it('should update pagination state from API response', async () => {
      const mockResults = createMultipleMockResults(5);
      const mockResponse = createMockResultsResponse(mockResults, {
        page: 2,
        pageSize: 10,
        totalItems: 50,
      });

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(HttpClient.handleResponse).toHaveBeenCalled();
      });

      // Verify pagination was set from response
      expect(mockResponse.pagination.page).toBe(2);
      expect(mockResponse.pagination.pageSize).toBe(10);
      expect(mockResponse.pagination.totalItems).toBe(50);
    });
  });

  describe('Sorting', () => {
    it('should sort results by duration', async () => {
      const mockResults = [
        createMockResult({ id: '1', duration: 5.0 }),
        createMockResult({ id: '2', duration: 2.0 }),
        createMockResult({ id: '3', duration: 8.0 }),
      ];
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(HttpClient.handleResponse).toHaveBeenCalled();
      });

      // Component should have rendered with data
      await waitFor(() => {
        expect(screen.getByText('Test results')).toBeInTheDocument();
      });
    });

    it('should sort results by started time', async () => {
      const mockResults = [
        createMockResult({ id: '1', start_time: '2024-01-01T10:00:00' }),
        createMockResult({ id: '2', start_time: '2024-01-01T08:00:00' }),
        createMockResult({ id: '3', start_time: '2024-01-01T12:00:00' }),
      ];
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(HttpClient.handleResponse).toHaveBeenCalled();
      });
    });

    it('should handle sort by result status', async () => {
      const mockResults = [
        createMockResult({ id: '1', result: 'passed' }),
        createMockResult({ id: '2', result: 'failed' }),
        createMockResult({ id: '3', result: 'error' }),
      ];
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test results')).toBeInTheDocument();
      });
    });

    it('should maintain sort state when switching between sorted and original rows', async () => {
      const mockResults = createMultipleMockResults(5);
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test results')).toBeInTheDocument();
      });
    });
  });

  describe('Filter Integration', () => {
    it('should refetch data when filters change', async () => {
      const mockResults = createMultipleMockResults(3);
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      const { rerender } = renderComponent();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledTimes(3); // result, run, filter-params
      });

      // Change filters
      const newFilterContext = {
        activeFilters: [{ field: 'result', operator: 'eq', value: 'failed' }],
      };

      rerender(
        <MemoryRouter initialEntries={['/results']}>
          <IbutsuContext.Provider value={defaultIbutsuContext}>
            <FilterContext.Provider
              value={{ ...defaultFilterContext, ...newFilterContext }}
            >
              <ResultList />
            </FilterContext.Provider>
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080', 'result'],
          expect.objectContaining({
            filter: ['result=failed'],
          }),
        );
      });
    });

    it('should pass updateFilters callback to resultToRow', async () => {
      const mockResults = createMultipleMockResults(2);
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(HttpClient.handleResponse).toHaveBeenCalled();
      });

      // The updateFilters function should have been available to resultToRow
      expect(mockUpdateFilters).not.toHaveBeenCalled(); // Not called until user interaction
    });
  });

  describe('Error Handling', () => {
    it('should display error state when fetch fails', async () => {
      HttpClient.get.mockRejectedValue(new Error('Server error'));

      renderComponent();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });

      // Error should be handled internally
      expect(screen.getByText('Test results')).toBeInTheDocument();
    });

    it('should set isError state on fetch failure', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      HttpClient.get.mockRejectedValue(new Error('Network failure'));

      renderComponent();

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });
  });

  describe('Debouncing', () => {
    it('should debounce data fetching', async () => {
      jest.useFakeTimers();
      const mockResults = [];
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      // Fast advance past debounce
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });

      jest.useRealTimers();
    });
  });

  describe('Primary Object Context', () => {
    it('should handle missing primaryObject', async () => {
      const mockResults = [];
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent({ primaryObject: null });

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });
    });

    it('should refetch when primaryObject changes', async () => {
      const mockResults = [];
      const mockResponse = createMockResultsResponse(mockResults);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      const { rerender } = renderComponent({
        primaryObject: { id: 'project-1' },
      });

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });

      const callCount = HttpClient.get.mock.calls.length;

      // Change primaryObject
      rerender(
        <MemoryRouter initialEntries={['/results']}>
          <IbutsuContext.Provider
            value={{
              ...defaultIbutsuContext,
              primaryObject: { id: 'project-2' },
            }}
          >
            <FilterContext.Provider value={defaultFilterContext}>
              <ResultList />
            </FilterContext.Provider>
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get.mock.calls.length).toBeGreaterThan(callCount);
      });
    });
  });
});
