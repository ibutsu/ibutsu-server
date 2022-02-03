import React from 'react';

import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { App } from './app';
import { Admin } from './admin';
import { Profile } from './profile';
import { Login } from './login';
import { SignUp } from './sign-up';
import { ForgotPassword } from './forgot-password';
import { ResetPassword } from './reset-password';
import { ProtectedRoute } from './components/protected-route';
import { AuthService } from './services/auth';

export const Base = () => {
  return (
    <Router>
      <Switch>
        <Route path="/login" exact component={Login} />
        <Route path="/sign-up" exact component={SignUp} />
        <Route path="/forgot-password" exact component={ForgotPassword} />
        <Route path="/reset-password/:activationCode" exact component={ResetPassword} />
        <ProtectedRoute path="/profile*" exact isLoggedIn={AuthService.isLoggedIn()} redirectRoute="/login" component={Profile} />
        <ProtectedRoute path="/admin*" exact isLoggedIn={AuthService.isLoggedIn()} redirectRoute="/" component={Admin} />
        <ProtectedRoute path="/" isLoggedIn={AuthService.isLoggedIn()} redirectRoute="/login" component={App} />
      </Switch>
    </Router>
  );
};
