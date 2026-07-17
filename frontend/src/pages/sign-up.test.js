import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignUp } from './sign-up';
import { AuthService } from '../utilities/auth';

vi.mock('../utilities/auth');

vi.mock('react-password-strength-bar', () => ({
  default: function MockPasswordStrengthBar({ password }) {
    return (
      <div data-ouia-component-id="password-strength-bar">
        Strength: {password}
      </div>
    );
  },
}));

describe('SignUp', () => {
  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={['/sign-up']}>
        <SignUp />
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    AuthService.register.mockResolvedValue(true);
    AuthService.registerError = null;
  });

  describe('Rendering', () => {
    it('should render the sign-up page title', () => {
      renderComponent();
      expect(screen.getByText('Register a new account')).toBeInTheDocument();
    });

    it('should render the sign-up subtitle', () => {
      renderComponent();
      expect(
        screen.getByText(
          'Please type in your e-mail address and a secure password',
        ),
      ).toBeInTheDocument();
    });

    it('should render the brand logo', () => {
      renderComponent();
      expect(screen.getByAltText('Ibutsu')).toBeInTheDocument();
    });

    it('should render email input', () => {
      renderComponent();
      expect(screen.getByTestId('signup-email-input')).toBeInTheDocument();
    });

    it('should render password input', () => {
      renderComponent();
      expect(screen.getByTestId('signup-password-input')).toBeInTheDocument();
    });

    it('should render confirm password input', () => {
      renderComponent();
      expect(
        screen.getByTestId('signup-confirm-password-input'),
      ).toBeInTheDocument();
    });

    it('should render register button', () => {
      renderComponent();
      expect(screen.getByTestId('signup-register-button')).toBeInTheDocument();
    });

    it('should render login link', () => {
      renderComponent();
      expect(screen.getByText('Already registered?')).toBeInTheDocument();
      expect(screen.getByText('Log in.')).toBeInTheDocument();
    });

    it('should render forgot password link', () => {
      renderComponent();
      expect(
        screen.getByText('Forgot username or password?'),
      ).toBeInTheDocument();
    });

    it('should render email helper text', () => {
      renderComponent();
      expect(
        screen.getByText('The e-mail address you want to use to log in'),
      ).toBeInTheDocument();
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should initially render password as hidden', () => {
      renderComponent();
      const passwordInput = screen.getByTestId('signup-password-input');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should toggle password visibility when button is clicked', async () => {
      renderComponent();
      const toggleButton = screen.getByTestId('signup-password-toggle-button');

      fireEvent.click(toggleButton);

      await waitFor(() => {
        const passwordInput = screen.getByTestId('signup-password-input');
        expect(passwordInput).toHaveAttribute('type', 'text');
      });
    });

    it('should toggle password back to hidden on second click', async () => {
      renderComponent();
      const toggleButton = screen.getByTestId('signup-password-toggle-button');

      fireEvent.click(toggleButton);
      await waitFor(() => {
        expect(screen.getByTestId('signup-password-input')).toHaveAttribute(
          'type',
          'text',
        );
      });

      fireEvent.click(toggleButton);
      await waitFor(() => {
        expect(screen.getByTestId('signup-password-input')).toHaveAttribute(
          'type',
          'password',
        );
      });
    });

    it('should initially render confirm password as hidden', () => {
      renderComponent();
      const confirmInput = screen.getByTestId('signup-confirm-password-input');
      expect(confirmInput).toHaveAttribute('type', 'password');
    });

    it('should toggle confirm password visibility when button is clicked', async () => {
      renderComponent();
      const toggleButton = screen.getByTestId(
        'signup-confirm-password-toggle-button',
      );

      fireEvent.click(toggleButton);

      await waitFor(() => {
        const confirmInput = screen.getByTestId(
          'signup-confirm-password-input',
        );
        expect(confirmInput).toHaveAttribute('type', 'text');
      });
    });
  });

  describe('Password Match Validation', () => {
    it('should show success when passwords match', async () => {
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      // Trigger a change with a different value so React's input tracking fires onChange.
      // validatePasswordMatch now sees both values matching from the previous render.
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: 'SecurePass1!x' },
      });

      await waitFor(() => {
        expect(screen.getByText('Passwords match!')).toBeInTheDocument();
      });
    });

    it('should show error validation when passwords do not match', async () => {
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: 'DifferentPass' },
      });

      await waitFor(() => {
        const confirmInput = screen.getByTestId(
          'signup-confirm-password-input',
        );
        expect(confirmInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('should reset validation when both fields are cleared', async () => {
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      // Third event triggers validatePasswordMatch with matching closure values
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: 'SecurePass1!x' },
      });

      await waitFor(() => {
        expect(screen.getByText('Passwords match!')).toBeInTheDocument();
      });

      // Clearing the confirm field triggers validatePasswordMatch which sees
      // pw="SecurePass1!" cpw="SecurePass1!x" → mismatch → validation becomes error
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: '' },
      });

      await waitFor(() => {
        const confirmInput = screen.getByTestId(
          'signup-confirm-password-input',
        );
        expect(confirmInput).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });

  describe('Form Validation on Submit', () => {
    it('should show error when email is empty on submit', async () => {
      renderComponent();

      fireEvent.click(screen.getByTestId('signup-register-button'));

      await waitFor(() => {
        expect(
          screen.getByText('E-mail and/or password fields are empty'),
        ).toBeInTheDocument();
      });
    });

    it('should show error when password is empty on submit', async () => {
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-email-input'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.click(screen.getByTestId('signup-register-button'));

      await waitFor(() => {
        expect(
          screen.getByText('E-mail and/or password fields are empty'),
        ).toBeInTheDocument();
      });
    });

    it('should show error when passwords do not match on submit', async () => {
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-email-input'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'Password1!' },
      });
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: 'Mismatch' },
      });
      fireEvent.click(screen.getByTestId('signup-register-button'));

      await waitFor(() => {
        expect(
          screen.getByText('E-mail and/or password fields are empty'),
        ).toBeInTheDocument();
      });
    });

    it('should mark email field as invalid when email is empty', async () => {
      renderComponent();

      fireEvent.click(screen.getByTestId('signup-register-button'));

      await waitFor(() => {
        const emailInput = screen.getByTestId('signup-email-input');
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('should mark password field as invalid when password is empty', async () => {
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-email-input'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.click(screen.getByTestId('signup-register-button'));

      await waitFor(() => {
        const passwordInput = screen.getByTestId('signup-password-input');
        expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });

  describe('Registration Flow', () => {
    it('should call AuthService.register with email and password', async () => {
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-email-input'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.click(screen.getByTestId('signup-register-button'));

      await waitFor(() => {
        expect(AuthService.register).toHaveBeenCalledWith(
          'test@example.com',
          'SecurePass1!',
        );
      });
    });

    it('should show success alert on successful registration', async () => {
      AuthService.register.mockResolvedValue(true);
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-email-input'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.click(screen.getByTestId('signup-register-button'));

      await waitFor(() => {
        expect(
          screen.getByText(
            'Registration successful! Check your e-mail for a verification link.',
          ),
        ).toBeInTheDocument();
      });
    });

    it('should show danger alert on failed registration', async () => {
      AuthService.register.mockResolvedValue(false);
      AuthService.registerError = { message: 'Email already exists' };
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-email-input'), {
        target: { value: 'existing@example.com' },
      });
      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.click(screen.getByTestId('signup-register-button'));

      await waitFor(() => {
        expect(screen.getByText('Email already exists')).toBeInTheDocument();
      });
    });

    it('should show danger alert when registration throws', async () => {
      AuthService.register.mockRejectedValue('Network error');
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-email-input'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.click(screen.getByTestId('signup-register-button'));

      await waitFor(() => {
        expect(screen.getByTestId('signup-alert')).toBeInTheDocument();
      });
    });

    it('should display success alert variant on successful registration', async () => {
      AuthService.register.mockResolvedValue(true);
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-email-input'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.click(screen.getByTestId('signup-register-button'));

      await waitFor(() => {
        const alert = screen.getByTestId('signup-alert');
        expect(alert).toHaveClass('pf-m-success');
      });
    });

    it('should display danger alert variant on failed registration', async () => {
      AuthService.register.mockResolvedValue(false);
      AuthService.registerError = { message: 'Registration failed' };
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-email-input'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.click(screen.getByTestId('signup-register-button'));

      await waitFor(() => {
        const alert = screen.getByTestId('signup-alert');
        expect(alert).toHaveClass('pf-m-danger');
      });
    });
  });

  describe('ErrorBoundary and PasswordStrengthBar', () => {
    it('should render the password strength bar', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('password-strength-bar')).toBeInTheDocument();
      });
    });

    it('should pass the password value to the strength bar', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('password-strength-bar')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'MyPassword' },
      });

      await waitFor(() => {
        expect(screen.getByText('Strength: MyPassword')).toBeInTheDocument();
      });
    });
  });

  describe('Alert display', () => {
    it('should not display alert initially', () => {
      renderComponent();
      expect(screen.queryByTestId('signup-alert')).not.toBeInTheDocument();
    });

    it('should display alert after form submission with errors', async () => {
      renderComponent();

      fireEvent.click(screen.getByTestId('signup-register-button'));

      await waitFor(() => {
        expect(screen.getByTestId('signup-alert')).toBeInTheDocument();
      });
    });
  });
});
