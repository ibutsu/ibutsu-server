import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminFilter from './admin-filter';
import { FilterContext } from '../contexts/filter-context';
import { STRING_OPERATIONS } from '../../constants';

describe('AdminFilter', () => {
  const mockApplyFilter = jest.fn();
  const mockOnRemoveFilter = jest.fn();
  const mockOnFieldSelect = jest.fn();
  const mockOnOperationSelect = jest.fn();
  const mockSetTextFilter = jest.fn();
  const mockSetIsFieldOpen = jest.fn();
  const mockSetIsOperationOpen = jest.fn();

  const defaultContextValue = {
    applyFilter: mockApplyFilter,
    isFieldOpen: false,
    selectedField: '',
    onFieldSelect: mockOnFieldSelect,
    isOperationOpen: false,
    operationSelection: 'eq',
    onOperationSelect: mockOnOperationSelect,
    textFilter: '',
    setIsFieldOpen: mockSetIsFieldOpen,
    setIsOperationOpen: mockSetIsOperationOpen,
    setTextFilter: mockSetTextFilter,
    filteredFieldOptions: [
      { value: 'username', children: 'Username' },
      { value: 'email', children: 'Email' },
      { value: 'is_superadmin', children: 'Is Superadmin' },
    ],
    activeFilters: [],
    onRemoveFilter: mockOnRemoveFilter,
    fieldToggle: (toggleRef) => (
      <button ref={toggleRef} onClick={() => mockSetIsFieldOpen(true)}>
        Field Toggle
      </button>
    ),
    operationToggle: (toggleRef) => (
      <button ref={toggleRef} onClick={() => mockSetIsOperationOpen(true)}>
        Operation Toggle
      </button>
    ),
  };

  const renderComponent = (contextValue = {}) => {
    const mergedContext = { ...defaultContextValue, ...contextValue };
    return render(
      <MemoryRouter>
        <FilterContext.Provider value={mergedContext}>
          <AdminFilter />
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
      expect(screen.getByTestId('admin-filter-text-input')).toBeInTheDocument();
      expect(
        screen.getByTestId('admin-filter-apply-button'),
      ).toBeInTheDocument();
    });

    it('should render text input with correct ouiaId', () => {
      renderComponent();
      expect(screen.getByTestId('admin-filter-text-input')).toBeInTheDocument();
    });

    it('should render apply filter button', () => {
      renderComponent();
      expect(
        screen.getByTestId('admin-filter-apply-button'),
      ).toBeInTheDocument();
    });
  });

  describe('Field selection', () => {
    it('should display field options when select is opened', () => {
      renderComponent({ isFieldOpen: true });

      expect(screen.getByText('Username')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Is Superadmin')).toBeInTheDocument();
    });

    it('should call onFieldSelect when a field is selected', () => {
      renderComponent({ isFieldOpen: true });

      const option = screen.getByText('Username');
      fireEvent.click(option);

      expect(mockOnFieldSelect).toHaveBeenCalled();
    });
  });

  describe('Operation selection', () => {
    it('should display operation options when select is opened', () => {
      renderComponent({ isOperationOpen: true });

      Object.keys(STRING_OPERATIONS).forEach((key) => {
        expect(
          screen.getByText(STRING_OPERATIONS[key].opString),
        ).toBeInTheDocument();
      });
    });

    it('should call onOperationSelect when an operation is selected', () => {
      renderComponent({ isOperationOpen: true });

      const firstOperation =
        STRING_OPERATIONS[Object.keys(STRING_OPERATIONS)[0]];
      const option = screen.getByText(firstOperation.opString);
      fireEvent.click(option);

      expect(mockOnOperationSelect).toHaveBeenCalled();
    });
  });

  describe('Text input', () => {
    it('should display the current text filter value', () => {
      renderComponent({ textFilter: 'test-value' });

      const input = screen.getByTestId('admin-filter-text-input');
      expect(input).toHaveValue('test-value');
    });

    it('should call setTextFilter when text is entered', () => {
      renderComponent();

      const input = screen.getByTestId('admin-filter-text-input');
      fireEvent.change(input, { target: { value: 'new value' } });

      expect(mockSetTextFilter).toHaveBeenCalledWith('new value');
    });

    it('should have correct placeholder text', () => {
      renderComponent();

      const input = screen.getByPlaceholderText('Type in value');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Apply filter button', () => {
    it('should call applyFilter when clicked', () => {
      renderComponent();

      const button = screen.getByTestId('admin-filter-apply-button');
      fireEvent.click(button);

      expect(mockApplyFilter).toHaveBeenCalled();
    });

    it('should display correct button text', () => {
      renderComponent();

      expect(screen.getByText('Apply Filter')).toBeInTheDocument();
    });
  });

  describe('Active filters integration', () => {
    it('should render ActiveFilters component', () => {
      renderComponent({
        activeFilters: [
          { field: 'username', operator: 'eq', value: 'testuser' },
        ],
      });

      expect(screen.getByText('username')).toBeInTheDocument();
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });

    it('should pass onRemoveFilter to ActiveFilters', () => {
      renderComponent({
        activeFilters: [
          { field: 'username', operator: 'eq', value: 'testuser' },
        ],
      });

      const removeButton = screen.getByTestId('active-filter-remove-username');
      fireEvent.click(removeButton);

      expect(mockOnRemoveFilter).toHaveBeenCalledWith('username');
    });
  });
});
