import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';
import App from './app';
import Admin from './admin';
import Profile from './profile';
import Login from '../pages/login';
import { SignUp } from '../pages/sign-up';
import ForgotPassword from '../pages/forgot-password';
import ResetPassword from '../pages/reset-password';
import { AuthService } from '../utilities/auth';
import { IbutsuContextProvider } from '../components/contexts/ibutsu-context';

export const Base = () => (
  <IbutsuContextProvider>
    <Router>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="sign-up" element={<SignUp />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route
          path="reset-password/:activationCode"
          element={<ResetPassword />}
        />
        <Route
          path="profile/*"
          element={
            AuthService.isLoggedIn() ? <Profile /> : <Navigate to="/login" />
          }
        />
        <Route
          path="admin/*"
          element={
            AuthService.isLoggedIn() && AuthService.isSuperAdmin() ? (
              <Admin />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="project/*"
          element={
            AuthService.isLoggedIn() ? <App /> : <Navigate to="/login" />
          }
        />
        <Route path="*" element={<Navigate to="project" replace />} />
      </Routes>
    </Router>
  </IbutsuContextProvider>
);
