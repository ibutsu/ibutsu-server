import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './login';
import { IbutsuContext } from '../components/contexts/ibutsu-context';
import { HttpClient } from '../utilities/http';
import { AuthService } from '../utilities/auth';

// Mock dependencies
jest.mock('../utilities/http');
jest.mock('../utilities/auth');
jest.mock('../utilities/keycloak', () => ({
  KeycloakService: {
    login: jest.fn(),
  },
}));
jest.mock('./settings', () => ({
  Settings: {
    serverUrl: 'http://localhost:8080/api',
  },
}));

// Mock OAuth libraries
jest.mock('@react-oauth/google', () => ({
  GoogleLogin: function MockGoogleLogin() {
    return <div data-ouia-component-id="google-login">Google Login</div>;
  },
}));

jest.mock('react-simple-oauth2-login', () => {
  return function MockOAuth2Login({ render }) {
    return render({ onClick: jest.fn() });
  };
});

jest.mock('@greatsumini/react-facebook-login', () => {
  return function MockFacebookLogin({ render }) {
    return render({ onClick: jest.fn() });
  };
});

describe('Login', () => {
  const defaultContextValue = {
    primaryObject: null,
    setPrimaryObject: jest.fn(),
    setPrimaryType: jest.fn(),
    setDefaultDashboard: jest.fn(),
    darkTheme: false,
    setDarkTheme: jest.fn(),
  };

  const renderComponent = (contextValue = {}, initialRoute = '/login') => {
    const mergedContext = { ...defaultContextValue, ...contextValue };

    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <IbutsuContext.Provider value={mergedContext}>
          <Login />
        </IbutsuContext.Provider>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default login support (user login enabled)
    HttpClient.get.mockImplementation((url) => {
      const urlPath = Array.isArray(url) ? url.join('/') : url;

      if (urlPath.includes('login/support')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            user: true,
            google: false,
            github: false,
            keycloak: false,
            facebook: false,
            gitlab: false,
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    AuthService.login.mockResolvedValue(true);
    AuthService.setUser.mockImplementation(() => {});
    AuthService.loginError = null;
  });

  describe('Rendering', () => {
    it('should render the login page', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Log in to your account')).toBeInTheDocument();
      });
    });

    it('should render email input when user login enabled', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      });
    });

    it('should render password input when user login enabled', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
      });
    });

    it('should render login button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /log in/i }),
        ).toBeInTheDocument();
      });
    });

    it('should render brand logo', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByAltText('Ibutsu')).toBeInTheDocument();
      });
    });

    it('should render description text', async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/open source test result aggregation tool/i),
        ).toBeInTheDocument();
      });
    });

    it('should render sign up link when user login enabled', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/need an account/i)).toBeInTheDocument();
        expect(screen.getByText(/sign up/i)).toBeInTheDocument();
      });
    });

    it('should render forgot password link', async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/forgot username or password/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Login Support Fetching', () => {
    it('should fetch login support on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith([
          'http://localhost:8080/api',
          'login',
          'support',
        ]);
      });
    });

    it('should not show email/password form when user login disabled', async () => {
      HttpClient.get.mockImplementation((url) => {
        const urlPath = Array.isArray(url) ? url.join('/') : url;

        if (urlPath.includes('login/support')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: false,
              google: false,
              github: false,
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Log in to your account')).toBeInTheDocument();
      });

      // Email field should not be present when user login is disabled
      expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
    });

    it('should handle login support fetch error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      HttpClient.get.mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Form Validation', () => {
    it('should show error when email is empty on submit', async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /log in/i }),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/e-mail and\/or password fields are blank/i),
        ).toBeInTheDocument();
      });
    });

    it('should show error when password is empty on submit', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/e-mail and\/or password fields are blank/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Login Flow', () => {
    it('should call AuthService.login with credentials', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('login-password-input'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(AuthService.login).toHaveBeenCalledWith(
          'test@example.com',
          'password123',
        );
      });
    });

    it('should show loading state while logging in', async () => {
      AuthService.login.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 500)),
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('login-password-input'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));

      expect(screen.getByText(/logging in/i)).toBeInTheDocument();
    });

    it('should show error on login failure', async () => {
      AuthService.login.mockResolvedValue(false);
      AuthService.loginError = { message: 'Invalid credentials' };

      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('login-password-input'), {
        target: { value: 'wrong-password' },
      });
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });
    });

    it('should clear primary object on successful login', async () => {
      const setPrimaryObject = jest.fn();
      AuthService.login.mockResolvedValue(true);

      renderComponent({ setPrimaryObject });

      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('login-password-input'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(setPrimaryObject).toHaveBeenCalled();
      });
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
      });

      // Initially password is hidden
      const passwordInput = screen.getByTestId('login-password-input');
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Click toggle
      fireEvent.click(screen.getByLabelText('Show password'));

      // Password should now be visible
      await waitFor(() => {
        const visibleInput = screen.getByTestId('login-password-input');
        expect(visibleInput).toHaveAttribute('type', 'text');
      });
    });
  });

  describe('Enter Key Login', () => {
    it('should login on enter key press', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('login-password-input'), {
        target: { value: 'password123' },
      });
      fireEvent.keyDown(screen.getByTestId('login-password-input'), {
        key: 'Enter',
        code: 'Enter',
        charCode: 13,
      });

      await waitFor(() => {
        expect(AuthService.login).toHaveBeenCalledWith(
          'test@example.com',
          'password123',
        );
      });
    });
  });

  describe('OAuth Providers', () => {
    it('should fetch OAuth config when provider enabled', async () => {
      HttpClient.get.mockImplementation((url) => {
        const urlPath = Array.isArray(url) ? url.join('/') : url;

        if (urlPath.includes('login/support')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              user: true,
              keycloak: true,
            }),
          });
        }

        if (urlPath.includes('login/config/keycloak')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              server_url: 'https://keycloak.example.com',
              realm: 'ibutsu',
              client_id: 'ibutsu-client',
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      renderComponent();

      await waitFor(() => {
        expect(HttpClient.get).toHaveBeenCalledWith([
          'http://localhost:8080/api',
          'login',
          'config',
          'keycloak',
        ]);
      });
    });
  });

  describe('URL Parameters', () => {
    it('should display alert from URL parameters', async () => {
      renderComponent({}, '/login?msg=Account%20created&st=success');

      await waitFor(() => {
        expect(screen.getByText('Account created')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle login exception', async () => {
      AuthService.login.mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('login-password-input'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        // Should show error state
        expect(AuthService.login).toHaveBeenCalled();
      });
    });
  });
});
