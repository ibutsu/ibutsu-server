import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import IbutsuSidebar from './sidebar';
import { IbutsuContext } from './contexts/ibutsu-context';
import { HttpClient } from '../utilities/http';
import { createMockProject } from '../test-utils';

vi.mock('../utilities/http');
vi.mock('../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

describe('IbutsuSidebar', () => {
  const mockProject = createMockProject({
    id: 'project-abc-123',
    name: 'test-project',
    title: 'Test Project',
  });

  const projectId = 'project-abc-123';

  const defaultContextValue = {
    primaryObject: mockProject,
    defaultDashboard: null,
    primaryType: 'project',
    setPrimaryType: vi.fn(),
    setPrimaryObject: vi.fn(),
    setDefaultDashboard: vi.fn(),
    darkTheme: false,
    setDarkTheme: vi.fn(),
  };

  const renderSidebar = (
    contextValue = {},
    initialRoute = `/project/${projectId}/dashboard/dash-1`,
  ) => {
    const mergedContext = { ...defaultContextValue, ...contextValue };

    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <IbutsuContext value={mergedContext}>
          <Routes>
            <Route
              path="/project/:project_id/*"
              element={<IbutsuSidebar />}
            />
          </Routes>
        </IbutsuContext>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    HttpClient.get.mockResolvedValue({
      ok: true,
      json: async () => ({ widgets: [] }),
    });

    HttpClient.handleResponse.mockImplementation(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Response not ok');
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Navigation link targets', () => {
    it('should render absolute Dashboard link under the project base path', async () => {
      renderSidebar();
      vi.advanceTimersByTime(100);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: 'Dashboard' });
        expect(link).toHaveAttribute(
          'href',
          `/project/${projectId}/dashboard`,
        );
      });
    });

    it('should render absolute Runs link under the project base path', async () => {
      renderSidebar();
      vi.advanceTimersByTime(100);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: 'Runs' });
        expect(link).toHaveAttribute('href', `/project/${projectId}/runs`);
      });
    });

    it('should render absolute Results link under the project base path', async () => {
      renderSidebar();
      vi.advanceTimersByTime(100);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: 'Test Results' });
        expect(link).toHaveAttribute(
          'href',
          `/project/${projectId}/results`,
        );
      });
    });

    it('should not append link paths to the current route', async () => {
      renderSidebar({}, `/project/${projectId}/dashboard/some-uuid`);
      vi.advanceTimersByTime(100);

      await waitFor(() => {
        const runsLink = screen.getByRole('link', { name: 'Runs' });
        expect(runsLink).toHaveAttribute(
          'href',
          `/project/${projectId}/runs`,
        );
        expect(runsLink.getAttribute('href')).not.toContain('dashboard');
      });
    });
  });

  describe('View navigation links', () => {
    const mockViews = [
      { id: 'view-1', title: 'Accessibility', widget: 'accessibility-view' },
      { id: 'view-2', title: 'Build Trends', widget: 'build-trends-view' },
    ];

    beforeEach(() => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => ({ widgets: mockViews }),
      });
    });

    it('should render absolute view links under the project base path', async () => {
      renderSidebar();
      vi.advanceTimersByTime(100);

      await waitFor(() => {
        const link = screen.getByRole('link', { name: 'Accessibility' });
        expect(link).toHaveAttribute(
          'href',
          `/project/${projectId}/view/view-1`,
        );
      });

      const trendsLink = screen.getByRole('link', { name: 'Build Trends' });
      expect(trendsLink).toHaveAttribute(
        'href',
        `/project/${projectId}/view/view-2`,
      );
    });

    it('should not render jenkins-analysis-view entries', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => ({
          widgets: [
            ...mockViews,
            {
              id: 'view-3',
              title: 'Jenkins Analysis',
              widget: 'jenkins-analysis-view',
            },
          ],
        }),
      });

      renderSidebar();
      vi.advanceTimersByTime(100);

      await waitFor(() => {
        expect(
          screen.getByRole('link', { name: 'Accessibility' }),
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByRole('link', { name: 'Jenkins Analysis' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('Render guards', () => {
    it('should not render when primaryObject is null', () => {
      renderSidebar({ primaryObject: null });

      expect(
        screen.queryByRole('link', { name: 'Runs' }),
      ).not.toBeInTheDocument();
    });

    it('should not render when primaryType is not project', () => {
      renderSidebar({ primaryType: 'other' });

      expect(
        screen.queryByRole('link', { name: 'Runs' }),
      ).not.toBeInTheDocument();
    });

    it('should not render when project_id param is missing', () => {
      render(
        <MemoryRouter initialEntries={['/somewhere']}>
          <IbutsuContext value={defaultContextValue}>
            <Routes>
              <Route path="/*" element={<IbutsuSidebar />} />
            </Routes>
          </IbutsuContext>
        </MemoryRouter>,
      );

      expect(
        screen.queryByRole('link', { name: 'Runs' }),
      ).not.toBeInTheDocument();
    });
  });
});
