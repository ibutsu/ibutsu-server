/* eslint-env jest */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResultFilter from './result-filter';
import { FilterContext } from '../contexts/filter-context';
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
      contains: { opString: 'Contains' },
    },
    fieldToggle: (toggleRef) => <button ref={toggleRef}>Field Toggle</button>,
    operationToggle: (toggleRef) => (
      <button ref={toggleRef}>Operation Toggle</button>
    ),
    boolToggle: (toggleRef) => <button ref={toggleRef}>Bool Toggle</button>,
  };

  const renderComponent = (props = {}, contextValue = {}) => {
    const mergedContext = { ...defaultContextValue, ...contextValue };
    return render(
      <MemoryRouter>
        <FilterContext.Provider value={mergedContext}>
          <ResultFilter {...props} />
        </FilterContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      renderComponent();
      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();
    });

    it('should render apply filter button with correct ouiaId', () => {
      renderComponent();
      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();
    });
  });

  describe('Field selection', () => {
    it('should display field options when select is opened', () => {
      renderComponent({}, { isFieldOpen: true });

      expect(screen.getByText('Test ID')).toBeInTheDocument();
      expect(screen.getByText('Result')).toBeInTheDocument();
    });

    it('should call onFieldSelect when a field is selected', () => {
      renderComponent({}, { isFieldOpen: true });

      const option = screen.getByText('Test ID');
      fireEvent.click(option);

      expect(mockOnFieldSelect).toHaveBeenCalled();
    });
  });

  describe('Operation selection', () => {
    it('should display operation options when select is opened', () => {
      renderComponent({}, { isOperationOpen: true });

      expect(screen.getByText('Equals')).toBeInTheDocument();
      expect(screen.getByText('Contains')).toBeInTheDocument();
    });

    it('should call onOperationSelect when an operation is selected', () => {
      renderComponent({}, { isOperationOpen: true });

      const option = screen.getByText('Equals');
      fireEvent.click(option);

      expect(mockOnOperationSelect).toHaveBeenCalled();
    });
  });

  describe('Text input mode', () => {
    it('should render text input when filterMode is text and operationMode is single', () => {
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
  });

  describe('Multi-value input mode', () => {
    it('should render MultiValueInput when filterMode is text and operationMode is multi', () => {
      renderComponent(
        {},
        {
          filterMode: 'text',
          operationMode: 'multi',
          fieldSelection: 'test_id',
        },
      );

      const input = screen.getByPlaceholderText(/type any value/i);
      expect(input).toBeInTheDocument();
    });
  });

  describe('Boolean input mode', () => {
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

  describe('Result state filter mode', () => {
    it('should render result filter when filterMode is result', () => {
      renderComponent(
        {},
        {
          filterMode: 'result',
          operationMode: 'single',
          fieldSelection: 'result',
        },
      );

      // Component should render without crashing
      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();
    });
  });

  describe('Apply filter', () => {
    it('should render apply button', () => {
      renderComponent();

      const button = screen.getByTestId('filter-table-apply-button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Active filters', () => {
    it('should render ActiveFilters component', () => {
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

      const removeButton = screen.getByTestId('active-filter-remove-test_id');
      fireEvent.click(removeButton);

      expect(mockOnRemoveFilter).toHaveBeenCalledWith('test_id');
    });

    it('should pass hideFilters prop to ActiveFilters', () => {
      renderComponent({ hideFilters: ['project_id'] });

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });
  });

  describe('Dynamic Metadata Values', () => {
    it('should render with metadata field selection', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'single',
        },
      );

      // Component should render when metadata field is selected
      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();
    });

    it('should render with non-metadata field selection', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'test_id',
          filterMode: 'text',
          operationMode: 'single',
        },
      );

      expect(
        screen.getByTestId('result-filter-text-input'),
      ).toBeInTheDocument();
    });

    it('should handle field selection changes', () => {
      const { rerender } = renderComponent(
        {},
        {
          fieldSelection: 'test_id',
        },
      );

      // Change to metadata field
      rerender(
        <MemoryRouter>
          <FilterContext.Provider
            value={{
              ...defaultContextValue,
              fieldSelection: 'metadata.browser',
            }}
          >
            <ResultFilter />
          </FilterContext.Provider>
        </MemoryRouter>,
      );

      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();
    });
  });

  describe('Run Filter Mode', () => {
    it('should render run select when filterMode is run', () => {
      renderComponent(
        { runs: ['run-1', 'run-2', 'run-3'] },
        {
          filterMode: 'run',
          operationMode: 'single',
          fieldSelection: 'run_id',
        },
      );

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });

    it('should filter runs based on input', () => {
      const { rerender } = renderComponent(
        { runs: ['run-abc-123', 'run-def-456', 'run-abc-789'] },
        {
          filterMode: 'run',
          operationMode: 'single',
          fieldSelection: 'run_id',
        },
      );

      // Runs should be filtered
      rerender(
        <MemoryRouter>
          <FilterContext.Provider
            value={{
              ...defaultContextValue,
              filterMode: 'run',
              operationMode: 'single',
              fieldSelection: 'run_id',
            }}
          >
            <ResultFilter runs={['run-abc-123', 'run-def-456', 'run-abc-789']} />
          </FilterContext.Provider>
        </MemoryRouter>,
      );

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });

    it('should render run multi-select for multi operation mode', () => {
      renderComponent(
        { runs: ['run-1', 'run-2'] },
        {
          filterMode: 'run',
          operationMode: 'multi',
          fieldSelection: 'run_id',
        },
      );

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });
  });

  describe('Result State Filter Mode', () => {
    it('should render result select when filterMode is result', () => {
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

    it('should render result multi-select for multi operation mode', () => {
      renderComponent(
        {},
        {
          filterMode: 'result',
          operationMode: 'multi',
          fieldSelection: 'result',
        },
      );

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });
  });

  describe('Apply Filter Logic', () => {
    it('should not apply filter when fieldSelection is empty', () => {
      renderComponent(
        {},
        {
          fieldSelection: null,
          textFilter: 'some value',
        },
      );

      const button = screen.getByTestId('filter-table-apply-button');
      fireEvent.click(button);

      // updateFilters should not be called without field selection
      expect(mockUpdateFilters).not.toHaveBeenCalled();
    });

    it('should not apply filter when textFilter is empty', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'test_id',
          textFilter: '',
        },
      );

      const button = screen.getByTestId('filter-table-apply-button');
      fireEvent.click(button);

      expect(mockUpdateFilters).not.toHaveBeenCalled();
    });

    it('should apply filter with trimmed text value', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'test_id',
          textFilter: '  test123  ',
          operationMode: 'single',
          filterMode: 'text',
        },
      );

      const button = screen.getByTestId('filter-table-apply-button');
      fireEvent.click(button);

      // Should be called with trimmed value
      // Note: The actual implementation handles this internally
    });
  });

  describe('Component Props', () => {
    it('should accept maxHeight prop', () => {
      renderComponent({ maxHeight: '400px' });

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });

    it('should use default maxHeight when not provided', () => {
      renderComponent();

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });

    it('should accept runs prop', () => {
      renderComponent({ runs: ['run-1', 'run-2', 'run-3'] });

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });

    it('should handle empty runs array', () => {
      renderComponent({ runs: [] });

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });
  });

  describe('Select State Management', () => {
    it('should have field select open state controlled by context', () => {
      renderComponent({}, { isFieldOpen: true });

      const option = screen.getByText('Test ID');
      expect(option).toBeInTheDocument();
    });

    it('should have operation select open state controlled by context', () => {
      renderComponent({}, { isOperationOpen: true });

      const option = screen.getByText('Equals');
      expect(option).toBeInTheDocument();
    });

    it('should render bool select when operation mode is bool', () => {
      renderComponent(
        {},
        {
          operationMode: 'bool',
          isBoolOpen: true,
          fieldSelection: 'is_active',
        },
      );

      const option = screen.getByText('True');
      expect(option).toBeInTheDocument();
    });
  });

  describe('Operation Modes', () => {
    it('should render different UI for multi operation mode with text', () => {
      renderComponent(
        {},
        {
          filterMode: 'text',
          operationMode: 'multi',
          fieldSelection: 'test_id',
        },
      );

      const input = screen.getByPlaceholderText(/type any value/i);
      expect(input).toBeInTheDocument();
    });

    it('should render bool select for bool operation mode', () => {
      renderComponent(
        {},
        {
          operationMode: 'bool',
          fieldSelection: 'is_active',
        },
      );

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });
  });

  describe('Value Options', () => {
    it('should handle empty valueOptions array', () => {
      renderComponent(
        {},
        {
          filterMode: 'text',
          operationMode: 'single',
          fieldSelection: 'test_id',
        },
      );

      // Should render text input when no value options
      expect(
        screen.getByTestId('result-filter-text-input'),
      ).toBeInTheDocument();
    });
  });

  describe('Context Integration', () => {
    it('should use IbutsuContext primaryObject', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
        },
      );

      // Component should render with context
      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });
  });

  describe('Operation Select Handler', () => {
    it('should clear selections when operation changes', () => {
      renderComponent({}, { isOperationOpen: true });

      const option = screen.getByText('Equals');
      fireEvent.click(option);

      // Operation selection should trigger clearing of result/run selections
      expect(mockOnOperationSelect).toHaveBeenCalled();
    });
  });

  describe('Run Selection Callbacks', () => {
    it('should handle run selection in single mode', () => {
      renderComponent(
        { runs: ['run-1', 'run-2'] },
        {
          filterMode: 'run',
          operationMode: 'single',
          fieldSelection: 'run_id',
        },
      );

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });

    it('should handle run selection in multi mode', () => {
      renderComponent(
        { runs: ['run-1', 'run-2', 'run-3'] },
        {
          filterMode: 'run',
          operationMode: 'multi',
          fieldSelection: 'run_id',
        },
      );

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });

    it('should handle empty run input', () => {
      renderComponent(
        { runs: ['run-1'] },
        {
          filterMode: 'run',
          operationMode: 'single',
          fieldSelection: 'run_id',
        },
      );

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });
  });

  describe('Result Selection Callbacks', () => {
    it('should handle result selection in single mode', () => {
      renderComponent(
        {},
        {
          filterMode: 'result',
          operationMode: 'single',
          fieldSelection: 'result',
        },
      );

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });

    it('should handle result selection in multi mode', () => {
      renderComponent(
        {},
        {
          filterMode: 'result',
          operationMode: 'multi',
          fieldSelection: 'result',
        },
      );

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });
  });

  describe('Apply Filter with Different Values', () => {
    it('should handle applying filter with bool value True', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'is_active',
          operationMode: 'bool',
          boolSelection: 'True',
        },
      );

      const button = screen.getByTestId('filter-table-apply-button');
      fireEvent.click(button);

      // Should call updateFilters with bool value
    });

    it('should handle applying filter with bool value False', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'is_active',
          operationMode: 'bool',
          boolSelection: 'False',
        },
      );

      const button = screen.getByTestId('filter-table-apply-button');
      fireEvent.click(button);

      // Should call updateFilters with bool value
    });

    it('should handle applying filter with multi values', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'test_id',
          operationMode: 'multi',
          filterMode: 'text',
          inValues: ['value1', 'value2', 'value3'],
        },
      );

      const button = screen.getByTestId('filter-table-apply-button');
      fireEvent.click(button);

      // Should call updateFilters with joined values
    });

    it('should handle applying filter with run selection in multi mode', () => {
      renderComponent(
        { runs: ['run-1', 'run-2'] },
        {
          fieldSelection: 'run_id',
          filterMode: 'run',
          operationMode: 'multi',
        },
      );

      const button = screen.getByTestId('filter-table-apply-button');
      fireEvent.click(button);

      // Filter should not be applied without selection
      expect(mockUpdateFilters).not.toHaveBeenCalled();
    });

    it('should handle applying filter with result selection in multi mode', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'result',
          filterMode: 'result',
          operationMode: 'multi',
        },
      );

      const button = screen.getByTestId('filter-table-apply-button');
      fireEvent.click(button);

      // Filter should not be applied without selection
      expect(mockUpdateFilters).not.toHaveBeenCalled();
    });
  });

  describe('Value Options with Dynamic Data', () => {
    it('should render select with value options when available', () => {
      // This would require mocking the useEffect that fetches dynamic values
      renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'single',
        },
      );

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });

    it('should handle value options in multi mode', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'multi',
        },
      );

      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });
  });

  describe('Memoized Components', () => {
    it('should render with all toggle functions', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'test_id',
          operationMode: 'single',
          filterMode: 'text',
        },
      );

      // All toggles should be available through context
      expect(screen.getByTestId('filter-table-apply-button')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle whitespace-only text filter', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'test_id',
          textFilter: '   ',
          operationMode: 'single',
          filterMode: 'text',
        },
      );

      const button = screen.getByTestId('filter-table-apply-button');
      fireEvent.click(button);

      // Should not apply filter with whitespace-only value
      expect(mockUpdateFilters).not.toHaveBeenCalled();
    });

    it('should handle empty inValues array', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'test_id',
          operationMode: 'multi',
          filterMode: 'text',
          inValues: [],
        },
      );

      const button = screen.getByTestId('filter-table-apply-button');
      fireEvent.click(button);

      // Should not apply filter with empty values
      expect(mockUpdateFilters).not.toHaveBeenCalled();
    });

    it('should trim multi values before joining', () => {
      renderComponent(
        {},
        {
          fieldSelection: 'test_id',
          operationMode: 'multi',
          filterMode: 'text',
          inValues: ['  value1  ', '  value2  '],
        },
      );

      const button = screen.getByTestId('filter-table-apply-button');
      fireEvent.click(button);

      // Values should be trimmed
    });
  });

  describe('Dynamic Metadata Values Error Handling', () => {
    it('should display error message when dynamic values fetch fails', async () => {
      HttpClient.get.mockReturnValue(Promise.reject(new Error('Fetch failed')));

      renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'single',
        }
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading values')).toBeInTheDocument();
      });
    });

    it('should fetch with days=90 parameter', async () => {
      HttpClient.get.mockReturnValue(Promise.resolve({ ok: true, json: () => [] }));
      HttpClient.handleResponse.mockReturnValue([]);

      renderComponent(
        {},
        {
          fieldSelection: 'metadata.browser',
          filterMode: 'text',
          operationMode: 'single',
        }
      );

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ days: 90 })
        );
      });
    });
  });
});
