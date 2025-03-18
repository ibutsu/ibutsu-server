import React from 'react';

import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { App } from './app';
import Admin from './admin';
import Profile from './profile';
import Login from './login';
import { SignUp } from './sign-up';
import { ForgotPassword } from './forgot-password';
import { ResetPassword } from './reset-password';
import { AuthService } from './services/auth';
import ElementWrapper from './components/elementWrapper';
import { IbutsuContextProvider } from './services/context';

export const Base = () => (
  <IbutsuContextProvider>
    <Router>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="sign-up" element={<ElementWrapper routeElement={SignUp} />} />
        <Route path="forgot-password" element={<ElementWrapper routeElement={ForgotPassword} />} />
        <Route path="reset-password/:activationCode" element={<ElementWrapper routeElement={ResetPassword} />} />
        <Route
          path="profile/*"
          element={AuthService.isLoggedIn() ? <Profile /> : <Navigate to="/login" />}
        />
        <Route
          path="admin/*"
          element={AuthService.isLoggedIn() && AuthService.isSuperAdmin() ? <Admin /> : <Navigate to="/login" />}
        />
        <Route
          path="project/*"
          element={AuthService.isLoggedIn() ? <App /> : <Navigate to="/login" />}
        />
        <Route path="*" element={<Navigate to="project" replace />} />
      </Routes>
    </Router>
  </IbutsuContextProvider>
);
