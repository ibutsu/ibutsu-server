/* eslint-env jest */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResultFilter from './result-filter';
import { FilterContext } from '../contexts/filter-context';

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
  });
});
