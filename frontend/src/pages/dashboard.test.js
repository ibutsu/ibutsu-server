/* eslint-env jest */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  // Test data
  const mockProject = {
    id: 'project-123',
    name: 'test-project',
    title: 'Test Project',
  };

  const mockDashboard1 = {
    id: 'dashboard-111',
    title: 'Dashboard One',
    project_id: 'project-123',
  };

  const mockDashboard2 = {
    id: 'dashboard-222',
    title: 'Dashboard Two',
    project_id: 'project-123',
  };

  const mockDefaultDashboard = {
    id: 'dashboard-default',
    title: 'Default Dashboard',
    project_id: 'project-123',
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
        defaultDashboard: 'dashboard-default',
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
        defaultDashboard: 'dashboard-default',
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
        defaultDashboard: 'dashboard-nonexistent',
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
        initialRoute: `/project/${mockProject.id}/dashboard/dashboard-nonexistent`,
        defaultDashboard: null,
      });

      await waitFor(() => {
        expect(screen.getByText('No Dashboard Selected')).toBeInTheDocument();
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
        initialRoute: `/project/${mockProject.id}/dashboard/dashboard-222`,
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
        initialRoute: `/project/${mockProject.id}/dashboard/dashboard-222`,
        defaultDashboard: 'dashboard-default', // Project has a default dashboard
      });

      // Wait for initial render and dashboard load
      await waitFor(
        () => {
          const selectInput = screen.getByPlaceholderText('Select a dashboard');
          expect(selectInput).toHaveValue('Dashboard Two');
        },
        { timeout: 3000 },
      );

      // This assertion demonstrates the BUG
      // After a delay, the component might switch to the default dashboard
      // due to the race condition in the useEffect hooks
      await new Promise((resolve) => setTimeout(resolve, 500));

      const selectInput = screen.getByPlaceholderText('Select a dashboard');

      // EXPECTED: Should still be "Dashboard Two" (from URL)
      // ACTUAL (BUG): Might be "Default Dashboard" (from default dashboard setting)
      // This assertion will fail if the bug is present
      try {
        expect(selectInput).toHaveValue('Dashboard Two');
        console.warn(
          'Test passed - URL dashboard was maintained. Bug may have been fixed!',
        );
      } catch (error) {
        // This catch block demonstrates the bug
        if (selectInput.value === 'Default Dashboard') {
          console.error(
            'BUG DETECTED: Default dashboard overrode URL dashboard!',
          );
          console.error(
            `Expected: "Dashboard Two", Actual: "${selectInput.value}"`,
          );
        }
        throw error;
      }
    });

    it('should not apply default dashboard when URL specifies a dashboard', async () => {
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
        initialRoute: `/project/${mockProject.id}/dashboard/dashboard-111`,
        defaultDashboard: 'dashboard-default',
      });

      await waitFor(
        () => {
          const selectInput = screen.getByPlaceholderText('Select a dashboard');
          expect(selectInput).toHaveValue('Dashboard One');
        },
        { timeout: 3000 },
      );

      // Verify it doesn't change to default after a delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const selectInput = screen.getByPlaceholderText('Select a dashboard');
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
        defaultDashboard: 'dashboard-default',
      });

      await waitFor(() => {
        const selectInput = screen.getByPlaceholderText('Select a dashboard');
        expect(selectInput).toHaveValue('Default Dashboard');
      });

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
        id: `dashboard-${i}`,
        title: `Dashboard ${i}`,
        project_id: mockProject.id,
      }));

      const page2Dashboards = Array.from({ length: 10 }, (_, i) => ({
        id: `dashboard-${i + 50}`,
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
        defaultDashboard: 'dashboard-default',
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

      await waitFor(() => {
        const selectInput = screen.getByPlaceholderText('Select a dashboard');
        expect(selectInput).toHaveValue('Default Dashboard');
      });

      // Change the primary object
      const newProject = {
        id: 'project-456',
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
        <MemoryRouter
          initialEntries={[`/project/${newProject.id}/dashboard/`]}
        >
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

      await waitFor(() => {
        const selectInput = screen.getByPlaceholderText('Select a dashboard');
        expect(selectInput).toHaveValue('');
      });
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
        initialRoute: `/project/${mockProject.id}/dashboard/dashboard-111`,
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
