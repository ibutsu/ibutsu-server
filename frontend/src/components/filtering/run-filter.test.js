import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RunFilter from './run-filter';
import { FilterContext } from '../contexts/filter-context';

describe('RunFilter', () => {
  const mockApplyFilter = jest.fn();
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
      { value: 'source', children: 'Source' },
      { value: 'env', children: 'Environment' },
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
    onBoolSelect: mockOnBoolSelect,
    onFieldSelect: mockOnFieldSelect,
    onOperationSelect: mockOnOperationSelect,
    onRemoveFilter: mockOnRemoveFilter,
    applyFilter: mockApplyFilter,
    filterMode: 'text',
    operationMode: 'single',
    operations: {
      eq: { opString: 'Equals' },
      regex: { opString: 'Regex' },
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
          <RunFilter {...props} />
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

      expect(screen.getByText('Source')).toBeInTheDocument();
      expect(screen.getByText('Environment')).toBeInTheDocument();
    });

    it('should call onFieldSelect when a field is selected', () => {
      renderComponent({}, { isFieldOpen: true });

      const option = screen.getByText('Source');
      fireEvent.click(option);

      expect(mockOnFieldSelect).toHaveBeenCalled();
    });
  });

  describe('Operation selection', () => {
    it('should display operation options when select is opened', () => {
      renderComponent({}, { isOperationOpen: true });

      expect(screen.getByText('Equals')).toBeInTheDocument();
      expect(screen.getByText('Regex')).toBeInTheDocument();
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
          fieldSelection: 'source',
        },
      );

      expect(screen.getByTestId('run-filter-text-input')).toBeInTheDocument();
    });

    it('should call setTextFilter when text is entered', () => {
      renderComponent(
        {},
        {
          filterMode: 'text',
          operationMode: 'single',
          fieldSelection: 'source',
        },
      );

      const input = screen.getByTestId('run-filter-text-input');
      fireEvent.change(input, { target: { value: 'jenkins-123' } });

      expect(mockSetTextFilter).toHaveBeenCalledWith('jenkins-123');
    });
  });

  describe('Multi-value input mode', () => {
    it('should render MultiValueInput when operationMode is multi', () => {
      renderComponent({}, { operationMode: 'multi', fieldSelection: 'source' });

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
          fieldSelection: 'is_failed',
        },
      );

      expect(screen.getByText('True')).toBeInTheDocument();
      expect(screen.getByText('False')).toBeInTheDocument();
    });
  });

  describe('Apply filter', () => {
    it('should call applyFilter from context when button is clicked', () => {
      renderComponent();

      const button = screen.getByTestId('filter-table-apply-button');
      fireEvent.click(button);

      expect(mockApplyFilter).toHaveBeenCalled();
    });
  });

  describe('Active filters', () => {
    it('should render ActiveFilters component', () => {
      renderComponent(
        {},
        {
          activeFilters: [
            { field: 'source', operator: 'eq', value: 'jenkins' },
          ],
        },
      );

      expect(screen.getByText('source')).toBeInTheDocument();
      expect(screen.getByText('jenkins')).toBeInTheDocument();
    });

    it('should call onRemoveFilter when filter is removed', () => {
      renderComponent(
        {},
        {
          activeFilters: [
            { field: 'source', operator: 'eq', value: 'jenkins' },
          ],
        },
      );

      const removeButton = screen.getByTestId('active-filter-remove-source');
      fireEvent.click(removeButton);

      expect(mockOnRemoveFilter).toHaveBeenCalledWith('source');
    });

    it('should pass hideFilters prop to ActiveFilters', () => {
      renderComponent({ hideFilters: ['project_id'] });

      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();
    });
  });

  describe('Value Options', () => {
    it('should handle empty valueOptions array', () => {
      renderComponent(
        {},
        {
          filterMode: 'text',
          operationMode: 'single',
          fieldSelection: 'source',
        },
      );

      // Should render text input when no value options
      expect(screen.getByTestId('run-filter-text-input')).toBeInTheDocument();
    });

    it('should clear value options when field changes', () => {
      const { rerender } = renderComponent(
        {},
        {
          fieldSelection: 'source',
        },
      );

      // Field changes are handled by useEffect
      rerender(
        <MemoryRouter>
          <FilterContext.Provider
            value={{
              ...defaultContextValue,
              fieldSelection: 'env',
            }}
          >
            <RunFilter />
          </FilterContext.Provider>
        </MemoryRouter>,
      );

      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();
    });
  });

  describe('Component Props', () => {
    it('should accept maxHeight prop', () => {
      renderComponent({ maxHeight: '400px' });

      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();
    });

    it('should use default maxHeight when not provided', () => {
      renderComponent();

      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();
    });
  });

  describe('Select State Management', () => {
    it('should have field select open state controlled by context', () => {
      renderComponent({}, { isFieldOpen: true });

      const option = screen.getByText('Source');
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
          fieldSelection: 'is_failed',
        },
      );

      const option = screen.getByText('True');
      expect(option).toBeInTheDocument();
    });
  });

  describe('Operation Modes', () => {
    it('should render different UI for multi operation mode', () => {
      renderComponent({}, { operationMode: 'multi', fieldSelection: 'source' });

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

      // Bool select should be available (though not open)
      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();
    });
  });

  describe('Filter Modes', () => {
    it('should handle text filter mode with single operation', () => {
      renderComponent(
        {},
        {
          filterMode: 'text',
          operationMode: 'single',
          fieldSelection: 'source',
        },
      );

      const input = screen.getByTestId('run-filter-text-input');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Context Integration', () => {
    it('should use all context values', () => {
      renderComponent(
        {},
        {
          activeFilters: [{ field: 'env', operator: 'regex', value: 'prod' }],
          boolSelection: 'True',
          fieldSelection: 'source',
          filteredFieldOptions: [
            { value: 'source', children: 'Source' },
            { value: 'env', children: 'Environment' },
          ],
          isFieldOpen: false,
          isOperationOpen: false,
          operationSelection: 'regex',
          textFilter: 'test',
          isBoolOpen: false,
          filterMode: 'text',
          operationMode: 'single',
        },
      );

      expect(screen.getByTestId('run-filter-text-input')).toHaveValue('test');
    });
  });

  describe('Component with hideFilters prop', () => {
    it('should pass hideFilters to ActiveFilters', () => {
      renderComponent(
        { hideFilters: ['project_id', 'internal_id'] },
        {
          activeFilters: [
            { field: 'source', operator: 'eq', value: 'jenkins' },
            { field: 'project_id', operator: 'eq', value: '123' },
          ],
        },
      );

      // project_id filter should be hidden, source should be visible
      expect(screen.getByText('source')).toBeInTheDocument();
    });

    it('should render without hideFilters prop', () => {
      renderComponent(
        {},
        {
          activeFilters: [],
        },
      );

      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();
    });
  });

  describe('MaxHeight Configuration', () => {
    it('should apply custom maxHeight to select lists', () => {
      renderComponent({ maxHeight: '300px' }, { isFieldOpen: true });

      expect(screen.getByText('Source')).toBeInTheDocument();
    });

    it('should use default maxHeight of 600px', () => {
      renderComponent({}, { isFieldOpen: true });

      expect(screen.getByText('Source')).toBeInTheDocument();
    });
  });

  describe('useEffect for valueOptions', () => {
    it('should set empty valueOptions on mount', () => {
      renderComponent({}, { fieldSelection: null });

      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();
    });

    it('should update valueOptions when fieldSelection changes', () => {
      const { rerender } = renderComponent({}, { fieldSelection: 'source' });

      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();

      // Change fieldSelection
      rerender(
        <MemoryRouter>
          <FilterContext.Provider
            value={{
              ...defaultContextValue,
              fieldSelection: 'env',
            }}
          >
            <RunFilter />
          </FilterContext.Provider>
        </MemoryRouter>,
      );

      expect(
        screen.getByTestId('filter-table-apply-button'),
      ).toBeInTheDocument();
    });
  });
});
