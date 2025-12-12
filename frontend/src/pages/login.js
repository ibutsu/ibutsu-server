import { useEffect, useMemo, useCallback, useState, useContext } from 'react';
import {
  Alert,
  ActionGroup,
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
  LoginMainFooterLinksItem,
  LoginPage,
  TextInput,
} from '@patternfly/react-core';
import EyeIcon from '@patternfly/react-icons/dist/esm/icons/eye-icon';
import EyeSlashIcon from '@patternfly/react-icons/dist/esm/icons/eye-slash-icon';
import GoogleIcon from '@patternfly/react-icons/dist/esm/icons/google-icon';
import FacebookIcon from '@patternfly/react-icons/dist/esm/icons/facebook-icon';
import GithubIcon from '@patternfly/react-icons/dist/esm/icons/github-icon';
import GitlabIcon from '@patternfly/react-icons/dist/esm/icons/gitlab-icon';
import RedhatIcon from '@patternfly/react-icons/dist/esm/icons/redhat-icon';
import KeyIcon from '@patternfly/react-icons/dist/esm/icons/key-icon';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import OAuth2Login from 'react-simple-oauth2-login';
import FacebookLogin from '@greatsumini/react-facebook-login';

import { HttpClient } from '../utilities/http';
import { AuthService } from '../utilities/auth';
import { KeycloakService } from '../utilities/keycloak';
import { Settings } from './settings';
import { IbutsuContext } from '../components/contexts/ibutsu-context';

const getLocationFrom = (location) => {
  let { from } = location.state || { from: { pathname: '/' } };
  if (from.pathname === '/login') {
    from.pathname = '/';
  }
  return from;
};

const getAlert = (location) => {
  const alert = { status: 'info' };
  const urlParams = new URLSearchParams(location.search);
  if (!urlParams.get('msg')) {
    return null;
  }
  alert['message'] = urlParams.get('msg');
  if (urlParams.get('st')) {
    alert['status'] = urlParams.get('st');
  }
  return alert;
};

const getSearchUser = (location) => {
  const userProperties = ['name', 'email', 'token'];
  const urlParams = new URLSearchParams(location.search);
  let user = null;
  urlParams.forEach((value, key) => {
    if (userProperties.indexOf(key) !== -1) {
      if (!user) {
        user = {};
      }
      user[key] = value;
    }
  });
  return user;
};

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const context = useContext(IbutsuContext);

  const { setPrimaryObject } = context;

  const [emailValue, setEmailValue] = useState('');
  const [isValidEmail, setIsValidEmail] = useState(true);
  const [passwordValue, setPasswordValue] = useState('');
  const [isValidPassword, setIsValidPassword] = useState(true);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loginSupport, setLoginSupport] = useState({});
  const [externalLogins, setExternalLogins] = useState({});
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [alertMessage, setAlertMessage] = useState(getAlert(location));

  const from = useMemo(() => getLocationFrom(location), [location]);

  useEffect(() => {
    const user = getSearchUser(location);
    if (user) {
      AuthService.setUser(user);
      navigate('/', { replace: true });
    }
  }, [location, navigate]);

  const onLoginButtonClick = useCallback(
    async (event) => {
      setIsLoggingIn(true);
      if (event) {
        event.preventDefault();
      }
      let RaiseAlert = null,
        emailCheck = !!emailValue,
        passCheck = !!passwordValue;

      if (!emailCheck || !passCheck) {
        RaiseAlert = {
          message: 'E-mail and/or password fields are blank',
          status: 'danger',
        };
      }
      setIsValidEmail(emailCheck);
      setIsValidPassword(passCheck);
      setAlertMessage(RaiseAlert);
      if (emailCheck && passCheck) {
        try {
          const isLoggedIn = await AuthService.login(emailValue, passwordValue);
          if (isLoggedIn) {
            setPrimaryObject();
            navigate(from?.pathname || '/', { replace: true });
          } else {
            setAlertMessage({
              message: AuthService.loginError.message,
              status: 'danger',
            });
            setIsLoggingIn(false);
            setIsValidEmail(false);
            setIsValidPassword(false);
          }
        } catch (error) {
          setAlertMessage({ message: error, status: 'danger' });
          setIsLoggingIn(false);
          setIsValidEmail(false);
          setIsValidPassword(false);
        }
      } else {
        setIsLoggingIn(false);
      }
    },
    [emailValue, passwordValue, from, setPrimaryObject, navigate],
  );

  const onEnterKeyPress = useCallback(
    (event) => {
      if (event.key === 'Enter' || event.charCode === 13) {
        onLoginButtonClick();
      }
    },
    [onLoginButtonClick],
  );

  const onOAuth2Success = useCallback(
    (response) => {
      setPrimaryObject();
      AuthService.setUser(response);
      navigate(from?.pathname || '/', { replace: true });
    },
    [from, setPrimaryObject, navigate],
  );

  const onGoogleLogin = useCallback(
    async (response) => {
      const { redirect_uri } = externalLogins.google;
      try {
        const res = await HttpClient.get([redirect_uri], {
          code: response['tokenId'],
        });
        const user = await res.json();
        setPrimaryObject();
        AuthService.setUser(user);
        navigate(from?.pathname || '/', { replace: true });
      } catch (error) {
        console.error(error);
      }
    },
    [externalLogins.google, from, setPrimaryObject, navigate],
  );

  const onKeycloakLogin = useCallback(() => {
    const { server_url, realm, client_id } = externalLogins.keycloak;
    setIsLoggingIn(true);
    setPrimaryObject();
    KeycloakService.login(server_url, realm, client_id);
  }, [externalLogins.keycloak, setPrimaryObject]);

  const onFacebookLogin = useCallback(() => {
    alert('Facebook login not implemented yet');
  }, []);

  useEffect(() => {
    const fetchLoginSupport = async () => {
      try {
        const response = await HttpClient.get([
          Settings.serverUrl,
          'login',
          'support',
        ]);
        const data = await response.json();
        setLoginSupport(data);
        for (const [key, value] of Object.entries(data)) {
          if (key !== 'user' && value) {
            const res = await HttpClient.get([
              Settings.serverUrl,
              'login',
              'config',
              key,
            ]);
            const configData = await res.json();
            setExternalLogins((prevLogins) => ({
              ...prevLogins,
              [key]: configData,
            }));
          }
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchLoginSupport();
  }, []);

  const getKeycloakIcon = useCallback(() => {
    const hasIcon = Object.prototype.hasOwnProperty.call(
      externalLogins.keycloak,
      'icon',
    );
    if (hasIcon && externalLogins.keycloak.icon.startsWith('http')) {
      return <img src={externalLogins.keycloak.icon} alt="Keycloak Icon" />;
    } else if (
      hasIcon &&
      externalLogins.keycloak.icon.toLowerCase() === 'redhat'
    ) {
      return <RedhatIcon size="lg" />;
    } else {
      return <KeyIcon size="lg" />;
    }
  }, [externalLogins.keycloak]);

  const getKeycloakName = useCallback(() => {
    if (
      !Object.prototype.hasOwnProperty.call(
        externalLogins.keycloak,
        'display_name',
      )
    ) {
      return 'Keycloak';
    }
    return externalLogins.keycloak.display_name;
  }, [externalLogins.keycloak]);

  const socialMediaLoginContent = (
    <>
      {externalLogins.keycloak && (
        <LoginMainFooterLinksItem
          data-codemods="true"
          onClick={onKeycloakLogin}
        >
          <Button
            variant="link"
            component="a"
            href="#"
            {...{
              'aria-label': `Login with ${getKeycloakName()}`,
              title: `Login with ${getKeycloakName()}`,
            }}
          >
            {getKeycloakIcon()}
          </Button>
        </LoginMainFooterLinksItem>
      )}
      {externalLogins.google && (
        <GoogleLogin
          clientId={externalLogins.google.client_id}
          scope={externalLogins.google.scope}
          redirectUri={externalLogins.google.redirect_uri}
          onSuccess={onGoogleLogin}
          onFailure={(response) => console.error(response)}
          render={(renderProps) => (
            <LoginMainFooterLinksItem
              data-codemods="true"
              onClick={renderProps.onClick}
            >
              <Button
                icon={<GoogleIcon size="lg" />}
                variant="link"
                component="a"
                href="#"
                {...{
                  'aria-label': 'Login with Google',
                  title: 'Login with Google',
                }}
              ></Button>
            </LoginMainFooterLinksItem>
          )}
        />
      )}
      {externalLogins.github && (
        <OAuth2Login
          isCrossOrigin={true}
          authorizationUrl={externalLogins.github.authorization_url}
          responseType="code"
          clientId={externalLogins.github.client_id}
          redirectUri={externalLogins.github.redirect_uri}
          scope={externalLogins.github.scope}
          onSuccess={onOAuth2Success}
          onFailure={(response) => console.error(response)}
          render={(renderProps) => (
            <LoginMainFooterLinksItem
              data-codemods="true"
              onClick={renderProps.onClick}
            >
              <Button
                icon={<GithubIcon size="lg" />}
                variant="link"
                component="a"
                href="#"
                {...{
                  'aria-label': 'Login with GitHub',
                  title: 'Login with GitHub',
                }}
              ></Button>
            </LoginMainFooterLinksItem>
          )}
        />
      )}
      {externalLogins.facebook && (
        <FacebookLogin
          appId={externalLogins.facebook.app_id}
          onSuccess={onFacebookLogin}
          onFail={(response) => console.error(response)}
          // useRedirect={true}
          dialogParams={{
            redirect_uri: externalLogins.facebook.redirect_uri,
            response_type: 'code',
          }}
          render={(renderProps) => (
            <LoginMainFooterLinksItem
              data-codemods="true"
              onClick={renderProps.onClick}
            >
              <Button
                icon={<FacebookIcon size="lg" />}
                variant="link"
                component="a"
                href="#"
                {...{ 'aria-label': 'Login with Facebook' }}
              ></Button>
            </LoginMainFooterLinksItem>
          )}
        />
      )}
      {externalLogins.gitlab && (
        <OAuth2Login
          isCrossOrigin={true}
          authorizationUrl={externalLogins.gitlab.authorization_url}
          responseType="code"
          clientId={externalLogins.gitlab.client_id}
          redirectUri={externalLogins.gitlab.redirect_uri}
          scope={externalLogins.gitlab.scope}
          onSuccess={onOAuth2Success}
          onFailure={(response) => console.error(response)}
          render={(renderProps) => (
            <LoginMainFooterLinksItem
              data-codemods="true"
              onClick={renderProps.onClick}
            >
              <Button
                icon={<GitlabIcon size="lg" />}
                variant="link"
                component="a"
                href="#"
                {...{
                  'aria-label': 'Login with GitLab',
                  title: 'Login with GitLab',
                }}
              ></Button>
            </LoginMainFooterLinksItem>
          )}
        />
      )}
    </>
  );

  const signUpForAccountMessage = (
    <LoginMainFooterBandItem>
      Need an account? <NavLink to="/sign-up">Sign up.</NavLink>
    </LoginMainFooterBandItem>
  );
  const forgotCredentials = (
    <LoginMainFooterBandItem>
      <NavLink to="/forgot-password">Forgot username or password?</NavLink>
    </LoginMainFooterBandItem>
  );
  const loginWithUserDescription =
    'Please use your e-mail address and password, or login via one of the icons below the Log In button.';
  const loginWithoutUserDescription = 'Log in via one of the icons below.';

  return (
    <LoginPage
      footerListVariants="inline"
      brandImgSrc="/images/ibutsu-wordart-164.png"
      brandImgAlt="Ibutsu"
      textContent="Ibutsu is an open source test result aggregation tool. Collect and display your test results, view artifacts, and monitor tests."
      loginTitle="Log in to your account"
      loginSubtitle={
        loginSupport.user
          ? loginWithUserDescription
          : loginWithoutUserDescription
      }
      socialMediaLoginContent={socialMediaLoginContent}
      signUpForAccountMessage={loginSupport.user ? signUpForAccountMessage : ''}
      forgotCredentials={loginSupport.user ? forgotCredentials : ''}
    >
      {loginSupport.user && (
        <Form>
          <FormAlert>
            {alertMessage && alertMessage.message && (
              <Alert
                variant={alertMessage.status || 'info'}
                title={alertMessage.message}
                aria-live="polite"
                isInline
                ouiaId="login-alert"
              />
            )}
          </FormAlert>
          <FormGroup label="Email address" isRequired fieldId="email">
            <TextInput
              isRequired
              type="email"
              id="email"
              name="email"
              validated={isValidEmail ? 'default' : 'error'}
              aria-describedby="email-helper"
              value={emailValue}
              onChange={(_, value) => setEmailValue(value)}
              onKeyDown={onEnterKeyPress}
              ouiaId="login-email-input"
            />
            {!isValidEmail && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">
                    Please enter a valid email address
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
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
                  onChange={(_, value) => setPasswordValue(value)}
                  onKeyDown={onEnterKeyPress}
                  ouiaId="login-password-input"
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
                  onChange={(_, value) => setPasswordValue(value)}
                  onKeyDown={onEnterKeyPress}
                  ouiaId="login-password-input"
                />
              )}
              <InputGroupItem>
                <Button
                  variant="control"
                  aria-label="Show password"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  ouiaId="login-password-toggle-button"
                >
                  {!isPasswordVisible && <EyeIcon />}
                  {isPasswordVisible && <EyeSlashIcon />}
                </Button>
              </InputGroupItem>
            </InputGroup>
            {!isValidPassword && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">
                    Please enter a password
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
          <ActionGroup>
            <Button
              variant="primary"
              isBlock
              isLoading={isLoggingIn}
              isDisabled={isLoggingIn}
              onClick={onLoginButtonClick}
              ouiaId="login-submit-button"
            >
              {isLoggingIn ? 'Logging in...' : 'Log In'}
            </Button>
          </ActionGroup>
        </Form>
      )}
    </LoginPage>
  );
};

Login.propTypes = {};

export default Login;
