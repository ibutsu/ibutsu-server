/* eslint-env jest */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResultFilter from './result-filter';
import { FilterContext } from '../contexts/filter-context';
import { IbutsuContext } from '../contexts/ibutsu-context';
import { HttpClient } from '../../utilities/http';

jest.mock('../../utilities/http');

describe('ResultFilter', () => {
  const mockUpdateFilters = jest.fn();
  const mockResetFilters = jest.fn();
  const mockOnRemoveFilter = jest.fn();
  const mockOnFieldSelect = jest.fn();
  const mockOnOperationSelect = jest.fn();
  const mockOnBoolSelect = jest.fn();
  const mockSetTextFilter = jest.fn();
  const mockSetInValues = jest.fn();
  const mockSetIsFieldOpen = jest.fn();
  const mockSetIsOperationOpen = jest.fn();
  const mockSetIsBoolOpen = jest.fn();

  const defaultContextValue = {
    activeFilters: [],
    boolSelection: null,
    fieldSelection: null,
    filteredFieldOptions: [
      { value: 'test_id', children: 'Test ID' },
      { value: 'result', children: 'Result' },
      { value: 'metadata.browser', children: 'Browser' },
    ],
    setInValues: mockSetInValues,
    isFieldOpen: false,
    setIsFieldOpen: mockSetIsFieldOpen,
    isOperationOpen: false,
    setIsOperationOpen: mockSetIsOperationOpen,
    operationSelection: 'eq',
    textFilter: '',
    setTextFilter: mockSetTextFilter,
    isBoolOpen: false,
    setIsBoolOpen: mockSetIsBoolOpen,
    inValues: [],
    onBoolSelect: mockOnBoolSelect,
    onFieldSelect: mockOnFieldSelect,
    onOperationSelect: mockOnOperationSelect,
    onRemoveFilter: mockOnRemoveFilter,
    updateFilters: mockUpdateFilters,
    resetFilters: mockResetFilters,
    filterMode: 'text',
    operationMode: 'single',
    operations: {
      eq: { opString: 'Equals' },
      regex: { opString: 'Regex' },
      exists: { opString: 'Exists' },
    },
    fieldToggle: (toggleRef) => <button ref={toggleRef}>Field Toggle</button>,
    operationToggle: (toggleRef) => (
      <button ref={toggleRef}>Operation Toggle</button>
    ),
    boolToggle: (toggleRef) => <button ref={toggleRef}>Bool Toggle</button>,
  };

  const defaultIbutsuContext = {
    primaryObject: { id: 'test-project-id' },
  };

  const renderComponent = (
    props = {},
    contextValue = {},
    ibutsuContext = {},
  ) => {
    const mergedContext = { ...defaultContextValue, ...contextValue };
    const mergedIbutsuContext = { ...defaultIbutsuContext, ...ibutsuContext };
    return render(
      <MemoryRouter>
        <IbutsuContext.Provider value={mergedIbutsuContext}>
          <FilterContext.Provider value={mergedContext}>
            <ResultFilter {...props} />
          </FilterContext.Provider>
        </IbutsuContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    if (HttpClient.get.mock) {
      HttpClient.get.mockResolvedValue({ ok: true, json: () => [] });
      HttpClient.handleResponse.mockResolvedValue([]);
    }
  });

  describe('Basic Rendering and Interaction', () => {
    it('should render with apply filter button', () => {
      renderComponent();
      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();
    });

    it('should display field options when field select is opened', () => {
      renderComponent({}, { isFieldOpen: true });
      expect(screen.getByText('Test ID')).toBeInTheDocument();
      expect(screen.getByText('Result')).toBeInTheDocument();
    });

    it('should call onFieldSelect when a field is selected', () => {
      renderComponent({}, { isFieldOpen: true });
      fireEvent.click(screen.getByText('Test ID'));
      expect(mockOnFieldSelect).toHaveBeenCalled();
    });

    it('should display operation options when operation select is opened', () => {
      renderComponent({}, { isOperationOpen: true });
      expect(screen.getByText('Equals')).toBeInTheDocument();
      expect(screen.getByText('Regex')).toBeInTheDocument();
    });

    it('should call onOperationSelect when an operation is selected', () => {
      renderComponent({}, { isOperationOpen: true });
      fireEvent.click(screen.getByText('Equals'));
      expect(mockOnOperationSelect).toHaveBeenCalled();
    });
  });

  describe('Filter Modes and Input Types', () => {
    describe('Text Filter Mode', () => {
      it('should render text input for single mode with non-metadata field', () => {
        renderComponent(
          {},
          {
            filterMode: 'text',
            operationMode: 'single',
            fieldSelection: 'test_id',
          },
        );
        expect(
          screen.getByTestId('result-filter-text-input'),
        ).toBeInTheDocument();
      });

      it('should call setTextFilter when text is entered', () => {
        renderComponent(
          {},
          {
            filterMode: 'text',
            operationMode: 'single',
            fieldSelection: 'test_id',
          },
        );
        const input = screen.getByTestId('result-filter-text-input');
        fireEvent.change(input, { target: { value: 'test value' } });
        expect(mockSetTextFilter).toHaveBeenCalledWith('test value');
      });

      it('should render MultiValueInput for multi mode without value options', () => {
        renderComponent(
          {},
          {
            filterMode: 'text',
            operationMode: 'multi',
            fieldSelection: 'test_id',
          },
        );
        expect(
          screen.getByPlaceholderText(/type any value/i),
        ).toBeInTheDocument();
      });
    });

    describe('Boolean Filter Mode', () => {
      it('should display True and False options when bool select is opened', () => {
        renderComponent(
          {},
          {
            operationMode: 'bool',
            isBoolOpen: true,
            fieldSelection: 'is_active',
          },
        );
        expect(screen.getByText('True')).toBeInTheDocument();
        expect(screen.getByText('False')).toBeInTheDocument();
      });
    });

    describe('Run Filter Mode', () => {
      it('should render run select for single mode', () => {
        renderComponent(
          { runs: ['run-1', 'run-2', 'run-3'] },
          {
            filterMode: 'run',
            operationMode: 'single',
            fieldSelection: 'run_id',
          },
        );
        expect(
          screen.getByTestId('filter-table-apply-button'),
        ).toBeInTheDocument();
      });

      it('should render run multi-select for multi mode', () => {
        renderComponent(
          { runs: ['run-1', 'run-2'] },
          {
            filterMode: 'run',
            operationMode: 'multi',
            fieldSelection: 'run_id',
          },
        );
        expect(
          screen.getByTestId('filter-table-apply-button'),
        ).toBeInTheDocument();
      });
    });

    describe('Result State Filter Mode', () => {
      it('should render result select for single mode', () => {
        renderComponent(
          {},
          {
            filterMode: 'result',
            operationMode: 'single',
            fieldSelection: 'result',
          },
        );
        expect(
          screen.getByTestId('filter-table-apply-button'),
        ).toBeInTheDocument();
      });

      it('should render result multi-select for multi mode', () => {
        renderComponent(
          {},
          {
            filterMode: 'result',
            operationMode: 'multi',
            fieldSelection: 'result',
          },
        );
        expect(
          screen.getByTestId('filter-table-apply-button'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Apply Filter Behavior', () => {
    it('should not apply filter when fieldSelection is empty', () => {
      renderComponent({}, { fieldSelection: null, textFilter: 'some value' });
      fireEvent.click(screen.getByTestId('filter-table-apply-button'));
      expect(mockUpdateFilters).not.toHaveBeenCalled();
    });

    it('should not apply filter when value is empty', () => {
      renderComponent({}, { fieldSelection: 'test_id', textFilter: '' });
      fireEvent.click(screen.getByTestId('filter-table-apply-button'));
      expect(mockUpdateFilters).not.toHaveBeenCalled();
    });

    it('should not apply filter with whitespace-only text', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'test_id',
          textFilter: '   ',
          operationMode: 'single',
          filterMode: 'text',
        },
      );
      fireEvent.click(screen.getByTestId('filter-table-apply-button'));
      expect(mockUpdateFilters).not.toHaveBeenCalled();
    });

    it('should not apply filter with empty inValues array', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'test_id',
          operationMode: 'multi',
          filterMode: 'text',
          inValues: [],
        },
      );
      fireEvent.click(screen.getByTestId('filter-table-apply-button'));
      expect(mockUpdateFilters).not.toHaveBeenCalled();
    });
  });

  describe('Active Filters Integration', () => {
    it('should render active filters with values', () => {
      renderComponent(
        {},
        {
          activeFilters: [
            { field: 'test_id', operator: 'eq', value: 'test123' },
          ],
        },
      );
      expect(screen.getByText('test_id')).toBeInTheDocument();
      expect(screen.getByText('test123')).toBeInTheDocument();
    });

    it('should call onRemoveFilter when filter is removed', () => {
      renderComponent(
        {},
        {
          activeFilters: [
            { field: 'test_id', operator: 'eq', value: 'test123' },
          ],
        },
      );
      fireEvent.click(screen.getByTestId('active-filter-remove-test_id'));
      expect(mockOnRemoveFilter).toHaveBeenCalledWith('test_id');
    });
  });

  describe('Dynamic Metadata Values - API Integration', () => {
    it('should fetch metadata values with for_filter=true and days=365', async () => {
      HttpClient.get.mockReturnValue(
        Promise.resolve({ ok: true, json: () => [] }),
      );
      HttpClient.handleResponse.mockReturnValue([]);

      renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'single',
        },
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ days: 365, for_filter: true }),
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
      });
    });

    it('should not fetch values for non-metadata fields', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'test_id',
          filterMode: 'text',
          operationMode: 'single',
        },
      );
      expect(HttpClient.get).not.toHaveBeenCalled();
    });

    it('should include additional_filters when activeFilters exist', async () => {
      HttpClient.get.mockReturnValue(
        Promise.resolve({ ok: true, json: () => [] }),
      );
      HttpClient.handleResponse.mockReturnValue([]);

      renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'single',
          activeFilters: [
            { field: 'result', operator: 'eq', value: 'passed' },
            { field: 'test_id', operator: 'regex', value: 'login' },
          ],
        },
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            days: 365,
            for_filter: true,
            additional_filters: 'result=passed,test_id~login',
          }),
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
      });
    });

    it('should not include additional_filters when activeFilters is empty', async () => {
      HttpClient.get.mockReturnValue(
        Promise.resolve({ ok: true, json: () => [] }),
      );
      HttpClient.handleResponse.mockReturnValue([]);

      renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'single',
          activeFilters: [],
        },
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          expect.anything(),
          expect.not.objectContaining({
            additional_filters: expect.anything(),
          }),
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
      });
    });

    it('should refetch values when activeFilters change', async () => {
      HttpClient.get.mockReturnValue(
        Promise.resolve({ ok: true, json: () => [] }),
      );
      HttpClient.handleResponse.mockReturnValue([]);

      const { rerender } = renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'single',
          activeFilters: [{ field: 'result', operator: 'eq', value: 'passed' }],
        },
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledTimes(1);
      });

      rerender(
        <MemoryRouter>
          <IbutsuContext.Provider value={defaultIbutsuContext}>
            <FilterContext.Provider
              value={{
                ...defaultContextValue,
                fieldSelection: 'metadata.browser',
                filterMode: 'text',
                operationMode: 'single',
                activeFilters: [
                  { field: 'result', operator: 'eq', value: 'failed' },
                ],
              }}
            >
              <ResultFilter />
            </FilterContext.Provider>
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledTimes(2);
      });
    });

    it('should abort previous request when field selection changes', async () => {
      HttpClient.get.mockReturnValue(
        Promise.resolve({ ok: true, json: () => [] }),
      );
      HttpClient.handleResponse.mockReturnValue([]);

      const { rerender } = renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'single',
        },
      );

      rerender(
        <MemoryRouter>
          <IbutsuContext.Provider value={defaultIbutsuContext}>
            <FilterContext.Provider
              value={{
                ...defaultContextValue,
                fieldSelection: 'metadata.component',
                filterMode: 'text',
                operationMode: 'single',
              }}
            >
              <ResultFilter />
            </FilterContext.Provider>
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        const { calls } = HttpClient.get.mock;
        expect(calls.length).toBeGreaterThanOrEqual(1);
        calls.forEach((call) => {
          expect(call[2]).toHaveProperty('signal');
        });
      });
    });

    it('should display error message when fetch fails', async () => {
      HttpClient.get.mockReturnValue(Promise.reject(new Error('Fetch failed')));

      renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'single',
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading values')).toBeInTheDocument();
      });
    });

    it('should handle AbortError silently without logging', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      HttpClient.get.mockReturnValue(Promise.reject(abortError));

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'single',
        },
      );

      await waitFor(() => {
        expect(consoleErrorSpy).not.toHaveBeenCalledWith(
          'Error fetching dynamic values:',
          expect.anything(),
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Value Options Conditional Rendering by Operator', () => {
    beforeEach(() => {
      HttpClient.get.mockReturnValue(
        Promise.resolve({ ok: true, json: () => [] }),
      );
      HttpClient.handleResponse.mockReturnValue([
        { _id: 'chrome', count: 10 },
        { _id: 'firefox', count: 5 },
      ]);
    });

    it('should not render value select for regex operator', async () => {
      const { container } = renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'single',
          operationSelection: 'regex',
        },
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });

      expect(
        screen.getByTestId('result-filter-text-input'),
      ).toBeInTheDocument();
      expect(container.querySelector('#value-select')).not.toBeInTheDocument();
    });

    it('should not render value select for exists operator', async () => {
      const { container } = renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'single',
          operationSelection: 'exists',
        },
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });

      expect(container.querySelector('#value-select')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('result-filter-text-input'),
      ).not.toBeInTheDocument();
    });

    it('should not render value select when operationMode is bool', async () => {
      const { container } = renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'bool',
          operationSelection: 'eq',
        },
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });

      expect(container.querySelector('#value-select')).not.toBeInTheDocument();
    });

    it('should render text input when no valueOptions available', async () => {
      HttpClient.handleResponse.mockReturnValue([]);

      renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'single',
          operationSelection: 'eq',
        },
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });

      expect(
        screen.getByTestId('result-filter-text-input'),
      ).toBeInTheDocument();
    });

    it('should render MultiValueInput for multi mode without valueOptions', async () => {
      HttpClient.handleResponse.mockReturnValue([]);

      renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'multi',
          operationSelection: 'in',
        },
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalled();
      });

      expect(
        screen.getByPlaceholderText(/type any value/i),
      ).toBeInTheDocument();
    });
  });
});
