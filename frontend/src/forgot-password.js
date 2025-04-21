import { useState, useCallback } from 'react';
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
  LoginMainFooterBandItem,
  LoginPage,
  TextInput,
} from '@patternfly/react-core';
import { NavLink, useNavigate } from 'react-router-dom';

import { AuthService } from './services/auth';

export const ForgotPassword = () => {
  const navigate = useNavigate();

  const [alertText, setAlertText] = useState('');
  const [alertType, setAlertType] = useState('danger');
  const [showAlert, setShowAlert] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [isValidEmail, setIsValidEmail] = useState(true);

  const onEmailChange = useCallback((emailValue) => {
    setEmailValue(emailValue);
  }, []);

  const onRecoverAccountClick = async (event) => {
    event.preventDefault();
    const isValidEmail = !!emailValue;
    let showAlert = !emailValue;
    let alertText = '';
    let alertType = 'danger';
    if (!isValidEmail) {
      alertText = 'E-mail field is blank';
      showAlert = true;
    }
    setIsValidEmail(isValidEmail);
    setAlertText(alertText);
    setShowAlert(showAlert);
    setAlertType(alertType);
    if (isValidEmail) {
      try {
        const isSuccess = await AuthService.recover(emailValue);
        if (isSuccess) {
          setAlertText(
            'Recovery successful! Check your e-mail for a recovery link.',
          );
          setAlertType('success');
          setShowAlert(true);
          setIsValidEmail(true);
          navigate('/login');
        } else {
          setAlertText(AuthService.recoverError.message);
          setAlertType('danger');
          setShowAlert(true);
          setIsValidEmail(false);
        }
      } catch (error) {
        setAlertText(error);
        setAlertType('danger');
        setShowAlert(true);
        setIsValidEmail(false);
      }
    }
  };

  return (
    <LoginPage
      footerListVariants="inline"
      brandImgSrc="/images/ibutsu-wordart-164.png"
      brandImgAlt="Ibutsu"
      backgroundImgSrc={{
        lg: '/images/pfbg_1200.jpg',
        sm: '/images/pfbg_768.jpg',
        sm2x: '/images/pfbg_768@2x.jpg',
        xs: '/images/pfbg_576.jpg',
        xs2x: '/images/pfbg_576@2x.jpg',
      }}
      textContent="Ibutsu is an open source test result aggregation. Collect and display your test results, view artifacts, and monitor tests."
      loginTitle="Recover your account"
      loginSubtitle="Please type in your e-mail address and a reset link will be sent to it."
      signUpForAccountMessage={
        <LoginMainFooterBandItem>
          Need an account? <NavLink to="/sign-up">Sign up.</NavLink>
        </LoginMainFooterBandItem>
      }
      forgotCredentials={
        <LoginMainFooterBandItem>
          Already registered? <NavLink to="/login">Log in.</NavLink>
        </LoginMainFooterBandItem>
      }
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
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                The e-mail address you signed up with
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>
        <ActionGroup>
          <Button variant="primary" isBlock onClick={onRecoverAccountClick}>
            Recover account
          </Button>
        </ActionGroup>
      </Form>
    </LoginPage>
  );
};

ForgotPassword.propTypes = {};

export default ForgotPassword;
