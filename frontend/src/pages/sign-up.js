import { lazy, useState, useCallback, useMemo, Suspense } from 'react';
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

// Lazy import the password strength indicator, it uses a very big library
const PasswordStrengthBar = lazy(() =>
  import('react-password-strength-bar').catch(() => ({
    default: () => <div>Failed to load password strength indicator</div>,
  })),
);

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

  const validatePasswordMatch = useCallback(() => {
    if (confirmPasswordValue === '' && passwordValue === '') {
      setConfirmPasswordHelpText('');
      setConfirmPasswordValidation('default');
    } else if (passwordValue === confirmPasswordValue) {
      setConfirmPasswordHelpText('Passwords match!');
      setConfirmPasswordValidation('success');
    } else {
      setConfirmPasswordValidation('error');
    }
  }, [passwordValue, confirmPasswordValue]);

  const onEmailChange = useCallback((emailValue) => {
    setEmailValue(emailValue);
  }, []);

  const onPasswordChange = useCallback(
    (passwordValue) => {
      setPasswordValue(passwordValue);
      validatePasswordMatch();
    },
    [validatePasswordMatch],
  );

  const onConfirmPasswordChange = useCallback(
    (confirmPasswordValue) => {
      setConfirmPasswordValue(confirmPasswordValue);
      validatePasswordMatch();
    },
    [validatePasswordMatch],
  );

  const onPasswordVisibleClick = useCallback(() => {
    setIsPasswordVisible(!isPasswordVisible);
  }, [isPasswordVisible]);

  const onConfirmPasswordVisibleClick = useCallback(() => {
    setIsConfirmPasswordVisible(!isConfirmPasswordVisible);
  }, [isConfirmPasswordVisible]);

  const onRegisterButtonClick = async (event) => {
    event.preventDefault();
    const validEmail = !!emailValue;
    const validPassword =
      !!passwordValue && passwordValue === confirmPasswordValue;
    setIsValidEmail(validEmail);
    setIsValidPassword(validPassword);
    if (validEmail && validPassword) {
      try {
        const isSuccess = await AuthService.register(emailValue, passwordValue);
        if (isSuccess) {
          setAlertText(
            'Registration successful! Check your e-mail for a verification link.',
          );
          setAlertType('success');
          setShowAlert(true);
        } else {
          setAlertText(AuthService.registerError.message);
          setAlertType('danger');
          setShowAlert(true);
        }
      } catch (error) {
        setAlertText(error);
        setAlertType('danger');
        setShowAlert(true);
      }
    } else {
      setAlertText('E-mail and/or password fields are empty');
      setAlertType('danger');
      setShowAlert(true);
    }
  };

  const loginMessage = useMemo(
    () => (
      <LoginMainFooterBandItem>
        Already registered? <NavLink to="/login">Log in.</NavLink>
      </LoginMainFooterBandItem>
    ),
    [],
  );

  const forgotCredentials = useMemo(
    () => (
      <LoginMainFooterBandItem>
        <NavLink to="/forgot-password">Forgot username or password?</NavLink>
      </LoginMainFooterBandItem>
    ),
    [],
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
            onChange={(_, emailValue) => onEmailChange(emailValue)}
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
            {!isPasswordVisible && (
              <TextInput
                isRequired
                type="password"
                id="password"
                name="password"
                validated={isValidPassword ? 'default' : 'error'}
                aria-describedby="password-helper"
                value={passwordValue}
                onChange={(_, passwordValue) => onPasswordChange(passwordValue)}
                ouiaId="signup-password-input"
              />
            )}
            {isPasswordVisible && (
              <TextInput
                isRequired
                type="text"
                id="password"
                name="password"
                validated={isValidPassword ? 'default' : 'error'}
                aria-describedby="password-helper"
                value={passwordValue}
                onChange={(_, passwordValue) => onPasswordChange(passwordValue)}
                ouiaId="signup-password-input"
              />
            )}
            <InputGroupItem>
              <Button
                variant="control"
                aria-label="Show password"
                onClick={onPasswordVisibleClick}
                ouiaId="signup-password-toggle-button"
              >
                {!isPasswordVisible && <EyeIcon />}
                {isPasswordVisible && <EyeSlashIcon />}
              </Button>
            </InputGroupItem>
          </InputGroup>
          <ErrorBoundary fallback="Failed to load password strength indicator">
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
            {!isConfirmPasswordVisible && (
              <TextInput
                isRequired
                type="password"
                id="confirm-password"
                name="confirm-password"
                aria-describedby="confirm-password-helper"
                value={confirmPasswordValue}
                onChange={(_, confirmPasswordValue) =>
                  onConfirmPasswordChange(confirmPasswordValue)
                }
                validated={confirmPasswordValidation}
                ouiaId="signup-confirm-password-input"
              />
            )}
            {isConfirmPasswordVisible && (
              <TextInput
                isRequired
                type="text"
                id="confirm-password"
                name="confirm-password"
                aria-describedby="confirm-password-helper"
                value={confirmPasswordValue}
                onChange={(_, confirmPasswordValue) =>
                  onConfirmPasswordChange(confirmPasswordValue)
                }
                validated={confirmPasswordValidation}
                ouiaId="signup-confirm-password-input"
              />
            )}
            <InputGroupItem>
              <Button
                variant="control"
                aria-label="Show password"
                onClick={onConfirmPasswordVisibleClick}
                ouiaId="signup-confirm-password-toggle-button"
              >
                {!isConfirmPasswordVisible && <EyeIcon />}
                {isConfirmPasswordVisible && <EyeSlashIcon />}
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
