import React from 'react';
import PropTypes from 'prop-types';
import {
  ActionGroup,
  Alert,
  Button,
  Form,
  FormAlert,
  FormGroup,
  LoginMainFooterBandItem,
  LoginPage,
  TextInput
} from '@patternfly/react-core';
import { NavLink } from 'react-router-dom';

import { AuthService } from './services/auth';

export class ForgotPassword extends React.Component {
  static propTypes = {
    location: PropTypes.object,
    history: PropTypes.object
  };

  constructor(props) {
    super(props);
    this.state = {
      alertText: '',
      alertType: 'danger',
      showAlert: false,
      emailValue: '',
      isValidEmail: true,
    };
  }

  onEmailChange = emailValue => {
    this.setState({ emailValue });
  }

  onRecoverAccountClick = event => {
    event.preventDefault();
    var isValidEmail = !!this.state.emailValue,
        showAlert = !this.state.emailValue,
        alertText = '',
        alertType = 'danger';
    if (!isValidEmail) {
      alertText = 'E-mail field is blank';
      showAlert = true;
    }
    this.setState({isValidEmail, alertText, showAlert, alertType});
    if (isValidEmail) {
      AuthService.recover(this.state.emailValue)
        .then(isSuccess => {
          if (isSuccess) {
            this.setState({
              alertText: 'Recovery successful! Check your e-mail for a recovery link.',
              alertType: 'success',
              showAlert: true,
              isValidEmail: true
            });
          }
          else {
            this.setState({
              alertText: AuthService.recoverError.message,
              alertType: 'danger',
              showAlert: true,
              isValidEmail: false
            });
          }
        })
        .catch(error => {
          this.setState({
            alertText: error,
            alertType: 'danger',
            showAlert: true,
            isValidEmail: false
          });
        });
    }
  }

  render() {
    const signUpForAccountMessage = (
      <LoginMainFooterBandItem>
        Need an account? <NavLink to="/sign-up">Sign up.</NavLink>
      </LoginMainFooterBandItem>
    );
    const forgotCredentials = (
      <LoginMainFooterBandItem>
        Already registered? <NavLink to="/login">Log in.</NavLink>
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
        textContent="Ibutsu is an open source test result aggregation. Collect and display your test results, view artifacts, and monitor tests."
        loginTitle="Recover your account"
        loginSubtitle="Please type in your e-mail address and a reset link will be sent to it."
        signUpForAccountMessage={signUpForAccountMessage}
        forgotCredentials={forgotCredentials}
      >
        <Form>
          {this.state.showAlert &&
          <FormAlert>
            <Alert variant={this.state.alertType} title={this.state.alertText} aria-live="polite" isInline/>
          </FormAlert>
          }
          <FormGroup
            label="Email address"
            isRequired
            fieldId="email"
            validated={this.state.isValidEmail ? 'default' : 'error'}
            helperText="The e-mail address you signed up with"
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
            />
          </FormGroup>
          <ActionGroup>
            <Button variant="primary" isBlock onClick={this.onRecoverAccountClick}>Recover account</Button>
          </ActionGroup>
        </Form>
      </LoginPage>
    );
  }
}
