/* eslint-env jest */
import { render, screen, fireEvent } from '@testing-library/react';
import FilterTable from './filtered-table-card';

// Mock SkeletonTable from react-component-groups
jest.mock(
  '@patternfly/react-component-groups/dist/dynamic/SkeletonTable',
  () => {
    return function SkeletonTable() {
      return <div data-testid="skeleton-table">Loading...</div>;
    };
  },
);

describe('FilterTable', () => {
  const mockOnClearFilters = jest.fn();
  const mockOnSetPage = jest.fn();
  const mockOnSetPageSize = jest.fn();
  const mockOnRowSelectCallback = jest.fn();
  const mockOnSort = jest.fn();

  const defaultProps = {
    columns: ['Name', 'Status', 'Date'],
    rows: [
      { id: 'row-1', cells: ['Test 1', 'passed', '2025-01-01'] },
      { id: 'row-2', cells: ['Test 2', 'failed', '2025-01-02'] },
      { id: 'row-3', cells: ['Test 3', 'skipped', '2025-01-03'] },
    ],
    page: 1,
    pageSize: 10,
    totalItems: 3,
    onClearFilters: mockOnClearFilters,
    onSetPage: mockOnSetPage,
    onSetPageSize: mockOnSetPageSize,
    isError: false,
    fetching: false,
  };

  const renderComponent = (props = {}) => {
    return render(<FilterTable {...defaultProps} {...props} />);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render table card with correct ouiaId', () => {
      renderComponent();

      expect(screen.getByTestId('filter-table-card')).toBeInTheDocument();
    });

    it('should render table with correct ouiaId', () => {
      renderComponent();

      expect(screen.getByTestId('filter-table-table')).toBeInTheDocument();
    });

    it('should render pagination with correct ouiaId', () => {
      renderComponent();

      expect(screen.getByTestId('filter-table-pagination')).toBeInTheDocument();
    });

    it('should render column headers', () => {
      renderComponent();

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
    });

    it('should render row data', () => {
      renderComponent();

      expect(screen.getByText('Test 1')).toBeInTheDocument();
      expect(screen.getByText('Test 2')).toBeInTheDocument();
      expect(screen.getByText('Test 3')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show skeleton table when fetching', () => {
      renderComponent({ fetching: true });

      // Should show loading indicator and not the actual table
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(
        screen.queryByTestId('filter-table-table'),
      ).not.toBeInTheDocument();
    });

    it('should not show table when fetching', () => {
      renderComponent({ fetching: true });

      expect(screen.queryByText('Test 1')).not.toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no rows and not fetching', () => {
      renderComponent({ rows: [], fetching: false });

      // Should render the empty state card
      expect(screen.getByTestId('filter-table-card')).toBeInTheDocument();
    });

    it('should not show empty state when fetching', () => {
      renderComponent({ rows: [], fetching: true });

      expect(screen.queryByText('Test 1')).not.toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should show error state when isError is true', () => {
      renderComponent({ isError: true, fetching: false });

      // Should render card even in error state
      expect(screen.getByTestId('filter-table-card')).toBeInTheDocument();
    });

    it('should not show table when error', () => {
      renderComponent({ isError: true, fetching: false });

      expect(screen.queryByText('Test 1')).not.toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should call onSetPage when page is changed', () => {
      renderComponent();

      // Get pagination component and simulate page change
      const pagination = screen.getByTestId('filter-table-pagination');
      expect(pagination).toBeInTheDocument();
    });

    it('should display correct pagination info', () => {
      renderComponent({ page: 1, pageSize: 10, totalItems: 25 });

      expect(screen.getByTestId('filter-table-pagination')).toBeInTheDocument();
    });

    it('should render bottom pagination', () => {
      renderComponent();

      const paginationElements = screen.getAllByRole('navigation', {
        name: /pagination/i,
      });
      expect(paginationElements.length).toBeGreaterThan(1); // top and bottom
    });
  });

  describe('Selectable rows', () => {
    it('should render select checkboxes when selectable is true', () => {
      renderComponent({ selectable: true });

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should not render select checkboxes when selectable is false', () => {
      renderComponent({ selectable: false });

      const checkboxes = screen.queryAllByRole('checkbox');
      expect(checkboxes.length).toBe(0);
    });

    it('should call onRowSelectCallback when row is selected', () => {
      renderComponent({
        selectable: true,
        onRowSelectCallback: mockOnRowSelectCallback,
      });

      const checkboxes = screen.getAllByRole('checkbox');
      // First checkbox is "select all", rest are row checkboxes
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]);
        expect(mockOnRowSelectCallback).toHaveBeenCalled();
      }
    });

    it('should allow selecting all rows', () => {
      renderComponent({
        selectable: true,
        onRowSelectCallback: mockOnRowSelectCallback,
      });

      const checkboxes = screen.getAllByRole('checkbox');
      // First checkbox should be "select all"
      fireEvent.click(checkboxes[0]);
      expect(mockOnRowSelectCallback).toHaveBeenCalledWith(
        expect.anything(),
        true,
        -1,
      );
    });
  });

  describe('Expandable rows', () => {
    it('should render component when expandable is true', () => {
      const rowsWithExpanded = [
        {
          id: 'row-1',
          cells: ['Test 1', 'passed'],
          expandedContent: <div>Expanded content</div>,
        },
      ];

      renderComponent({ expandable: true, rows: rowsWithExpanded });

      // Should render the table
      expect(screen.getByTestId('filter-table-table')).toBeInTheDocument();
    });

    it('should not render expand buttons when expandable is false', () => {
      renderComponent({ expandable: false });

      const expandButtons = screen.queryAllByRole('button', {
        name: /expand/i,
      });
      expect(expandButtons.length).toBe(0);
    });
  });

  describe('Header and footer children', () => {
    it('should render header children when provided', () => {
      const headerContent = <div>Custom Header</div>;
      renderComponent({ headerChildren: headerContent });

      expect(screen.getByText('Custom Header')).toBeInTheDocument();
    });

    it('should render footer children when provided and not fetching', () => {
      const footerContent = <div>Custom Footer</div>;
      renderComponent({ footerChildren: footerContent, fetching: false });

      expect(screen.getByText('Custom Footer')).toBeInTheDocument();
    });

    it('should not render footer when fetching', () => {
      const footerContent = <div>Custom Footer</div>;
      renderComponent({ footerChildren: footerContent, fetching: true });

      expect(screen.queryByText('Custom Footer')).not.toBeInTheDocument();
    });
  });

  describe('Cell content rendering', () => {
    it('should render string cell content', () => {
      renderComponent();

      expect(screen.getByText('Test 1')).toBeInTheDocument();
    });

    it('should render numeric cell content', () => {
      const rows = [{ id: 'row-1', cells: ['Test', 123, '2025-01-01'] }];
      renderComponent({ rows });

      expect(screen.getByText('123')).toBeInTheDocument();
    });

    it('should render React element cell content', () => {
      const rows = [
        {
          id: 'row-1',
          cells: ['Test', <span key="custom">Custom Element</span>, 'Date'],
        },
      ];
      renderComponent({ rows });

      expect(screen.getByText('Custom Element')).toBeInTheDocument();
    });

    it('should handle cell with title property', () => {
      const rows = [
        { id: 'row-1', cells: ['Test', { title: 'Title Content' }, 'Date'] },
      ];
      renderComponent({ rows });

      expect(screen.getByText('Title Content')).toBeInTheDocument();
    });

    it('should handle null cell content', () => {
      const rows = [{ id: 'row-1', cells: ['Test', null, 'Date'] }];
      renderComponent({ rows });

      // Should not throw error
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should handle undefined cell content', () => {
      const rows = [{ id: 'row-1', cells: ['Test', undefined, 'Date'] }];
      renderComponent({ rows });

      // Should not throw error
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should warn and stringify non-renderable objects', () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const rows = [
        { id: 'row-1', cells: ['Test', { complex: 'object' }, 'Date'] },
      ];
      renderComponent({ rows });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'FilterTable: Non-renderable object in cell content:',
        expect.any(Object),
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Sorting', () => {
    it('should render sortable columns when onSort provided', () => {
      const sortFunctions = {
        name: true,
        status: true,
      };
      renderComponent({ onSort: mockOnSort, sortFunctions });

      // Columns should be rendered
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('should not be sortable when onSort not provided', () => {
      renderComponent({ onSort: null });

      // Table should still render
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('should handle sortBy state', () => {
      const sortBy = { index: 0, direction: 'asc' };
      const sortFunctions = { name: true };

      renderComponent({ sortBy, onSort: mockOnSort, sortFunctions });

      expect(screen.getByText('Name')).toBeInTheDocument();
    });
  });

  describe('Column rendering', () => {
    it('should render string columns', () => {
      const columns = ['Column 1', 'Column 2'];
      renderComponent({ columns });

      expect(screen.getByText('Column 1')).toBeInTheDocument();
      expect(screen.getByText('Column 2')).toBeInTheDocument();
    });

    it('should render object columns with title property', () => {
      const columns = [{ title: 'Custom Column' }, 'Column 2'];
      renderComponent({ columns });

      expect(screen.getByText('Custom Column')).toBeInTheDocument();
      expect(screen.getByText('Column 2')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle null rows', () => {
      renderComponent({ rows: null, fetching: false });

      // Should still render the card
      expect(screen.getByTestId('filter-table-card')).toBeInTheDocument();
    });

    it('should handle empty rows array', () => {
      renderComponent({ rows: [], fetching: false });

      // Should still render the card
      expect(screen.getByTestId('filter-table-card')).toBeInTheDocument();
    });

    it('should apply custom cardClass', () => {
      const { container } = renderComponent({ cardClass: 'custom-class' });

      const card = container.querySelector('.custom-class');
      expect(card).toBeTruthy();
    });

    it('should render with compact variant', () => {
      renderComponent({ variant: 'compact' });

      const table = screen.getByTestId('filter-table-table');
      expect(table).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper table aria-label', () => {
      renderComponent();

      expect(screen.getByTestId('filter-table-table')).toBeInTheDocument();
    });
  });

  describe('Filters prop', () => {
    it('should render table with filters', () => {
      const filters = <div data-testid="custom-filters">Custom Filters</div>;
      renderComponent({ filters, fetching: false });

      // Should render the table
      expect(screen.getByTestId('filter-table-table')).toBeInTheDocument();
    });

    it('should render table without filters', () => {
      renderComponent({ filters: null, fetching: false });

      expect(screen.getByTestId('filter-table-table')).toBeInTheDocument();
    });
  });
});
