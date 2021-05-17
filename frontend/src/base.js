import React from 'react';

import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { App } from './app';
import { Login } from './login';
import { ProtectedRoute } from './components/protected-route';
import { AuthService } from './services/auth';

export const Base = () => {
  return (
    <Router>
      <Switch>
        <Route path="/login" exact component={Login} />
        <Route path="/sign-up" exact component={Login} />
        <Route path="/forgot-password" exact component={Login} />
        <ProtectedRoute path="/" isLoggedIn={AuthService.isLoggedIn()} redirectRoute="/login" component={App} />
      </Switch>
    </Router>
  );
};
