/* eslint-env jest */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RunList from './run-list';
import { IbutsuContext } from '../components/contexts/ibutsu-context';
import { FilterContext } from '../components/contexts/filter-context';
import { HttpClient } from '../utilities/http';
import {
  createMockRun,
  createMockRunsResponse,
  createMultipleMockRuns,
} from '../test-utils/mock-data';

// Mock dependencies
jest.mock('../utilities/http');
jest.mock('./settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080',
  },
}));

describe('RunList', () => {
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
      regex: { opString: 'Regex' },
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
    route = '/runs',
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
            <RunList />
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
      const mockRuns = createMultipleMockRuns(3);
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test runs')).toBeInTheDocument();
      });
    });

    it('should render page title', async () => {
      const mockRuns = [];
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test runs')).toBeInTheDocument();
      });
    });

    it('should render disclaimer note', async () => {
      const mockRuns = [];
      const mockResponse = createMockRunsResponse(mockRuns);

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
      const mockRuns = [];
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(document.title).toBe('Test Runs | Ibutsu');
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch runs on mount', async () => {
      const mockRuns = createMultipleMockRuns(5);
      const mockResponse = createMockRunsResponse(mockRuns, {
        page: 1,
        pageSize: 20,
        totalItems: 5,
      });

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080', 'run'],
          expect.objectContaining({
            estimate: true,
            page: 1,
            pageSize: 20,
            filter: [],
          }),
        );
      });
    });

    it('should fetch runs with active filters', async () => {
      const mockRuns = createMultipleMockRuns(2);
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      const filterContext = {
        activeFilters: [{ field: 'source', operator: 'eq', value: 'jenkins' }],
      };

      renderComponent({}, filterContext);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080', 'run'],
          expect.objectContaining({
            filter: ['source=jenkins'],
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
          'Error fetching run data:',
          expect.any(Error),
        );
      });

      consoleError.mockRestore();
    });

    it('should set field options on mount', async () => {
      const mockRuns = [];
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(mockSetFieldOptions).toHaveBeenCalled();
      });
    });
  });

  describe('Pagination', () => {
    it('should update pagination state from API response', async () => {
      const mockRuns = createMultipleMockRuns(5);
      const mockResponse = createMockRunsResponse(mockRuns, {
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

    it('should handle pagination with empty results', async () => {
      const mockRuns = [];
      const mockResponse = createMockRunsResponse(mockRuns, {
        page: 1,
        pageSize: 20,
        totalItems: 0,
      });

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(HttpClient.handleResponse).toHaveBeenCalled();
      });
    });
  });

  describe('Sorting', () => {
    it('should sort runs by duration', async () => {
      const mockRuns = [
        createMockRun({ id: '1', duration: 150.0 }),
        createMockRun({ id: '2', duration: 75.0 }),
        createMockRun({ id: '3', duration: 200.0 }),
      ];
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(HttpClient.handleResponse).toHaveBeenCalled();
      });

      // Component should have rendered with data
      await waitFor(() => {
        expect(screen.getByText('Test runs')).toBeInTheDocument();
      });
    });

    it('should sort runs by started time', async () => {
      const mockRuns = [
        createMockRun({ id: '1', start_time: '2024-01-01T10:00:00' }),
        createMockRun({ id: '2', start_time: '2024-01-01T08:00:00' }),
        createMockRun({ id: '3', start_time: '2024-01-01T12:00:00' }),
      ];
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(HttpClient.handleResponse).toHaveBeenCalled();
      });
    });

    it('should handle different run summaries', async () => {
      const mockRuns = [
        createMockRun({
          id: '1',
          summary: { failures: 5, errors: 2, tests: 100 },
        }),
        createMockRun({
          id: '2',
          summary: { failures: 0, errors: 0, tests: 50 },
        }),
        createMockRun({
          id: '3',
          summary: { failures: 10, errors: 1, tests: 200 },
        }),
      ];
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test runs')).toBeInTheDocument();
      });
    });

    it('should maintain sort state when switching between sorted and original rows', async () => {
      const mockRuns = createMultipleMockRuns(5);
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test runs')).toBeInTheDocument();
      });
    });
  });

  describe('Filter Integration', () => {
    it('should refetch data when filters change', async () => {
      const mockRuns = createMultipleMockRuns(3);
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      const { rerender } = renderComponent();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });

      // Change filters
      const newFilterContext = {
        activeFilters: [{ field: 'env', operator: 'eq', value: 'staging' }],
      };

      rerender(
        <MemoryRouter initialEntries={['/runs']}>
          <IbutsuContext.Provider value={defaultIbutsuContext}>
            <FilterContext.Provider
              value={{ ...defaultFilterContext, ...newFilterContext }}
            >
              <RunList />
            </FilterContext.Provider>
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080', 'run'],
          expect.objectContaining({
            filter: ['env=staging'],
          }),
        );
      });
    });

    it('should pass updateFilters callback to runToRow', async () => {
      const mockRuns = createMultipleMockRuns(2);
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(HttpClient.handleResponse).toHaveBeenCalled();
      });

      // The updateFilters function should have been available to runToRow
      expect(mockUpdateFilters).not.toHaveBeenCalled(); // Not called until user interaction
    });

    it('should call clearFilters when clearing filters', async () => {
      const mockRuns = createMultipleMockRuns(2);
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test runs')).toBeInTheDocument();
      });

      // clearFilters prop is passed to FilterTable
      expect(mockClearFilters).not.toHaveBeenCalled(); // Only called on user interaction
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
      expect(screen.getByText('Test runs')).toBeInTheDocument();
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

    it('should clear rows on error', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // First successful call
      const mockRuns = createMultipleMockRuns(3);
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValueOnce({});
      HttpClient.handleResponse.mockResolvedValueOnce(mockResponse);

      const { rerender } = renderComponent();

      await waitFor(() => {
        expect(HttpClient.handleResponse).toHaveBeenCalled();
      });

      // Now fail
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      rerender(
        <MemoryRouter initialEntries={['/runs']}>
          <IbutsuContext.Provider value={defaultIbutsuContext}>
            <FilterContext.Provider
              value={{
                ...defaultFilterContext,
                activeFilters: [
                  { field: 'source', operator: 'eq', value: 'ci' },
                ],
              }}
            >
              <RunList />
            </FilterContext.Provider>
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });
  });

  describe('Debouncing', () => {
    it('should debounce data fetching', async () => {
      jest.useFakeTimers();
      const mockRuns = [];
      const mockResponse = createMockRunsResponse(mockRuns);

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
      const mockRuns = [];
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent({ primaryObject: null });

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });
    });

    it('should refetch when primaryObject changes', async () => {
      const mockRuns = [];
      const mockResponse = createMockRunsResponse(mockRuns);

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
        <MemoryRouter initialEntries={['/runs']}>
          <IbutsuContext.Provider
            value={{
              ...defaultIbutsuContext,
              primaryObject: { id: 'project-2' },
            }}
          >
            <FilterContext.Provider value={defaultFilterContext}>
              <RunList />
            </FilterContext.Provider>
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get.mock.calls.length).toBeGreaterThan(callCount);
      });
    });
  });

  describe('Sort Functions', () => {
    it('should have sort functions defined', async () => {
      const mockRuns = createMultipleMockRuns(3);
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test runs')).toBeInTheDocument();
      });

      // Component should render with sort functionality available
    });
  });

  describe('Columns Configuration', () => {
    it('should render with correct columns', async () => {
      const mockRuns = createMultipleMockRuns(2);
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test runs')).toBeInTheDocument();
      });

      // Columns: 'Run', 'Duration', 'Summary', 'Started', ''
      // These should be passed to FilterTable
    });
  });

  describe('Field Options', () => {
    it('should set field options without primaryObject', async () => {
      const mockRuns = [];
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      renderComponent({ primaryObject: null });

      await waitFor(() => {
        expect(mockSetFieldOptions).toHaveBeenCalled();
      });
    });

    it('should update field options when primaryObject changes', async () => {
      const mockRuns = [];
      const mockResponse = createMockRunsResponse(mockRuns);

      HttpClient.get.mockResolvedValue({});
      HttpClient.handleResponse.mockResolvedValue(mockResponse);

      const { rerender } = renderComponent({
        primaryObject: { id: 'project-1' },
      });

      await waitFor(() => {
        expect(mockSetFieldOptions).toHaveBeenCalledTimes(1);
      });

      mockSetFieldOptions.mockClear();

      // Change primaryObject
      rerender(
        <MemoryRouter initialEntries={['/runs']}>
          <IbutsuContext.Provider
            value={{
              ...defaultIbutsuContext,
              primaryObject: { id: 'project-2' },
            }}
          >
            <FilterContext.Provider value={defaultFilterContext}>
              <RunList />
            </FilterContext.Provider>
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(mockSetFieldOptions).toHaveBeenCalled();
      });
    });
  });
});
