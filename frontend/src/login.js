import React, { useEffect } from 'react';
import {
  Alert,
  ActionGroup,
  Button,
  Form,
  FormAlert,
  FormGroup,
  InputGroup,
  InputGroupItem,
  LoginMainFooterBandItem,
  LoginMainFooterLinksItem,
  LoginPage,
  TextInput
} from '@patternfly/react-core';
import { EyeIcon, EyeSlashIcon, GoogleIcon, FacebookIcon, GithubIcon, GitlabIcon, RedhatIcon, KeyIcon } from '@patternfly/react-icons';
import { NavLink, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import OAuth2Login from 'react-simple-oauth2-login';
import FacebookLogin from '@greatsumini/react-facebook-login';

import { HttpClient } from './services/http';
import { AuthService } from './services/auth';
import { KeycloakService } from './services/keycloak';
import { Settings } from './settings';
import { IbutsuContext } from './services/context';

const getLocationFrom = (location) => {
  let { from } = location.state || {from: {pathname: '/'}};
  if (from.pathname === '/login') {
    from.pathname = '/';
  }
  return from;
};

const getAlert = (location) => {
  const alert = {status: 'info'};
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

function getUser (location) {
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
}

const Login = () => {
  const location = useLocation();
  const context = React.useContext(IbutsuContext);

  const {setPrimaryObject} = context;

  const [emailValue, setEmailValue] = React.useState('');
  const [isValidEmail, setIsValidEmail] = React.useState(true);
  const [passwordValue, setPasswordValue] = React.useState('');
  const [isValidPassword, setIsValidPassword] = React.useState(true);
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const [loginSupport, setLoginSupport] = React.useState({});
  const [externalLogins, setExternalLogins] = React.useState({});
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [from] = React.useState(getLocationFrom(location));
  const [alert, setAlert] = React.useState(getAlert(location));


  useEffect(() => {
    const user = getUser(location);
    if (user) {
      AuthService.setUser(user);
      window.location = '/';
    }
  }, [location]);

  const onLoginButtonClick = (event) => {
    // check if null to allow login via enter key
    setIsLoggingIn(true);
    if (event) {
      event.preventDefault();
    }
    let RaiseAlert = null,
      emailCheck = !!emailValue,
      passCheck = !!passwordValue;

    if (!emailCheck || !passCheck) {
      RaiseAlert = {message: 'E-mail and/or password fields are blank', status: 'danger'};
    }
    setIsValidEmail(emailCheck);
    setIsValidPassword(passCheck);
    setAlert(RaiseAlert);
    if (isValidEmail && isValidPassword) {
      AuthService.login(emailValue, passwordValue)
        .then(isLoggedIn => {
          if (isLoggedIn) {
            setPrimaryObject();
            window.location = from.pathname;
          }
          else {
            setAlert({message: AuthService.loginError.message, status: 'danger'});
            setIsLoggingIn(false);
            setIsValidEmail(false);
            setIsValidPassword(false);
          }
        })
        .catch(error => {
          setAlert({message: error, status: 'danger'});
          setIsLoggingIn(false);
          setIsValidEmail(false);
          setIsValidPassword(false);
        });
    }
    else {
      setIsLoggingIn(false);
    }
  };

  const onEnterKeyPress = (target) => {
    // allow login by pressing the enter key
    if (target.charCode === 13) {
      onLoginButtonClick();
    }
  };

  const onOAuth2Success = (response) => {
    // Make sure there are no active projects or dashboards selected
    setPrimaryObject();
    AuthService.setUser(response);
    window.location = from.pathname;
  };

  const onGoogleLogin = (response) => {
    const { redirect_uri } = externalLogins.google;
    HttpClient.get([redirect_uri], {'code': response['tokenId']})
      .then(response => response.json())
      .then(user => {
        // Make sure there are no active projects or dashboards selected
        setPrimaryObject();
        AuthService.setUser(user);
        window.location = from.pathname;
      });
  };

  const onKeycloakLogin = () => {
    const { server_url, realm, client_id } = externalLogins.keycloak;

    setIsLoggingIn(true);
    // Make sure there are no active projects or dashboards selected
    setPrimaryObject();
    KeycloakService.login(server_url, realm, client_id);
  };

  const onFacebookLogin = () => {
    alert('Facebook login not implemented yet');
  };

  useEffect(() => {
    HttpClient.get([Settings.serverUrl, 'login', 'support'])
      .then(response => response.json())
      .then(data => {
        setLoginSupport(data);
        for (const [key, value] of Object.entries(data)) {
          if (key !== 'user' && value) {
            HttpClient.get([Settings.serverUrl, 'login', 'config', key])
              .then(response => response.json())
              .then(data => {
                setExternalLogins((prevLogins) => ({...prevLogins, [key]: data}));
              });
          }
        }
      });
  }, []);

  const getKeycloakIcon = () => {
    const hasIcon = Object.prototype.hasOwnProperty.call(externalLogins.keycloak, 'icon');
    if (hasIcon && externalLogins.keycloak.icon.startsWith('http')) {
      return <img src={externalLogins.keycloak.icon} alt="Keycloak Icon"/>;
    }
    else if (hasIcon && externalLogins.keycloak.icon.toLowerCase() === 'redhat') {
      return <RedhatIcon size="lg" />;
    }
    else {
      return <KeyIcon size="lg" />;
    }
  };

  const getKeycloakName = () => {
    if (!Object.prototype.hasOwnProperty.call(externalLogins.keycloak, 'display_name')) {
      return 'Keycloak';
    }
    return externalLogins.keycloak.display_name;
  };

  const socialMediaLoginContent = (
    <React.Fragment>
      {externalLogins.keycloak &&
    <LoginMainFooterLinksItem onClick={onKeycloakLogin} href="#" linkComponentProps={{ 'aria-label': `Login with ${getKeycloakName()}`, 'title': `Login with ${getKeycloakName()}` }}>
      {getKeycloakIcon()}
    </LoginMainFooterLinksItem>
      }
      {externalLogins.google &&
      <GoogleLogin
        clientId={externalLogins.google.client_id}
        scope={externalLogins.google.scope}
        redirectUri={externalLogins.google.redirect_uri}
        onSuccess={onGoogleLogin}
        onFailure={(response) => console.error(response)}
        render={renderProps => (
          <LoginMainFooterLinksItem onClick={renderProps.onClick} href="#" linkComponentProps={{ 'aria-label': 'Login with Google', 'title': 'Login with Google' }}>
            <GoogleIcon size="lg" />
          </LoginMainFooterLinksItem>
        )}
      />
      }
      {externalLogins.github &&
      <OAuth2Login
        isCrossOrigin={true}
        authorizationUrl={externalLogins.github.authorization_url}
        responseType="code"
        clientId={externalLogins.github.client_id}
        redirectUri={externalLogins.github.redirect_uri}
        scope={externalLogins.github.scope}
        onSuccess={onOAuth2Success}
        onFailure={(response) => console.error(response)}
        render={renderProps => (
          <LoginMainFooterLinksItem onClick={renderProps.onClick} href="#" linkComponentProps={{ 'aria-label': 'Login with GitHub', 'title': 'Login with GitHub' }}>
            <GithubIcon size="lg" />
          </LoginMainFooterLinksItem>
        )}
      />
      }
      {externalLogins.facebook &&
      <FacebookLogin
        appId={externalLogins.facebook.app_id}
        onSuccess={onFacebookLogin}
        onFail={(response) => console.error(response)}
        // useRedirect={true}
        dialogParams={{redirect_uri: externalLogins.facebook.redirect_uri, response_type: 'code'}}
        render={(renderProps) => (
          <LoginMainFooterLinksItem onClick={renderProps.onClick} href="#" linkComponentProps={{ 'aria-label': 'Login with Facebook' }}>
            <FacebookIcon size="lg" />
          </LoginMainFooterLinksItem>
        )}
      />
      }
      {externalLogins.gitlab &&
        <OAuth2Login
          isCrossOrigin={true}
          authorizationUrl={externalLogins.gitlab.authorization_url}
          responseType="code"
          clientId={externalLogins.gitlab.client_id}
          redirectUri={externalLogins.gitlab.redirect_uri}
          scope={externalLogins.gitlab.scope}
          onSuccess={onOAuth2Success}
          onFailure={(response) => console.error(response)}
          render={renderProps => (
            <LoginMainFooterLinksItem onClick={renderProps.onClick} href="#" linkComponentProps={{ 'aria-label': 'Login with GitLab', 'title': 'Login with GitLab' }}>
              <GitlabIcon size="lg" />
            </LoginMainFooterLinksItem>
          )}
        />
      }
    </React.Fragment>
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
  const loginWithUserDescription = 'Please use your e-mail address and password, or login via one of the icons below the Log In button.';
  const loginWithoutUserDescription = 'Log in via one of the icons below.';

  const backgroundImages = {
    lg: '/images/pfbg_1200.jpg',
    sm: '/images/pfbg_768.jpg',
    sm2x: '/images/pfbg_768@2x.jpg',
    xs: '/images/pfbg_576.jpg',
    xs2x: '/images/pfbg_576@2x.jpg'
  };

  return (
    <LoginPage
      footerListVariants="inline"
      brandImgSrc="/images/ibutsu-wordart-164.png"
      brandImgAlt="Ibutsu"
      backgroundImgSrc={backgroundImages}
      textContent="Ibutsu is an open source test result aggregation tool. Collect and display your test results, view artifacts, and monitor tests."
      loginTitle="Log in to your account"
      loginSubtitle={loginSupport.user ? loginWithUserDescription : loginWithoutUserDescription}
      socialMediaLoginContent={socialMediaLoginContent}
      signUpForAccountMessage={loginSupport.user ? signUpForAccountMessage : ''}
      forgotCredentials={loginSupport.user ? forgotCredentials : ''}
    >
      {loginSupport.user &&
      <Form>
        <FormAlert>
          {alert && alert.message &&
          <Alert
            variant={alert.status || 'info'}
            title={alert.message}
            aria-live="polite"
            isInline
          />
          }
        </FormAlert>
        <FormGroup
          label="Email address"
          isRequired
          fieldId="email"
          validated={isValidEmail ? 'default' : 'error'}
        >
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
          />
        </FormGroup>
        <FormGroup
          label="Password"
          isRequired
          fieldId="password"
          validated={isValidPassword ? 'default' : 'error'}
        >
          <InputGroup>
            {!isPasswordVisible &&
            <TextInput
              isRequired
              type="password"
              id="password"
              name="password"
              validated={isValidPassword ? 'default' : 'error'}
              aria-describedby="password-helper"
              value={passwordValue}
              onChange={(_, value) => setPasswordValue(value)}
              onKeyDown={onEnterKeyPress} />
            }
            {isPasswordVisible &&
            <TextInput
              isRequired
              type="text"
              id="password"
              name="password"
              validated={isValidPassword ? 'default' : 'error'}
              aria-describedby="password-helper"
              value={passwordValue}
              onChange={(_, value) => setPasswordValue(value)}
              onKeyDown={onEnterKeyPress} />
            }
            <InputGroupItem><Button variant="control" aria-label="Show password" onClick={setIsPasswordVisible(!isPasswordVisible)}>
              {!isPasswordVisible && <EyeIcon/>}
              {isPasswordVisible && <EyeSlashIcon/>}
            </Button></InputGroupItem>
          </InputGroup>
        </FormGroup>
        <ActionGroup>
          <Button
            variant="primary"
            isBlock
            isLoading={isLoggingIn}
            isDisabled={isLoggingIn}
            onClick={onLoginButtonClick}
          >
            {isLoggingIn ? 'Logging in...' : 'Log In'}
          </Button>
        </ActionGroup>
      </Form>
      }
    </LoginPage>
  );
};

Login.propTypes = {};

export default Login;
