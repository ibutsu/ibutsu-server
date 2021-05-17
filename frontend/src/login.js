import React from 'react';
import PropTypes from 'prop-types';
import {
  // LoginFooterItem,
  LoginForm,
  LoginMainFooterBandItem,
  LoginMainFooterLinksItem,
  LoginPage,
  // ListItem
} from '@patternfly/react-core';
import { ExclamationCircleIcon, GoogleIcon, FacebookIcon, GithubIcon, GitlabIcon, RedhatIcon, KeyIcon } from '@patternfly/react-icons';
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

export class Login extends React.Component {
  static propTypes = {
    location: PropTypes.object,
    history: PropTypes.object
  };

  constructor(props) {
    super(props);
    this.state = {
      helperText: '',
      showHelperText: false,
      emailValue: '',
      isValidEmail: true,
      passwordValue: '',
      isValidPassword: true,
      externalLogins: {},
      from: getLocationFrom(props.location)
    };
    if (props.location.search) {
      const user = {};
      const urlParams = new URLSearchParams(props.location.search);
      urlParams.forEach((value, key) => {
        user[key] = value;
      });
      AuthService.setUser(user);
      window.location = '/';
    }
  }

  handleEmailChange = emailValue => {
    this.setState({ emailValue });
  }

  handlePasswordChange = passwordValue => {
    this.setState({ passwordValue });
  }

  onLoginButtonClick = event => {
    event.preventDefault();
    var isValidEmail = !!this.state.emailValue,
        isValidPassword = !!this.state.passwordValue,
        showHelperText = !this.state.emailValue || !this.state.passwordValue,
        helperText = '';
    if (!isValidEmail || !isValidPassword) {
      helperText = 'E-mail and/or password fields are blank';
    }
    this.setState({isValidEmail, isValidPassword, showHelperText, helperText});
    if (isValidEmail && isValidPassword) {
      AuthService.login(this.state.emailValue, this.state.passwordValue)
        .then(isLoggedIn => {
          if (isLoggedIn) {
            window.location = this.state.from.pathname;
          }
          else {
            this.setState({
              helperText: AuthService.loginError.message,
              showHelperText: true,
              isValidEmail: false,
              isValidPassword: false
            });
          }
        })
        .catch(error => {
          this.setState({
            helperText: error,
            showHelperText: true,
            isValidEmail: false,
            isValidPassword: false
          });
        });
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
        Need an account? <a href="/sign-up">Sign up.</a>
      </LoginMainFooterBandItem>
    );
    const forgotCredentials = (
      <LoginMainFooterBandItem>
        <a href="/forgot-password">Forgot username or password?</a>
      </LoginMainFooterBandItem>
    );

    /* const listItem = (
      <React.Fragment>
        <ListItem>
          <LoginFooterItem href="#">Terms of Use </LoginFooterItem>
        </ListItem>
        <ListItem>
          <LoginFooterItem href="#">Help</LoginFooterItem>
        </ListItem>
        <ListItem>
          <LoginFooterItem href="#">Privacy Policy</LoginFooterItem>
        </ListItem>
      </React.Fragment>
    ); */

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
        // footerListItems={listItem}
        textContent="Ibutsu is an open source test result aggregation. Collect and display your test results, view artifacts, and monitor tests."
        loginTitle="Log in to your account"
        loginSubtitle="Please use your e-mail address and password, or login via one of the links below"
        socialMediaLoginContent={socialMediaLoginContent}
        signUpForAccountMessage={signUpForAccountMessage}
        forgotCredentials={forgotCredentials}
      >
        <LoginForm
          showHelperText={this.state.showHelperText}
          helperText={this.state.helperText}
          helperTextIcon={<ExclamationCircleIcon />}
          usernameLabel="E-mail"
          usernameValue={this.state.emailValue}
          onChangeUsername={this.handleEmailChange}
          isValidUsername={this.state.isValidEmail}
          passwordLabel="Password"
          passwordValue={this.state.passwordValue}
          isShowPasswordEnabled
          onChangePassword={this.handlePasswordChange}
          isValidPassword={this.state.isValidPassword}
          onLoginButtonClick={this.onLoginButtonClick}
        />
      </LoginPage>
    );
  }
}
