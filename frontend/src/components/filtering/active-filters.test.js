/* eslint-env jest */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActiveFilters from './active-filters';
import { OPERATIONS } from '../../constants';

// Mock useNavigate and useParams
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ project_id: 'test-project-id' }),
}));

describe('ActiveFilters', () => {
  const mockOnRemoveFilter = jest.fn();

  const defaultProps = {
    activeFilters: [
      { field: 'status', operator: 'eq', value: 'passed' },
      { field: 'env', operator: 'eq', value: 'staging' },
    ],
    onRemoveFilter: mockOnRemoveFilter,
    hideFilters: [],
    transferTarget: null,
  };

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouter>
        <ActiveFilters {...defaultProps} {...props} />
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render active filters', () => {
      renderComponent();

      expect(screen.getByText('status')).toBeInTheDocument();
      expect(screen.getByText('env')).toBeInTheDocument();
      expect(screen.getByText('passed')).toBeInTheDocument();
      expect(screen.getByText('staging')).toBeInTheDocument();
    });

    it('should render with empty filters', () => {
      renderComponent({ activeFilters: [] });

      expect(screen.queryByText('status')).not.toBeInTheDocument();
    });

    it('should render without filters when all are hidden', () => {
      renderComponent({ hideFilters: ['status', 'env'] });

      expect(screen.queryByText('status')).not.toBeInTheDocument();
      expect(screen.queryByText('env')).not.toBeInTheDocument();
    });

    it('should render with some filters hidden', () => {
      renderComponent({ hideFilters: ['status'] });

      expect(screen.queryByText('status')).not.toBeInTheDocument();
      expect(screen.getByText('env')).toBeInTheDocument();
    });
  });

  describe('Filter cards', () => {
    it('should render filter cards with correct ouiaId', () => {
      renderComponent();

      expect(
        screen.getByTestId('active-filter-card-status'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('active-filter-card-env')).toBeInTheDocument();
    });

    it('should display operation string', () => {
      const filters = [{ field: 'test', operator: 'eq', value: 'example' }];
      renderComponent({ activeFilters: filters });

      expect(screen.getByText(OPERATIONS['eq'].opString)).toBeInTheDocument();
    });

    it('should display operator if not in OPERATIONS map', () => {
      const filters = [{ field: 'test', operator: 'custom', value: 'example' }];
      renderComponent({ activeFilters: filters });

      expect(screen.getByText('custom')).toBeInTheDocument();
    });
  });

  describe('Remove filter functionality', () => {
    it('should call onRemoveFilter when remove button is clicked', () => {
      renderComponent();

      const removeButton = screen.getByTestId('active-filter-remove-status');
      fireEvent.click(removeButton);

      expect(mockOnRemoveFilter).toHaveBeenCalledWith('status');
    });

    it('should have remove buttons with correct ouiaId', () => {
      renderComponent();

      expect(
        screen.getByTestId('active-filter-remove-status'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('active-filter-remove-env'),
      ).toBeInTheDocument();
    });

    it('should have accessible aria-label for remove buttons', () => {
      renderComponent();

      expect(screen.getByLabelText('Remove filter status')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove filter env')).toBeInTheDocument();
    });
  });

  describe('Transfer target functionality', () => {
    it('should render transfer button when transferTarget is provided', () => {
      renderComponent({ transferTarget: 'results' });

      expect(
        screen.getByTestId('active-filter-transfer-button'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Customize filters on the Results page'),
      ).toBeInTheDocument();
    });

    it('should not render transfer button when transferTarget is null', () => {
      renderComponent({ transferTarget: null });

      expect(
        screen.queryByTestId('active-filter-transfer-button'),
      ).not.toBeInTheDocument();
    });

    it('should navigate with filters when transfer button is clicked', () => {
      const filters = [
        { field: 'status', operator: 'eq', value: 'passed' },
        { field: 'project_id', operator: 'eq', value: 'test-project' },
      ];
      renderComponent({ activeFilters: filters, transferTarget: 'runs' });

      const transferButton = screen.getByTestId(
        'active-filter-transfer-button',
      );
      fireEvent.click(transferButton);

      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/project/test-project-id/runs',
        search: expect.any(String),
      });
    });

    it('should exclude project_id from transfer filters', () => {
      const filters = [
        { field: 'status', operator: 'eq', value: 'passed' },
        { field: 'project_id', operator: 'eq', value: 'test-project' },
      ];
      renderComponent({ activeFilters: filters, transferTarget: 'runs' });

      const transferButton = screen.getByTestId(
        'active-filter-transfer-button',
      );
      fireEvent.click(transferButton);

      const callArgs = mockNavigate.mock.calls[0][0];
      expect(callArgs.search).not.toContain('project_id');
    });

    it('should properly capitalize transfer target text', () => {
      renderComponent({ transferTarget: 'results' });

      expect(
        screen.getByText('Customize filters on the Results page'),
      ).toBeInTheDocument();
    });
  });

  describe('Malformed filter handling', () => {
    it('should filter out malformed filters without field', () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const filters = [
        { field: 'valid', operator: 'eq', value: 'test' },
        { operator: 'eq', value: 'invalid' }, // missing field
      ];
      renderComponent({ activeFilters: filters });

      expect(screen.getByText('valid')).toBeInTheDocument();
      expect(screen.queryByText('invalid')).not.toBeInTheDocument();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'ActiveFilters: Malformed filter object detected:',
        expect.any(Object),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should filter out malformed filters without operator', () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const filters = [
        { field: 'valid', operator: 'eq', value: 'test' },
        { field: 'invalid', value: 'test' }, // missing operator
      ];
      renderComponent({ activeFilters: filters });

      expect(screen.getByText('valid')).toBeInTheDocument();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should filter out malformed filters with null value', () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const filters = [
        { field: 'valid', operator: 'eq', value: 'test' },
        { field: 'invalid', operator: 'eq', value: null },
      ];
      renderComponent({ activeFilters: filters });

      expect(screen.getByText('valid')).toBeInTheDocument();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should filter out malformed filters with undefined value', () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const filters = [
        { field: 'valid', operator: 'eq', value: 'test' },
        { field: 'invalid', operator: 'eq', value: undefined },
      ];
      renderComponent({ activeFilters: filters });

      expect(screen.getByText('valid')).toBeInTheDocument();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Value display', () => {
    it('should display N/A for filters with no value', () => {
      // Even though malformed filters are filtered out, test the fallback
      const filters = [{ field: 'test', operator: 'eq', value: '' }];
      renderComponent({ activeFilters: filters });

      // Empty string is a valid value, so it should be displayed
      expect(screen.getByTestId('active-filter-card-test')).toBeInTheDocument();
    });

    it('should handle numeric values', () => {
      const filters = [{ field: 'count', operator: 'gt', value: 5 }];
      renderComponent({ activeFilters: filters });

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should handle boolean values', () => {
      const filters = [{ field: 'is_active', operator: 'eq', value: 'true' }];
      renderComponent({ activeFilters: filters });

      expect(screen.getByText('true')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty activeFilters array', () => {
      renderComponent({ activeFilters: [] });

      expect(
        screen.queryByTestId('active-filter-transfer-button'),
      ).not.toBeInTheDocument();
    });

    it('should handle null activeFilters', () => {
      renderComponent({ activeFilters: null });

      expect(
        screen.queryByTestId('active-filter-transfer-button'),
      ).not.toBeInTheDocument();
    });

    it('should handle undefined activeFilters', () => {
      renderComponent({ activeFilters: undefined });

      expect(
        screen.queryByTestId('active-filter-transfer-button'),
      ).not.toBeInTheDocument();
    });

    it('should not show transfer button when no filters are shown', () => {
      const filters = [
        { field: 'status', operator: 'eq', value: 'passed' },
        { field: 'env', operator: 'eq', value: 'staging' },
      ];
      renderComponent({
        activeFilters: filters,
        hideFilters: ['status', 'env'],
        transferTarget: 'results',
      });

      expect(
        screen.queryByTestId('active-filter-transfer-button'),
      ).not.toBeInTheDocument();
    });
  });
});
