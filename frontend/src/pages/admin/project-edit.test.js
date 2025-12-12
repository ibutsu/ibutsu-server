/* eslint-env jest */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectEdit from './project-edit';
import { FilterContext } from '../../components/contexts/filter-context';
import { HttpClient } from '../../utilities/http';
import {
  createMockProject,
  createMockUser,
  createMockDashboard,
} from '../../test-utils';

// Mock dependencies
jest.mock('../../utilities/http');
jest.mock('../settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock AdminFilter component
jest.mock('../../components/filtering/admin-filter', () => {
  return function AdminFilter() {
    return <div data-testid="admin-filter">Admin Filter</div>;
  };
});

describe('ProjectEdit', () => {
  const mockProject = createMockProject({
    id: 'project-123',
    name: 'test-project',
    title: 'Test Project',
    owner: createMockUser({ id: 'user-1', name: 'Test Owner' }),
    defaultDashboard: createMockDashboard({ id: 'dash-1', title: 'Dashboard' }),
  });

  const mockUsers = [
    createMockUser({ id: 'user-1', name: 'User One', email: 'one@test.com' }),
    createMockUser({ id: 'user-2', name: 'User Two', email: 'two@test.com' }),
  ];

  const mockDashboards = [
    createMockDashboard({ id: 'dash-1', title: 'Dashboard One' }),
    createMockDashboard({ id: 'dash-2', title: 'Dashboard Two' }),
  ];

  const defaultFilterContext = {
    activeFilters: [],
    updateFilters: jest.fn(),
    clearFilters: jest.fn(),
  };

  const renderComponent = (
    filterContext = {},
    initialRoute = '/admin/project/project-123',
  ) => {
    const mergedFilterContext = { ...defaultFilterContext, ...filterContext };

    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <FilterContext.Provider value={mergedFilterContext}>
          <Routes>
            <Route path="/admin/project/:id" element={<ProjectEdit />} />
            <Route
              path="/admin/projects"
              element={<div data-testid="projects-list">Projects List</div>}
            />
          </Routes>
        </FilterContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    HttpClient.get.mockImplementation((url) => {
      const urlPath = Array.isArray(url) ? url.join('/') : url;

      if (urlPath.includes('admin/project/project-123')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockProject,
        });
      }

      if (urlPath.includes('admin/user')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ users: mockUsers }),
        });
      }

      if (urlPath.includes('dashboard')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ dashboards: mockDashboards }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });

    HttpClient.post.mockResolvedValue({ ok: true, json: async () => ({}) });
    HttpClient.put.mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering - Edit Mode', () => {
    it('should render page title with project name', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByText(/Projects \/ Test Project/)).toBeInTheDocument();
      });
    });

    it('should render title input', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });
    });

    it('should render name input', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      });
    });

    it('should render owner selection', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByText(/owner/i)).toBeInTheDocument();
      });
    });

    it('should render dashboard selection', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByText(/default dashboard/i)).toBeInTheDocument();
      });
    });

    it('should render submit button', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /submit/i }),
        ).toBeInTheDocument();
      });
    });

    it('should render cancel button', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /cancel/i }),
        ).toBeInTheDocument();
      });
    });

    it('should render admin filter for owner', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByTestId('admin-filter')).toBeInTheDocument();
      });
    });
  });

  describe('Rendering - New Project Mode', () => {
    it('should show Add Project title for new project', async () => {
      renderComponent({}, '/admin/project/new');
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByText('Add Project')).toBeInTheDocument();
      });
    });

    it('should generate default name for new project', async () => {
      renderComponent({}, '/admin/project/new');
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/name/i);
        expect(nameInput.value).toMatch(/new-project-/);
      });
    });

    it('should disable owner selection for new project', async () => {
      renderComponent({}, '/admin/project/new');
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        const ownerToggle = screen.getByLabelText('Owner selection toggle');
        expect(ownerToggle).toBeDisabled();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch project data on mount', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith([
          'http://localhost:8080/api',
          'admin',
          'project',
          'project-123',
        ]);
      });
    });

    it('should fetch users on mount', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'admin', 'user'],
          expect.any(Object),
        );
      });
    });

    it('should fetch dashboards on mount', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'dashboard'],
          expect.objectContaining({ project_id: 'project-123' }),
        );
      });
    });

    it('should handle project fetch error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      HttpClient.get.mockImplementation((url) => {
        const urlPath = Array.isArray(url) ? url.join('/') : url;
        if (urlPath.includes('admin/project/project-123')) {
          return Promise.reject(new Error('Not found'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ users: [], dashboards: [] }),
        });
      });

      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to fetch project: ',
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Form Interactions', () => {
    it('should update title on input', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { target: { value: '' } });
      fireEvent.change(titleInput, { target: { value: 'New Title' } });

      expect(titleInput.value).toBe('New Title');
    });

    it('should update name on input', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: '' } });
      fireEvent.change(nameInput, { target: { value: 'new-name' } });

      expect(nameInput.value).toBe('new-name');
    });
  });

  describe('Form Submission', () => {
    it('should submit updated project data', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(HttpClient.put).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'admin', 'project', 'project-123'],
          {},
          expect.objectContaining({
            title: 'Test Project',
            name: 'test-project',
          }),
        );
      });
    });

    it('should submit new project data', async () => {
      renderComponent({}, '/admin/project/new');
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      // Fill in required fields
      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { target: { value: '' } });
      fireEvent.change(titleInput, { target: { value: 'Brand New Project' } });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(HttpClient.post).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'admin', 'project'],
          expect.objectContaining({
            title: 'Brand New Project',
          }),
        );
      });
    });

    it('should handle submit error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      HttpClient.put.mockRejectedValue(new Error('Submit failed'));

      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      fireEvent.click(submitButton);
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to POST/PUT project: ',
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Validation', () => {
    it('should validate title is required', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { target: { value: '' } });

      // Validation state should update
      expect(titleInput).toHaveAttribute('aria-invalid', 'true');
    });

    it('should validate name is required', async () => {
      renderComponent();
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/name/i);
      fireEvent.change(nameInput, { target: { value: '' } });

      // Validation state should update
      expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Loading State', () => {
    it('should show loading alert when title is not yet loaded', async () => {
      HttpClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderComponent();

      // Before data loads, should show loading
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Filter Context Integration', () => {
    it('should use activeFilters when fetching users', async () => {
      const filterContext = {
        activeFilters: [{ field: 'name', operator: 'eq', value: 'Test' }],
      };

      renderComponent(filterContext);
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'admin', 'user'],
          expect.objectContaining({
            filter: expect.any(Array),
          }),
        );
      });
    });
  });
});
