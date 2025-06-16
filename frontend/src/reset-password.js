import React, { useState, useCallback, useMemo, Suspense } from 'react';
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
import { EyeIcon, EyeSlashIcon } from '@patternfly/react-icons';
import { NavLink, useParams } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

import { AuthService } from './services/auth';

// Lazy import the password strength indicator, it uses a very big library
const PasswordStrengthBar = React.lazy(() =>
  import('react-password-strength-bar').catch(() => ({
    default: () => <div>Failed to load password strength indicator</div>,
  })),
);

const ResetPassword = () => {
  const params = useParams();

  const [activationCode] = useState(params.activationCode);
  const [alertText, setAlertText] = useState('');
  const [alertType, setAlertType] = useState('');
  const [showAlert, setShowAlert] = useState(false);
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

  const onResetButtonClick = async (event) => {
    event.preventDefault();
    const isValidPassword = !!passwordValue;
    setIsValidPassword(isValidPassword);
    if (isValidPassword) {
      try {
        const isSuccess = await AuthService.resetPassword(
          activationCode,
          passwordValue,
        );
        if (isSuccess) {
          setAlertText(
            'Your password has been reset. You can now login with your new password',
          );
          setAlertType('success');
          setShowAlert(true);
        } else {
          setAlertText(AuthService.resetError.message);
          setAlertType('danger');
          setShowAlert(true);
        }
      } catch (error) {
        setAlertText(error);
        setAlertType('danger');
        setShowAlert(true);
      }
    } else {
      setAlertText('Password fields are empty');
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
      loginTitle="Reset your password"
      loginSubtitle="Please type in a secure password"
      signUpForAccountMessage={loginMessage}
      forgotCredentials={forgotCredentials}
    >
      <Form>
        {showAlert && (
          <FormAlert>
            <Alert
              variant={alertType}
              title={alertText}
              aria-live="polite"
              isInline
            />
          </FormAlert>
        )}
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
              />
            )}
            <InputGroupItem>
              <Button
                variant="control"
                aria-label="Show password"
                onClick={onPasswordVisibleClick}
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
              />
            )}
            <InputGroupItem>
              <Button
                variant="control"
                aria-label="Show password"
                onClick={onConfirmPasswordVisibleClick}
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
          <Button variant="primary" isBlock onClick={onResetButtonClick}>
            Reset Password
          </Button>
        </ActionGroup>
      </Form>
    </LoginPage>
  );
};

ResetPassword.propTypes = {};

export default ResetPassword;
