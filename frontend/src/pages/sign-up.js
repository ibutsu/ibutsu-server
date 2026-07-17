import { lazy, useState, Suspense } from 'react';
import {
  ActionGroup,
  Alert,
  Button,
  Form,
  FormAlert,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  InputGroup,
  InputGroupItem,
  LoginMainFooterBandItem,
  LoginPage,
  TextInput,
} from '@patternfly/react-core';
import EyeIcon from '@patternfly/react-icons/dist/esm/icons/eye-icon';
import EyeSlashIcon from '@patternfly/react-icons/dist/esm/icons/eye-slash-icon';
import { NavLink } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

import { AuthService } from '../utilities/auth';

const PasswordStrengthBar = lazy(() =>
  import('react-password-strength-bar').then((m) => ({
    default: m.default?.default || m.default,
  })),
);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SignUp = () => {
  const [alertText, setAlertText] = useState('');
  const [alertType, setAlertType] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [isValidEmail, setIsValidEmail] = useState(true);
  const [passwordValue, setPasswordValue] = useState('');
  const [isValidPassword, setIsValidPassword] = useState(true);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('');
  const [confirmPasswordHelpText, setConfirmPasswordHelpText] = useState('');
  const [confirmPasswordValidation, setConfirmPasswordValidation] =
    useState('default');
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);

  const validatePasswordMatch = (password, confirmPassword) => {
    if (confirmPassword === '') {
      setConfirmPasswordHelpText('');
      setConfirmPasswordValidation('default');
    } else if (password === confirmPassword) {
      setConfirmPasswordHelpText('Passwords match!');
      setConfirmPasswordValidation('success');
    } else {
      setConfirmPasswordHelpText('');
      setConfirmPasswordValidation('error');
    }
  };

  const onEmailChange = (_, value) => {
    setEmailValue(value);
  };

  const onPasswordChange = (_, value) => {
    setPasswordValue(value);
    validatePasswordMatch(value, confirmPasswordValue);
  };

  const onConfirmPasswordChange = (_, value) => {
    setConfirmPasswordValue(value);
    validatePasswordMatch(passwordValue, value);
  };

  const onPasswordVisibleClick = () => {
    setIsPasswordVisible((prev) => !prev);
  };

  const onConfirmPasswordVisibleClick = () => {
    setIsConfirmPasswordVisible((prev) => !prev);
  };

  const onRegisterButtonClick = async (event) => {
    event.preventDefault();
    const validEmail = !!emailValue && EMAIL_REGEX.test(emailValue);
    const validPassword =
      !!passwordValue && passwordValue === confirmPasswordValue;
    setIsValidEmail(validEmail);
    setIsValidPassword(validPassword);
    if (validEmail && validPassword) {
      try {
        const isSuccess = await AuthService.register(
          emailValue,
          passwordValue,
        );
        if (isSuccess) {
          setAlertText(
            'Registration successful! Check your e-mail for a verification link.',
          );
          setAlertType('success');
          setShowAlert(true);
        } else {
          setAlertText(
            AuthService.registerError?.message ?? 'Registration failed',
          );
          setAlertType('danger');
          setShowAlert(true);
        }
      } catch (error) {
        setAlertText(error?.message ?? String(error));
        setAlertType('danger');
        setShowAlert(true);
      }
    } else {
      if (!validEmail) {
        setAlertText('Please enter a valid e-mail address');
      } else {
        setAlertText('Passwords do not match or are empty');
      }
      setAlertType('danger');
      setShowAlert(true);
    }
  };

  const loginMessage = (
    <LoginMainFooterBandItem>
      Already registered? <NavLink to="/login">Log in.</NavLink>
    </LoginMainFooterBandItem>
  );

  const forgotCredentials = (
    <LoginMainFooterBandItem>
      <NavLink to="/forgot-password">Forgot username or password?</NavLink>
    </LoginMainFooterBandItem>
  );

  return (
    <LoginPage
      footerListVariants="inline"
      brandImgSrc="/images/ibutsu-wordart-164.png"
      brandImgAlt="Ibutsu"
      textContent="Ibutsu is an open source test result aggregation. Collect and display your test results, view artifacts, and monitor tests."
      loginTitle="Register a new account"
      loginSubtitle="Please type in your e-mail address and a secure password"
      signUpForAccountMessage={loginMessage}
      forgotCredentials={forgotCredentials}
    >
      <Form ouiaId="signup-form">
        {showAlert && (
          <FormAlert>
            <Alert
              variant={alertType}
              title={alertText}
              aria-live="polite"
              isInline
              ouiaId="signup-alert"
            />
          </FormAlert>
        )}
        <FormGroup label="Email address" isRequired fieldId="email">
          <TextInput
            isRequired
            type="email"
            id="email"
            name="email"
            validated={isValidEmail ? 'default' : 'error'}
            aria-describedby="email-helper"
            value={emailValue}
            onChange={onEmailChange}
            ouiaId="signup-email-input"
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                The e-mail address you want to use to log in
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>
        <FormGroup label="Password" isRequired fieldId="password">
          <InputGroup>
            <TextInput
              isRequired
              type={isPasswordVisible ? 'text' : 'password'}
              id="password"
              name="password"
              validated={isValidPassword ? 'default' : 'error'}
              aria-describedby="password-helper"
              value={passwordValue}
              onChange={onPasswordChange}
              ouiaId="signup-password-input"
            />
            <InputGroupItem>
              <Button
                variant="control"
                aria-label={
                  isPasswordVisible ? 'Hide password' : 'Show password'
                }
                onClick={onPasswordVisibleClick}
                ouiaId="signup-password-toggle-button"
              >
                {isPasswordVisible ? <EyeSlashIcon /> : <EyeIcon />}
              </Button>
            </InputGroupItem>
          </InputGroup>
          <ErrorBoundary fallback={<div>Failed to load password strength indicator</div>}>
            <Suspense fallback="">
              <PasswordStrengthBar password={passwordValue} />
            </Suspense>
          </ErrorBoundary>
        </FormGroup>
        <FormGroup
          label="Confirm password"
          isRequired
          fieldId="confirm-password"
        >
          <InputGroup>
            <TextInput
              isRequired
              type={isConfirmPasswordVisible ? 'text' : 'password'}
              id="confirm-password"
              name="confirm-password"
              aria-describedby="confirm-password-helper"
              value={confirmPasswordValue}
              onChange={onConfirmPasswordChange}
              validated={confirmPasswordValidation}
              ouiaId="signup-confirm-password-input"
            />
            <InputGroupItem>
              <Button
                variant="control"
                aria-label={
                  isConfirmPasswordVisible ? 'Hide password' : 'Show password'
                }
                onClick={onConfirmPasswordVisibleClick}
                ouiaId="signup-confirm-password-toggle-button"
              >
                {isConfirmPasswordVisible ? <EyeSlashIcon /> : <EyeIcon />}
              </Button>
            </InputGroupItem>
          </InputGroup>
          <FormHelperText>
            <HelperText>
              <HelperTextItem variant={confirmPasswordValidation}>
                {confirmPasswordHelpText}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>
        <ActionGroup>
          <Button
            variant="primary"
            isBlock
            onClick={onRegisterButtonClick}
            ouiaId="signup-register-button"
          >
            Register
          </Button>
        </ActionGroup>
      </Form>
    </LoginPage>
  );
};

export default SignUp;
