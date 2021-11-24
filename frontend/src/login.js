import React from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  ActionGroup,
  Button,
  Form,
  FormAlert,
  FormGroup,
  InputGroup,
  // LoginForm,
  LoginMainFooterBandItem,
  LoginMainFooterLinksItem,
  LoginPage,
  TextInput
} from '@patternfly/react-core';
import { EyeIcon, EyeSlashIcon, GoogleIcon, FacebookIcon, GithubIcon, GitlabIcon, RedhatIcon, KeyIcon } from '@patternfly/react-icons';
import { NavLink } from 'react-router-dom';
import { GoogleLogin } from 'react-google-login';
import OAuth2Login from 'react-simple-oauth2-login';
import FacebookLogin from '@greatsumini/react-facebook-login';

import { HttpClient } from './services/http';
import { AuthService } from './services/auth';
import { KeycloakService } from './services/keycloak';
import { Settings } from './settings';

function getLocationFrom(location) {
  let { from } = location.state || {from: {pathname: '/'}};
  if (from.pathname === '/login') {
    from.pathname = '/';
  }
  return from;
}

function getAlert(location) {
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
}

function getUser(location) {
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

export class Login extends React.Component {
  static propTypes = {
    location: PropTypes.object,
    history: PropTypes.object
  };

  constructor(props) {
    super(props);
    this.state = {
      emailValue: '',
      isValidEmail: true,
      passwordValue: '',
      isValidPassword: true,
      isPasswordVisible: false,
      externalLogins: {},
      from: getLocationFrom(props.location),
      alert: getAlert(props.location)
    };
    const user = getUser(props.location);
    if (user) {
      AuthService.setUser(user);
      window.location = '/';
    }
  }

  onEmailChange = emailValue => {
    this.setState({ emailValue });
  }

  onPasswordChange = passwordValue => {
    this.setState({ passwordValue });
  }

  onPasswordVisibleClick = () => {
    this.setState({isPasswordVisible: !this.state.isPasswordVisible});
  }

  onLoginButtonClick = event => {
    // check if null to allow login via enter key
    if (event) {
      event.preventDefault();
    }
    var isValidEmail = !!this.state.emailValue,
        isValidPassword = !!this.state.passwordValue,
        alert = null;
    if (!isValidEmail || !isValidPassword) {
      alert = {message: 'E-mail and/or password fields are blank', status: 'danger'};
    }
    this.setState({isValidEmail, isValidPassword, alert});
    if (isValidEmail && isValidPassword) {
      AuthService.login(this.state.emailValue, this.state.passwordValue)
        .then(isLoggedIn => {
          if (isLoggedIn) {
            window.location = this.state.from.pathname;
          }
          else {
            this.setState({
              alert: {message: AuthService.loginError.message, status: 'danger'},
              isValidEmail: false,
              isValidPassword: false
            });
          }
        })
        .catch(error => {
          this.setState({
            alert: {message: error, status: 'danger'},
            isValidEmail: false,
            isValidPassword: false
          });
        });
    }
  }

  onEnterKeyPress = (target) => {
    // allow login by pressing the enter key
    if (target.charCode == 13) {
      this.onLoginButtonClick();
    }
  }

  onOAuth2Success = (response) => {
    AuthService.setUser(response);
    window.location = this.state.from.pathname;
  }

  onGoogleLogin = (response) => {
    const { redirect_uri } = this.state.externalLogins.google;
    HttpClient.get([redirect_uri], {"code": response["tokenId"]})
      .then(response => response.json())
      .then(user => {
        AuthService.setUser(user);
        window.location = this.state.from.pathname;
      });
  }

  onKeycloakLogin = () => {
    const { server_url, realm, client_id } = this.state.externalLogins.keycloak;
    KeycloakService.login(server_url, realm, client_id);
  }

  onFacebookLogin = (response) => {
    console.log(response);
  }

  componentDidMount() {
    HttpClient.get([Settings.serverUrl, 'login', 'support'])
      .then(response => response.json())
      .then(data => {
        for (const [key, value] of Object.entries(data)) {
          if (key !== 'user' && value) {
            HttpClient.get([Settings.serverUrl, 'login', 'config', key])
              .then(response => response.json())
              .then(data => {
                this.setState(function(previousState) {
                  let externalLogins = previousState.externalLogins;
                  externalLogins[key] = data;
                  return {externalLogins: externalLogins};
                });
              });
          }
        }
      });
  }

  getKeycloakIcon() {
    const hasIcon = Object.prototype.hasOwnProperty.call(this.state.externalLogins.keycloak, 'icon');
    if (hasIcon && this.state.externalLogins.keycloak.icon.startsWith('http')) {
      return <img src={this.state.externalLogins.keycloak.icon} alt="Keycloak Icon"/>
    }
    else if (hasIcon && this.state.externalLogins.keycloak.icon.toLowerCase() === "redhat") {
      return <RedhatIcon size="lg" />
    }
    else {
      return <KeyIcon size="lg" />;
    }
  }

  getKeycloakName() {
    if (!Object.prototype.hasOwnProperty.call(this.state.externalLogins.keycloak, 'display_name')) {
      return 'Keycloak';
    }
    return this.state.externalLogins.keycloak.display_name;
  }

  render() {
    const socialMediaLoginContent = (
      <React.Fragment>
        {this.state.externalLogins.keycloak &&
        <LoginMainFooterLinksItem onClick={this.onKeycloakLogin} href="#" linkComponentProps={{ 'aria-label': `Login with ${this.getKeycloakName()}`, 'title': `Login with ${this.getKeycloakName()}` }}>
            {this.getKeycloakIcon()}
          </LoginMainFooterLinksItem>
        }
        {this.state.externalLogins.google &&
          <GoogleLogin
            clientId={this.state.externalLogins.google.client_id}
            scope={this.state.externalLogins.google.scope}
            redirectUri={this.state.externalLogins.google.redirect_uri}
            onSuccess={this.onGoogleLogin}
            onFailure={(response) => console.error(response)}
            render={renderProps => (
              <LoginMainFooterLinksItem onClick={renderProps.onClick} href="#" linkComponentProps={{ 'aria-label': 'Login with Google', 'title': 'Login with Google' }}>
                <GoogleIcon size="lg" />
              </LoginMainFooterLinksItem>
            )}
          />
        }
        {this.state.externalLogins.github &&
          <OAuth2Login
            isCrossOrigin={true}
            authorizationUrl={this.state.externalLogins.github.authorization_url}
            responseType="code"
            clientId={this.state.externalLogins.github.client_id}
            redirectUri={this.state.externalLogins.github.redirect_uri}
            scope={this.state.externalLogins.github.scope}
            onSuccess={this.onOAuth2Success}
            onFailure={(response) => console.error(response)}
            render={renderProps => (
              <LoginMainFooterLinksItem onClick={renderProps.onClick} href="#" linkComponentProps={{ 'aria-label': 'Login with GitHub', 'title': 'Login with GitHub' }}>
                <GithubIcon size="lg" />
              </LoginMainFooterLinksItem>
            )}
          />
        }
        {this.state.externalLogins.facebook &&
          <FacebookLogin
            appId={this.state.externalLogins.facebook.app_id}
            onSuccess={this.onFacebookLogin}
            onFail={(response) => console.error(response)}
            // useRedirect={true}
            dialogParams={{redirect_uri: this.state.externalLogins.facebook.redirect_uri, response_type: 'code'}}
            render={(renderProps) => (
              <LoginMainFooterLinksItem onClick={renderProps.onClick} href="#" linkComponentProps={{ 'aria-label': 'Login with Facebook' }}>
                <FacebookIcon size="lg" />
              </LoginMainFooterLinksItem>
            )}
          />
        }
        {this.state.externalLogins.gitlab &&
            <OAuth2Login
              isCrossOrigin={true}
              authorizationUrl={this.state.externalLogins.gitlab.authorization_url}
              responseType="code"
              clientId={this.state.externalLogins.gitlab.client_id}
              redirectUri={this.state.externalLogins.gitlab.redirect_uri}
              scope={this.state.externalLogins.gitlab.scope}
              onSuccess={this.onOAuth2Success}
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
        backgroundImgAlt="Background image"
        textContent="Ibutsu is an open source test result aggregation tool. Collect and display your test results, view artifacts, and monitor tests."
        loginTitle="Log in to your account"
        loginSubtitle="Please use your e-mail address and password, or login via one of the links below."
        socialMediaLoginContent={socialMediaLoginContent}
        signUpForAccountMessage={signUpForAccountMessage}
        forgotCredentials={forgotCredentials}
      >
        <Form>
          <FormAlert>
          {this.state.alert && this.state.alert.message &&
            <Alert
              variant={this.state.alert.status || 'info'}
              title={this.state.alert.message}
              aria-live="polite"
              isInline
            />
          }
          </FormAlert>
          <FormGroup
            label="Email address"
            isRequired
            fieldId="email"
            validated={this.state.isValidEmail ? 'default' : 'error'}
          >
            <TextInput
              isRequired
              type="email"
              id="email"
              name="email"
              validated={this.state.isValidEmail ? 'default' : 'error'}
              aria-describedby="email-helper"
              value={this.state.emailValue}
              onChange={this.onEmailChange}
              onKeyPress={this.onEnterKeyPress}
            />
          </FormGroup>
          <FormGroup
            label="Password"
            isRequired
            fieldId="password"
            validated={this.state.isValidPassword ? 'default' : 'error'}
          >
            <InputGroup>
              {!this.state.isPasswordVisible &&
              <TextInput
                isRequired
                type="password"
                id="password"
                name="password"
                validated={this.state.isValidPassword ? 'default' : 'error'}
                aria-describedby="password-helper"
                value={this.state.passwordValue}
                onChange={this.onPasswordChange}
                onKeyPress={this.onEnterKeyPress} />
              }
              {this.state.isPasswordVisible &&
              <TextInput
                isRequired
                type="text"
                id="password"
                name="password"
                validated={this.state.isValidPassword ? 'default' : 'error'}
                aria-describedby="password-helper"
                value={this.state.passwordValue}
                onChange={this.onPasswordChange}
                onKeyPress={this.onEnterKeyPress} />
              }
              <Button variant="control" aria-label="Show password" onClick={this.onPasswordVisibleClick}>
                {!this.state.isPasswordVisible && <EyeIcon/>}
                {this.state.isPasswordVisible && <EyeSlashIcon/>}
              </Button>
            </InputGroup>
          </FormGroup>
          <ActionGroup>
            <Button variant="primary" isBlock onClick={this.onLoginButtonClick}>Log In</Button>
          </ActionGroup>
        </Form>
      </LoginPage>
    );
  }
}
