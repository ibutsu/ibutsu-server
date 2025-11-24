/* eslint-env jest */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectList from './project-list';
import { HttpClient } from '../../utilities/http';
import { FilterContext } from '../../components/contexts/filter-context';

// Mock dependencies
jest.mock('../../utilities/http');
jest.mock('../settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

describe('ProjectList Component', () => {
  const mockProject1 = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'test-project-1',
    title: 'Test Project 1',
    owner: {
      name: 'Test Owner',
      email: 'owner@example.com',
    },
  };

  const mockProject2 = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'test-project-2',
    title: 'Test Project 2',
    owner: {
      email: 'owner2@example.com',
    },
  };

  const mockProjectsResponse = {
    projects: [mockProject1, mockProject2],
    pagination: {
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
    },
  };

  const renderProjectList = ({ activeFilters = [] } = {}) => {
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
          <ProjectList />
        </FilterContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for HttpClient.get
    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => mockProjectsResponse,
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
    it('should render the Projects heading', async () => {
      renderProjectList();

      expect(screen.getByText('Projects')).toBeInTheDocument();
    });

    it('should render Add Project button', async () => {
      renderProjectList();

      const addButton = screen.getByRole('link', { name: /add project/i });
      expect(addButton).toBeInTheDocument();
    });

    it('should fetch and display projects', async () => {
      renderProjectList();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'admin', 'project'],
          expect.objectContaining({
            page: 1,
            pageSize: 20,
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Test Project 1')).toBeInTheDocument();
        expect(screen.getByText('Test Project 2')).toBeInTheDocument();
      });
    });

    it('should display project owner name when available', async () => {
      renderProjectList();

      await waitFor(() => {
        expect(screen.getByText('Test Owner')).toBeInTheDocument();
      });
    });

    it('should display owner email when name is not available', async () => {
      renderProjectList();

      await waitFor(() => {
        expect(screen.getByText('owner2@example.com')).toBeInTheDocument();
      });
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no projects exist', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => ({
          projects: [],
          pagination: {
            page: 1,
            pageSize: 20,
            totalItems: 0,
            totalPages: 0,
          },
        }),
      });

      renderProjectList();

      await waitFor(() => {
        expect(screen.getByText('No Projects found')).toBeInTheDocument();
        expect(
          screen.getByText('Create your first project'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Project actions', () => {
    it('should have edit buttons for each project', async () => {
      renderProjectList();

      await waitFor(() => {
        const allLinks = screen.getAllByRole('link');
        const editButtons = allLinks.filter((link) => {
          const href = link.getAttribute('href');
          return (
            href?.includes('/admin/projects/') && !href.includes('/new')
          );
        });
        expect(editButtons.length).toBe(2);
      });
    });

    it('should have delete buttons for each project', async () => {
      renderProjectList();

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button');
        const projectDeleteButtons = deleteButtons.filter((btn) =>
          btn
            .getAttribute('data-ouia-component-id')
            ?.includes('admin-projects-delete'),
        );
        expect(projectDeleteButtons.length).toBe(2);
      });
    });

    it('should open delete modal when delete button is clicked', async () => {
      renderProjectList();

      await waitFor(() => {
        expect(screen.getByText('Test Project 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button');
      const firstDeleteButton = deleteButtons.find((btn) =>
        btn
          .getAttribute('data-ouia-component-id')
          ?.includes('admin-projects-delete'),
      );

      fireEvent.click(firstDeleteButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
        expect(
          screen.getByText(/Are you sure you want to delete/i),
        ).toBeInTheDocument();
      });
    });

    it('should close delete modal when Cancel is clicked', async () => {
      renderProjectList();

      await waitFor(() => {
        expect(screen.getByText('Test Project 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button');
      const firstDeleteButton = deleteButtons.find((btn) =>
        btn
          .getAttribute('data-ouia-component-id')
          ?.includes('admin-projects-delete'),
      );

      fireEvent.click(firstDeleteButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Confirm Delete')).not.toBeInTheDocument();
      });
    });

    it('should delete project when confirmed', async () => {
      renderProjectList();

      await waitFor(() => {
        expect(screen.getByText('Test Project 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button');
      const firstDeleteButton = deleteButtons.find((btn) =>
        btn
          .getAttribute('data-ouia-component-id')
          ?.includes('admin-projects-delete'),
      );

      fireEvent.click(firstDeleteButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /^Delete$/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(HttpClient.delete).toHaveBeenCalledWith([
          'http://localhost:8080/api',
          'admin',
          'project',
          mockProject1.id,
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

      renderProjectList();

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Filtering', () => {
    it('should apply filters when provided', async () => {
      const filters = [
        { field: 'name', operator: 'eq', value: 'test-project' },
      ];

      renderProjectList({ activeFilters: filters });

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'admin', 'project'],
          expect.objectContaining({
            filter: expect.any(String),
          }),
        );
      });
    });
  });
});
