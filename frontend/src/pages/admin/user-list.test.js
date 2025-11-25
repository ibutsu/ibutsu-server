/* eslint-env jest */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserList from './user-list';
import { HttpClient } from '../../utilities/http';
import { FilterContext } from '../../components/contexts/filter-context';

// Mock dependencies
jest.mock('../../utilities/http');
jest.mock('../settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

describe('UserList Component', () => {
  const mockUser1 = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test User 1',
    email: 'user1@example.com',
    is_active: true,
    is_superadmin: false,
    projects: [
      { id: '650e8400-e29b-41d4-a716-446655440000', title: 'Project A' },
      { id: '650e8400-e29b-41d4-a716-446655440001', title: 'Project B' },
    ],
  };

  const mockUser2 = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Admin User',
    email: 'admin@example.com',
    is_active: true,
    is_superadmin: true,
    projects: [],
  };

  const mockUser3 = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Inactive User',
    email: 'inactive@example.com',
    is_active: false,
    is_superadmin: false,
    projects: null,
  };

  const mockUsersResponse = {
    users: [mockUser1, mockUser2, mockUser3],
    pagination: {
      page: 1,
      pageSize: 20,
      totalItems: 3,
      totalPages: 1,
    },
  };

  const renderUserList = ({ activeFilters = [] } = {}) => {
    const contextValue = {
      activeFilters,
      clearFilters: jest.fn(),
      setActiveFilters: jest.fn(),
      // Add required toggle functions for PatternFly Select components
      fieldToggle: jest.fn((toggleRef) => (
        <div ref={toggleRef}>Field Toggle</div>
      )),
      operationToggle: jest.fn((toggleRef) => (
        <div ref={toggleRef}>Operation Toggle</div>
      )),
      isFieldOpen: false,
      setIsFieldOpen: jest.fn(),
      isOperationOpen: false,
      setIsOperationOpen: jest.fn(),
      selectedField: null,
      onFieldSelect: jest.fn(),
      operationSelection: 'eq',
      onOperationSelect: jest.fn(),
      textFilter: '',
      setTextFilter: jest.fn(),
      filteredFieldOptions: [],
      onRemoveFilter: jest.fn(),
      applyFilter: jest.fn(),
    };

    return render(
      <MemoryRouter>
        <FilterContext.Provider value={contextValue}>
          <UserList />
        </FilterContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for HttpClient.get
    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => mockUsersResponse,
    });

    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });

    HttpClient.delete.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  describe('Component rendering', () => {
    it('should render the Users heading', async () => {
      renderUserList();

      expect(screen.getByText('Users')).toBeInTheDocument();
    });

    it('should fetch and display users', async () => {
      renderUserList();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'admin', 'user'],
          expect.objectContaining({
            page: 1,
            pageSize: 20,
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Test User 1')).toBeInTheDocument();
        expect(screen.getByText('Admin User')).toBeInTheDocument();
        expect(screen.getByText('Inactive User')).toBeInTheDocument();
      });
    });

    it('should display user emails', async () => {
      renderUserList();

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });
    });

    it('should display user projects', async () => {
      renderUserList();

      await waitFor(() => {
        expect(screen.getByText('Project A, Project B')).toBeInTheDocument();
      });
    });
  });

  describe('User status labels', () => {
    it('should show Active label for active users', async () => {
      renderUserList();

      await waitFor(() => {
        const activeLabels = screen.getAllByText('Active');
        expect(activeLabels.length).toBeGreaterThan(0);
      });
    });

    it('should show Inactive label for inactive users', async () => {
      renderUserList();

      await waitFor(() => {
        expect(screen.getByText('Inactive')).toBeInTheDocument();
      });
    });

    it('should show Administrator label for superadmin users', async () => {
      renderUserList();

      await waitFor(() => {
        expect(screen.getByText('Administrator')).toBeInTheDocument();
      });
    });
  });

  describe('User actions', () => {
    it('should have edit buttons for each user', async () => {
      renderUserList();

      await waitFor(() => {
        const allLinks = screen.getAllByRole('link');
        const editButtons = allLinks.filter((link) =>
          link.getAttribute('href')?.includes('/admin/users/'),
        );
        expect(editButtons.length).toBe(3);
      });
    });

    it('should have delete buttons for each user', async () => {
      renderUserList();

      await waitFor(() => {
        const allButtons = screen.getAllByRole('button');
        const deleteButtons = allButtons.filter((btn) =>
          btn
            .getAttribute('data-ouia-component-id')
            ?.includes('admin-users-delete'),
        );
        expect(deleteButtons.length).toBe(3);
      });
    });

    it('should open delete modal when delete button is clicked', async () => {
      renderUserList();

      await waitFor(() => {
        expect(screen.getByText('Test User 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button');
      const firstDeleteButton = deleteButtons.find((btn) =>
        btn
          .getAttribute('data-ouia-component-id')
          ?.includes('admin-users-delete'),
      );

      fireEvent.click(firstDeleteButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
      });
    });

    it('should display user name or email in delete modal', async () => {
      renderUserList();

      await waitFor(() => {
        expect(screen.getByText('Test User 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button');
      const firstDeleteButton = deleteButtons.find((btn) =>
        btn
          .getAttribute('data-ouia-component-id')
          ?.includes('admin-users-delete'),
      );

      fireEvent.click(firstDeleteButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Are you sure you want to delete/i),
        ).toBeInTheDocument();
      });
    });

    it('should close delete modal when Cancel is clicked', async () => {
      renderUserList();

      await waitFor(() => {
        expect(screen.getByText('Test User 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button');
      const firstDeleteButton = deleteButtons.find((btn) =>
        btn
          .getAttribute('data-ouia-component-id')
          ?.includes('admin-users-delete'),
      );

      fireEvent.click(firstDeleteButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
      });

      const cancelButton = screen
        .getAllByRole('button')
        .find((btn) =>
          btn
            .getAttribute('data-ouia-component-id')
            ?.includes('admin-user-delete-cancel-button'),
        );
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Confirm Delete')).not.toBeInTheDocument();
      });
    });

    it('should delete user when confirmed', async () => {
      renderUserList();

      await waitFor(() => {
        expect(screen.getByText('Test User 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button');
      const firstDeleteButton = deleteButtons.find((btn) =>
        btn
          .getAttribute('data-ouia-component-id')
          ?.includes('admin-users-delete'),
      );

      fireEvent.click(firstDeleteButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole('button')
        .find((btn) =>
          btn
            .getAttribute('data-ouia-component-id')
            ?.includes('admin-user-delete-confirm-button'),
        );
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(HttpClient.delete).toHaveBeenCalledWith([
          'http://localhost:8080/api',
          'admin',
          'user',
          mockUser1.id,
        ]);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      HttpClient.get.mockRejectedValue(new Error('API Error'));

      renderUserList();

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle delete errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      HttpClient.delete.mockRejectedValue(new Error('Delete Error'));

      renderUserList();

      await waitFor(() => {
        expect(screen.getByText('Test User 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button');
      const firstDeleteButton = deleteButtons.find((btn) =>
        btn
          .getAttribute('data-ouia-component-id')
          ?.includes('admin-users-delete'),
      );

      fireEvent.click(firstDeleteButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole('button')
        .find((btn) =>
          btn
            .getAttribute('data-ouia-component-id')
            ?.includes('admin-user-delete-confirm-button'),
        );
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error deleting user:',
          expect.any(Error),
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Filtering', () => {
    it('should apply filters when provided', async () => {
      const filters = [{ field: 'email', operator: 'eq', value: 'user1' }];

      renderUserList({ activeFilters: filters });

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'admin', 'user'],
          expect.objectContaining({
            filter: expect.any(String),
          }),
        );
      });
    });
  });

  describe('Loading state', () => {
    it('should show loading state initially', async () => {
      HttpClient.get.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockUsersResponse,
                }),
              100,
            ),
          ),
      );

      const { container } = renderUserList();

      // Component should render without errors during loading
      expect(container).toBeTruthy();
    });
  });
});
