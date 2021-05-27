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
import { ExclamationCircleIcon, DropboxIcon, GoogleIcon, FacebookIcon, GithubIcon, GitlabIcon, RedhatIcon } from '@patternfly/react-icons';
import { GoogleLogin } from 'react-google-login';
import OAuth2Login from 'react-simple-oauth2-login';

import { HttpClient } from './services/http';
import { AuthService } from './services/auth';
import { Settings } from './settings';

function getLocationFrom(location) {
  let { from } = location.state || {from: {pathname: '/'}};
  if (from.pathname === '/login') {
    from.pathname = '/';
  }
  console.log(from);
  return from;
}

export class Login extends React.Component {
  static propTypes = {
    location: PropTypes.object
  };

  constructor(props) {
    super(props);
    this.oauth2Login = React.createRef();
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

  render() {
    const socialMediaLoginContent = (
      <React.Fragment>
        {!!this.state.externalLogins.redhat &&
          <LoginMainFooterLinksItem href="#" linkComponentProps={{ 'aria-label': 'Login with Red Hat' }}>
            <RedhatIcon size="lg" />
          </LoginMainFooterLinksItem>
        }
        {this.state.externalLogins.google &&
          <GoogleLogin
            clientId={this.state.externalLogins.google.client_id}
            scope={this.state.externalLogins.google.scope}
            onSuccess={(response) => console.log(response)}
            onFailure={(response) => console.error(response)}
            render={renderProps => (
              <LoginMainFooterLinksItem onClick={renderProps.onClick} linkComponentProps={{ 'aria-label': 'Login with Google', 'title': 'Login with Google' }}>
                <GoogleIcon size="lg" />
            </LoginMainFooterLinksItem>
            )}
          />
        }
        {this.state.externalLogins.github &&
          <LoginMainFooterLinksItem href="#" linkComponentProps={{ 'aria-label': 'Login with GitHub' }}>
            <GithubIcon size="lg" />
          </LoginMainFooterLinksItem>
        }
        {this.state.externalLogins.dropbox &&
          <LoginMainFooterLinksItem href="#" linkComponentProps={{ 'aria-label': 'Login with Dropbox' }}>
            <DropboxIcon size="lg" />
          </LoginMainFooterLinksItem>
        }
        {this.state.externalLogins.facebook &&
          <LoginMainFooterLinksItem href="#" linkComponentProps={{ 'aria-label': 'Login with Facebook' }}>
            <FacebookIcon size="lg" />
          </LoginMainFooterLinksItem>
        }
        {this.state.externalLogins.gitlab &&
          <LoginMainFooterLinksItem onClick={(e) => e.preventDefault()} linkComponentProps={{ 'aria-label': 'Login with GitLab', 'title': 'Login with GitLab' }}>
            <OAuth2Login
              isCrossOrigin={true}
              authorizationUrl={this.state.externalLogins.gitlab.authorization_url}
              responseType="code"
              clientId={this.state.externalLogins.gitlab.client_id}
              redirectUri={this.state.externalLogins.gitlab.redirect_uri}
              scope={this.state.externalLogins.gitlab.scope}
              onSuccess={this.onOAuth2Success}
              onFailure={(response) => console.error(response)}
              className="pf-c-button pf-m-link pf-m-inline pf-u-p-0 pf-u-m-0"
            >
                <GitlabIcon size="lg" />
            </OAuth2Login>
          </LoginMainFooterLinksItem>
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
