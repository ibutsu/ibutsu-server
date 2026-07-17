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
    AuthService.register = vi.fn().mockResolvedValue(true);
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

    it('should toggle confirm password back to hidden on second click', async () => {
      renderComponent();
      const toggleButton = screen.getByTestId(
        'signup-confirm-password-toggle-button',
      );

      fireEvent.click(toggleButton);
      await waitFor(() => {
        expect(
          screen.getByTestId('signup-confirm-password-input'),
        ).toHaveAttribute('type', 'text');
      });

      fireEvent.click(toggleButton);
      await waitFor(() => {
        expect(
          screen.getByTestId('signup-confirm-password-input'),
        ).toHaveAttribute('type', 'password');
      });
    });

    it('should preserve input value when toggling visibility', async () => {
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'MySecret123' },
      });

      const toggleButton = screen.getByTestId('signup-password-toggle-button');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        const input = screen.getByTestId('signup-password-input');
        expect(input).toHaveAttribute('type', 'text');
        expect(input).toHaveValue('MySecret123');
      });
    });

    it('should update aria-label when password visibility changes', async () => {
      renderComponent();
      const toggleButton = screen.getByTestId('signup-password-toggle-button');

      expect(toggleButton).toHaveAttribute('aria-label', 'Show password');

      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(toggleButton).toHaveAttribute('aria-label', 'Hide password');
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

    it('should reset to default validation when confirm password is cleared', async () => {
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: 'SecurePass1!' },
      });

      await waitFor(() => {
        expect(screen.getByText('Passwords match!')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: '' },
      });

      await waitFor(() => {
        const confirmInput = screen.getByTestId(
          'signup-confirm-password-input',
        );
        expect(confirmInput).not.toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByText('Passwords match!')).not.toBeInTheDocument();
      });
    });

    it('should remain default when confirm is empty regardless of password value', async () => {
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'SomePassword' },
      });

      await waitFor(() => {
        const confirmInput = screen.getByTestId(
          'signup-confirm-password-input',
        );
        expect(confirmInput).not.toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('should update validation when password changes after confirm is set', async () => {
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'SecurePass1!' },
      });
      fireEvent.change(screen.getByTestId('signup-confirm-password-input'), {
        target: { value: 'SecurePass1!' },
      });

      await waitFor(() => {
        expect(screen.getByText('Passwords match!')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('signup-password-input'), {
        target: { value: 'Changed!' },
      });

      await waitFor(() => {
        const confirmInput = screen.getByTestId(
          'signup-confirm-password-input',
        );
        expect(confirmInput).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByText('Passwords match!')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Validation on Submit', () => {
    it('should show error when email is empty on submit', async () => {
      renderComponent();

      fireEvent.click(screen.getByTestId('signup-register-button'));

      await waitFor(() => {
        expect(
          screen.getByText('Please enter a valid e-mail address'),
        ).toBeInTheDocument();
      });
    });

    it('should show error when email format is invalid on submit', async () => {
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-email-input'), {
        target: { value: 'not-an-email' },
      });
      fireEvent.click(screen.getByTestId('signup-register-button'));

      await waitFor(() => {
        expect(
          screen.getByText('Please enter a valid e-mail address'),
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
          screen.getByText('Passwords do not match or are empty'),
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
          screen.getByText('Passwords do not match or are empty'),
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

    it('should accept valid email formats', async () => {
      renderComponent();

      fireEvent.change(screen.getByTestId('signup-email-input'), {
        target: { value: 'user@domain.co.uk' },
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
          'user@domain.co.uk',
          'SecurePass1!',
        );
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

    it('should show fallback message when registerError is null', async () => {
      AuthService.register.mockResolvedValue(false);
      AuthService.registerError = null;
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
        expect(screen.getByText('Registration failed')).toBeInTheDocument();
      });
    });

    it('should show error message from Error object when registration throws', async () => {
      AuthService.register.mockRejectedValue(
        new Error('Network connection lost'),
      );
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
          screen.getByText('Network connection lost'),
        ).toBeInTheDocument();
      });
    });

    it('should show string error when registration throws a string', async () => {
      AuthService.register.mockRejectedValue('Something went wrong');
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
          screen.getByText('Something went wrong'),
        ).toBeInTheDocument();
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
