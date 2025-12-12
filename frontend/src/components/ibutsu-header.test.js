import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import IbutsuHeader from './ibutsu-header';
import { IbutsuContext } from './contexts/ibutsu-context';
import { HttpClient } from '../utilities/http';
import { createMockProject } from '../test-utils';

// Mock dependencies
jest.mock('../utilities/http');
jest.mock('../pages/settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock child components
jest.mock('./file-upload', () => {
  return function FileUpload() {
    return <div data-ouia-component-id="file-upload">File Upload</div>;
  };
});

jest.mock('./user-dropdown', () => {
  return function UserDropdown() {
    return <div data-ouia-component-id="user-dropdown">User Dropdown</div>;
  };
});

// Mock utility function
jest.mock('../utilities', () => ({
  setDocumentDarkTheme: jest.fn(),
}));

describe('IbutsuHeader', () => {
  const mockProject = createMockProject({
    id: 'project-123',
    name: 'test-project',
    title: 'Test Project',
    default_dashboard_id: 'dashboard-1',
  });

  const mockProject2 = createMockProject({
    id: 'project-456',
    name: 'another-project',
    title: 'Another Project',
    default_dashboard_id: 'dashboard-2',
  });

  const defaultContextValue = {
    primaryObject: null,
    defaultDashboard: null,
    primaryType: 'project',
    setPrimaryType: jest.fn(),
    setPrimaryObject: jest.fn(),
    setDefaultDashboard: jest.fn(),
    darkTheme: false,
    setDarkTheme: jest.fn(),
  };

  const renderComponent = (contextValue = {}, initialRoute = '/') => {
    const mergedContext = { ...defaultContextValue, ...contextValue };

    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <IbutsuContext.Provider value={mergedContext}>
          <Routes>
            <Route path="/*" element={<IbutsuHeader />} />
            <Route path="/project/:project_id/*" element={<IbutsuHeader />} />
          </Routes>
        </IbutsuContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mock implementations
    HttpClient.get.mockImplementation((url) => {
      const urlPath = Array.isArray(url) ? url.join('/') : url;

      if (urlPath.includes('/project/') && urlPath.includes('project-123')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockProject,
        });
      }

      if (urlPath.includes('project')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            projects: [mockProject, mockProject2],
          }),
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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render the masthead with brand logo', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByAltText('Ibutsu')).toBeInTheDocument();
      });
    });

    it('should render project selector', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('No active project'),
        ).toBeInTheDocument();
      });
    });

    it('should render file upload button', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('file-upload')).toBeInTheDocument();
      });
    });

    it('should render user dropdown', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByTestId('user-dropdown')).toBeInTheDocument();
      });
    });

    it('should render about button', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByLabelText('About')).toBeInTheDocument();
      });
    });

    it('should render API button', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByText('API')).toBeInTheDocument();
      });
    });

    it('should render theme toggle', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByLabelText('Light theme')).toBeInTheDocument();
        expect(screen.getByLabelText('Dark theme')).toBeInTheDocument();
      });
    });

    it('should render navigation toggle button', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByLabelText('Global navigation')).toBeInTheDocument();
      });
    });
  });

  describe('Project Selection', () => {
    it('should fetch projects on mount', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'project'],
          expect.any(Object),
        );
      });
    });

    it('should display projects in dropdown', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('No active project'),
        ).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('No active project');
      fireEvent.click(input);

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
        expect(screen.getByText('Another Project')).toBeInTheDocument();
      });
    });

    it('should filter projects when typing', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('No active project'),
        ).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('No active project');
      fireEvent.change(input, { target: { value: 'test' } });
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith(
          ['http://localhost:8080/api', 'project'],
          expect.objectContaining({
            filter: expect.arrayContaining([expect.stringContaining('test')]),
          }),
        );
      });
    });

    it('should show "No projects available" when empty', async () => {
      HttpClient.get.mockResolvedValue({
        ok: true,
        json: async () => ({ projects: [] }),
      });

      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('No active project'),
        ).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('No active project');
      fireEvent.click(input);

      await waitFor(() => {
        expect(screen.getByText('No projects available')).toBeInTheDocument();
      });
    });
  });

  describe('Project ID from URL', () => {
    it('should fetch project when project_id in URL', async () => {
      renderComponent({}, '/project/project-123/dashboard');
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith([
          'http://localhost:8080/api',
          '/project/',
          'project-123',
        ]);
      });
    });

    it('should set primary object from URL project', async () => {
      const setPrimaryObject = jest.fn();
      renderComponent({ setPrimaryObject }, '/project/project-123/dashboard');
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(setPrimaryObject).toHaveBeenCalledWith(mockProject);
      });
    });

    it('should handle project fetch error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      HttpClient.get.mockImplementation((url) => {
        const urlPath = Array.isArray(url) ? url.join('/') : url;
        if (urlPath.includes('/project/') && urlPath.includes('project-123')) {
          return Promise.reject(new Error('Not found'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ projects: [] }),
        });
      });

      renderComponent({}, '/project/project-123/dashboard');
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error fetching project:',
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Theme Toggle', () => {
    it('should have light theme selected by default', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        const lightButton = screen.getByLabelText('Light theme');
        expect(lightButton).toBeInTheDocument();
      });
    });

    it('should call setDarkTheme when dark theme clicked', async () => {
      const setDarkTheme = jest.fn();
      renderComponent({ setDarkTheme });
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByLabelText('Dark theme')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Dark theme'));

      expect(setDarkTheme).toHaveBeenCalledWith(true);
    });

    it('should call setDarkTheme(false) when light theme clicked', async () => {
      const setDarkTheme = jest.fn();
      renderComponent({ setDarkTheme, darkTheme: true });
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByLabelText('Light theme')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Light theme'));

      expect(setDarkTheme).toHaveBeenCalledWith(false);
    });
  });

  describe('About Modal', () => {
    it('should open about modal when about button clicked', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByLabelText('About')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('About'));

      await waitFor(() => {
        expect(screen.getByText('Version')).toBeInTheDocument();
        expect(screen.getByText('Source code')).toBeInTheDocument();
        expect(screen.getByText('Documentation')).toBeInTheDocument();
      });
    });

    it('should display links in about modal', async () => {
      renderComponent();
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(screen.getByLabelText('About')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('About'));

      await waitFor(() => {
        expect(
          screen.getByText('github.com/ibutsu/ibutsu-server'),
        ).toBeInTheDocument();
        expect(screen.getByText('docs.ibutsu-project.org')).toBeInTheDocument();
        expect(screen.getByText('Submit an issue')).toBeInTheDocument();
      });
    });
  });

  describe('Project Clear', () => {
    it('should clear project when clear button clicked', async () => {
      const setPrimaryObject = jest.fn();
      renderComponent({ setPrimaryObject }, '/project/project-123/dashboard');
      jest.advanceTimersByTime(100);

      // Wait for project to load
      await waitFor(() => {
        expect(setPrimaryObject).toHaveBeenCalledWith(mockProject);
      });

      // Find and click clear button
      const clearButton = screen.getByLabelText('Clear input value');
      fireEvent.click(clearButton);

      // Should clear primary object
      expect(setPrimaryObject).toHaveBeenCalledWith();
    });
  });
});
