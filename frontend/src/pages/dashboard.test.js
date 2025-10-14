/* eslint-env jest */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Dashboard from './dashboard';
import { IbutsuContext } from '../components/contexts/ibutsu-context';
import { HttpClient } from '../utilities/http';

// Mock dependencies
jest.mock('../utilities/http');
jest.mock('../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock the useWidgets hook
jest.mock('../components/hooks/use-widgets', () => ({
  useWidgets: () => ({
    widgets: [],
    widgetComponents: [],
  }),
}));

// Mock all modal components
jest.mock('../components/modals/new-dashboard-modal', () => {
  return function NewDashboardModal() {
    return <div data-testid="new-dashboard-modal">New Dashboard Modal</div>;
  };
});

jest.mock('../components/modals/new-widget-wizard', () => {
  return function NewWidgetWizard() {
    return <div data-testid="new-widget-wizard">New Widget Wizard</div>;
  };
});

jest.mock('../components/modals/edit-widget-modal', () => {
  return function EditWidgetModal() {
    return <div data-testid="edit-widget-modal">Edit Widget Modal</div>;
  };
});

jest.mock('../components/modals/delete-modal', () => {
  return function DeleteModal() {
    return <div data-testid="delete-modal">Delete Modal</div>;
  };
});

// Mock nanoid
jest.mock('nanoid/non-secure', () => ({
  nanoid: () => 'test-nanoid',
}));

describe('Dashboard Component', () => {
  // Test data - using UUIDs for backend model IDs
  const mockProject = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'test-project',
    title: 'Test Project',
  };

  const mockDashboard1 = {
    id: '650e8400-e29b-41d4-a716-446655440001',
    title: 'Dashboard One',
    project_id: '550e8400-e29b-41d4-a716-446655440000',
  };

  const mockDashboard2 = {
    id: '650e8400-e29b-41d4-a716-446655440002',
    title: 'Dashboard Two',
    project_id: '550e8400-e29b-41d4-a716-446655440000',
  };

  const mockDefaultDashboard = {
    id: '650e8400-e29b-41d4-a716-446655440099',
    title: 'Default Dashboard',
    project_id: '550e8400-e29b-41d4-a716-446655440000',
  };

  // Helper function to create mock API responses
  const createDashboardResponse = (dashboards) => ({
    dashboards,
    pagination: {
      page: 1,
      pageSize: 50,
      totalItems: dashboards.length,
      totalPages: 1,
    },
  });

  // Helper function to render Dashboard with context and routing
  const renderDashboard = ({
    primaryObject = mockProject,
    defaultDashboard = null,
    initialRoute = `/project/${mockProject.id}/dashboard/`,
  } = {}) => {
    const contextValue = {
      primaryObject,
      defaultDashboard,
      primaryType: 'project',
      setPrimaryType: jest.fn(),
      setPrimaryObject: jest.fn(),
      setDefaultDashboard: jest.fn(),
      darkTheme: false,
      setDarkTheme: jest.fn(),
    };

    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <IbutsuContext.Provider value={contextValue}>
          <Routes>
            <Route
              path="/project/:project_id/dashboard/:dashboard_id?"
              element={<Dashboard />}
            />
          </Routes>
        </IbutsuContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for HttpClient.get
    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => createDashboardResponse([]),
    });

    // Default mock for HttpClient.handleResponse
    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });
  });

  describe('Project without default dashboard', () => {
    it('should display "No Dashboard Selected" message when no dashboard is selected', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () =>
          createDashboardResponse([mockDashboard1, mockDashboard2]),
      });

      renderDashboard({
        defaultDashboard: null,
      });

      await waitFor(() => {
        expect(screen.getByText('No Dashboard Selected')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/There is currently no dashboard selected/i),
      ).toBeInTheDocument();
    });

    it('should not auto-select any dashboard when no default is set', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () =>
          createDashboardResponse([mockDashboard1, mockDashboard2]),
      });

      renderDashboard({
        defaultDashboard: null,
      });

      await waitFor(() => {
        expect(screen.getByText('No Dashboard Selected')).toBeInTheDocument();
      });

      // Wait for the select input to be rendered
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Select a dashboard'),
        ).toBeInTheDocument();
      });

      // Verify that the select input is empty
      const selectInput = screen.getByPlaceholderText('Select a dashboard');
      expect(selectInput).toHaveValue('');
    });
  });

  describe('Project with default dashboard assigned', () => {
    it('should auto-select the default dashboard when available', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () =>
          createDashboardResponse([
            mockDashboard1,
            mockDashboard2,
            mockDefaultDashboard,
          ]),
      });

      renderDashboard({
        defaultDashboard: mockDefaultDashboard.id,
      });

      await waitFor(() => {
        const selectInput = screen.getByPlaceholderText('Select a dashboard');
        expect(selectInput).toHaveValue('Default Dashboard');
      });

      // Should not show the "No Dashboard Selected" message
      expect(
        screen.queryByText('No Dashboard Selected'),
      ).not.toBeInTheDocument();
    });

    it('should display empty state when default dashboard has no widgets', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () =>
          createDashboardResponse([
            mockDashboard1,
            mockDashboard2,
            mockDefaultDashboard,
          ]),
      });

      renderDashboard({
        defaultDashboard: mockDefaultDashboard.id,
      });

      await waitFor(() => {
        expect(screen.getByText('No Widgets')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/This dashboard currently has no widgets defined/i),
      ).toBeInTheDocument();
    });

    it('should not select default dashboard if it does not exist in the list', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () =>
          createDashboardResponse([mockDashboard1, mockDashboard2]),
      });

      renderDashboard({
        defaultDashboard: '00000000-0000-0000-0000-000000000000',
      });

      await waitFor(() => {
        expect(screen.getByText('No Dashboard Selected')).toBeInTheDocument();
      });
    });
  });

  describe('URL with specific dashboard UUID', () => {
    it('should show "No Dashboard Selected" when URL dashboard does not exist', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () =>
          createDashboardResponse([mockDashboard1, mockDashboard2]),
      });

      renderDashboard({
        initialRoute: `/project/${mockProject.id}/dashboard/00000000-0000-0000-0000-000000000000`,
        defaultDashboard: null,
      });

      await waitFor(() => {
        expect(screen.getByText('No Dashboard Selected')).toBeInTheDocument();
      });

      // Wait for the select input to be rendered
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Select a dashboard'),
        ).toBeInTheDocument();
      });

      // Verify that the select input is empty
      const selectInput = screen.getByPlaceholderText('Select a dashboard');
      expect(selectInput).toHaveValue('');
    });

    it('should select and display dashboard when URL dashboard exists', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () =>
          createDashboardResponse([
            mockDashboard1,
            mockDashboard2,
            mockDefaultDashboard,
          ]),
      });

      renderDashboard({
        initialRoute: `/project/${mockProject.id}/dashboard/${mockDashboard2.id}`,
        defaultDashboard: null,
      });

      await waitFor(() => {
        const selectInput = screen.getByPlaceholderText('Select a dashboard');
        expect(selectInput).toHaveValue('Dashboard Two');
      });

      // Should not show the "No Dashboard Selected" message
      expect(
        screen.queryByText('No Dashboard Selected'),
      ).not.toBeInTheDocument();
    });
  });

  describe('URL dashboard should not be overridden by default dashboard', () => {
    it('DEMONSTRATES BUG: should prioritize URL dashboard over default dashboard', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () =>
          createDashboardResponse([
            mockDashboard1,
            mockDashboard2,
            mockDefaultDashboard,
          ]),
      });

      // URL specifies dashboard-222, but project has a default of dashboard-default
      renderDashboard({
        initialRoute: `/project/${mockProject.id}/dashboard/${mockDashboard2.id}`,
        defaultDashboard: mockDefaultDashboard.id, // Project has a default dashboard
      });

      // Wait for dashboard load - the component will process both URL and default dashboard
      await waitFor(
        () => {
          const selectInput = screen.getByPlaceholderText('Select a dashboard');
          // Component loads and shows a dashboard (either URL or default)
          expect(selectInput.value).toBeTruthy();
        },
        { timeout: 3000 },
      );

      // Additional wait to allow all useEffect hooks to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      const selectInput = screen.getByPlaceholderText('Select a dashboard');

      // 🐛 BUG TEST 🐛
      // This test expects the CORRECT behavior:
      // URL dashboard should take precedence over default dashboard
      // When user navigates to a specific dashboard via URL, that should be respected
      expect(selectInput).toHaveValue('Dashboard Two');
    });

    it('should not apply default dashboard when URL specifies a dashboard (BUG PRESENT)', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () =>
          createDashboardResponse([
            mockDashboard1,
            mockDashboard2,
            mockDefaultDashboard,
          ]),
      });

      // URL explicitly specifies dashboard-111
      renderDashboard({
        initialRoute: `/project/${mockProject.id}/dashboard/${mockDashboard1.id}`,
        defaultDashboard: mockDefaultDashboard.id,
      });

      // Wait for component to load
      await waitFor(
        () => {
          const selectInput = screen.getByPlaceholderText('Select a dashboard');
          expect(selectInput.value).toBeTruthy();
        },
        { timeout: 3000 },
      );

      // Verify it doesn't change to default after a delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const selectInput = screen.getByPlaceholderText('Select a dashboard');

      // Should respect URL parameter over default dashboard
      expect(selectInput).toHaveValue('Dashboard One');
    });

    it('should apply default dashboard only when no URL dashboard is specified', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () =>
          createDashboardResponse([
            mockDashboard1,
            mockDashboard2,
            mockDefaultDashboard,
          ]),
      });

      // URL does not specify a dashboard (no dashboard_id param)
      renderDashboard({
        initialRoute: `/project/${mockProject.id}/dashboard/`,
        defaultDashboard: mockDefaultDashboard.id,
      });

      await waitFor(
        () => {
          const selectInput = screen.getByPlaceholderText('Select a dashboard');
          expect(selectInput).toHaveValue('Default Dashboard');
        },
        { timeout: 3000 },
      );

      // Verify it stays as the default dashboard
      await new Promise((resolve) => setTimeout(resolve, 500));

      const selectInput = screen.getByPlaceholderText('Select a dashboard');
      expect(selectInput).toHaveValue('Default Dashboard');
    });
  });

  describe('Dashboard state management', () => {
    it('should fetch dashboards when primaryObject is set', async () => {
      const dashboards = [mockDashboard1, mockDashboard2];
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => createDashboardResponse(dashboards),
      });

      renderDashboard();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'dashboard'],
          expect.objectContaining({
            project_id: mockProject.id,
            pageSize: 50,
            page: 1,
          }),
        );
      });
    });

    it('should handle pagination when fetching dashboards', async () => {
      // Create a scenario with multiple pages
      const page1Dashboards = Array.from({ length: 50 }, (_, i) => ({
        id: `650e8400-e29b-41d4-a716-4466554400${i.toString().padStart(2, '0')}`,
        title: `Dashboard ${i}`,
        project_id: mockProject.id,
      }));

      const page2Dashboards = Array.from({ length: 10 }, (_, i) => ({
        id: `650e8400-e29b-41d4-a716-4466554401${i.toString().padStart(2, '0')}`,
        title: `Dashboard ${i + 50}`,
        project_id: mockProject.id,
      }));

      HttpClient.get
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            dashboards: page1Dashboards,
            pagination: {
              page: 1,
              pageSize: 50,
              totalItems: 60,
              totalPages: 2,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            dashboards: page2Dashboards,
            pagination: {
              page: 2,
              pageSize: 50,
              totalItems: 60,
              totalPages: 2,
            },
          }),
        });

      renderDashboard();

      await waitFor(
        () => {
          expect(HttpClient.get).toHaveBeenCalledTimes(2);
          expect(HttpClient.get).toHaveBeenNthCalledWith(
            1,
            ['http://localhost:8080/api', 'dashboard'],
            expect.objectContaining({ page: 1 }),
          );
          expect(HttpClient.get).toHaveBeenNthCalledWith(
            2,
            ['http://localhost:8080/api', 'dashboard'],
            expect.objectContaining({ page: 2 }),
          );
        },
        { timeout: 3000 },
      );
    });

    it('should reset dashboard state when primaryObject changes', async () => {
      const { rerender } = renderDashboard({
        defaultDashboard: mockDefaultDashboard.id,
      });

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () =>
          createDashboardResponse([
            mockDashboard1,
            mockDashboard2,
            mockDefaultDashboard,
          ]),
      });

      await waitFor(
        () => {
          const selectInput = screen.getByPlaceholderText('Select a dashboard');
          expect(selectInput).toHaveValue('Default Dashboard');
        },
        { timeout: 3000 },
      );

      // Change the primary object
      const newProject = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'new-project',
        title: 'New Project',
      };

      const newContextValue = {
        primaryObject: newProject,
        defaultDashboard: null,
        primaryType: 'project',
        setPrimaryType: jest.fn(),
        setPrimaryObject: jest.fn(),
        setDefaultDashboard: jest.fn(),
        darkTheme: false,
        setDarkTheme: jest.fn(),
      };

      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => createDashboardResponse([]),
      });

      rerender(
        <MemoryRouter initialEntries={[`/project/${newProject.id}/dashboard/`]}>
          <IbutsuContext.Provider value={newContextValue}>
            <Routes>
              <Route
                path="/project/:project_id/dashboard/:dashboard_id?"
                element={<Dashboard />}
              />
            </Routes>
          </IbutsuContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(
        () => {
          const selectInput = screen.getByPlaceholderText('Select a dashboard');
          expect(selectInput).toHaveValue('');
        },
        { timeout: 3000 },
      );
    });
  });

  describe('Rendering states', () => {
    it('should display dashboard select after loading', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () =>
          createDashboardResponse([mockDashboard1, mockDashboard2]),
      });

      renderDashboard();

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Select a dashboard'),
        ).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      HttpClient.get.mockRejectedValue(new Error('API Error'));

      renderDashboard();

      await waitFor(
        () => {
          expect(screen.getByText('No Dashboard Selected')).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should show appropriate buttons when dashboard is selected', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () =>
          createDashboardResponse([mockDashboard1, mockDashboard2]),
      });

      renderDashboard({
        initialRoute: `/project/${mockProject.id}/dashboard/${mockDashboard1.id}`,
      });

      await waitFor(() => {
        const selectInput = screen.getByPlaceholderText('Select a dashboard');
        expect(selectInput).toHaveValue('Dashboard One');
      });

      // Add Widget button should be enabled
      const addWidgetButton = screen.getByRole('button', {
        name: 'Add widget',
      });
      expect(addWidgetButton).toBeEnabled();

      // Delete dashboard button should be enabled
      const deleteDashboardButton = screen.getByRole('button', {
        name: 'Delete dashboard',
      });
      expect(deleteDashboardButton).toBeEnabled();
    });

    it('should disable buttons when no dashboard is selected', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () =>
          createDashboardResponse([mockDashboard1, mockDashboard2]),
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('No Dashboard Selected')).toBeInTheDocument();
      });

      // Add Widget button should be disabled
      const addWidgetButton = screen.getByRole('button', {
        name: 'Add widget',
      });
      expect(addWidgetButton).toBeDisabled();

      // Delete dashboard button should be disabled
      const deleteDashboardButton = screen.getByRole('button', {
        name: 'Delete dashboard',
      });
      expect(deleteDashboardButton).toBeDisabled();
    });
  });
});
