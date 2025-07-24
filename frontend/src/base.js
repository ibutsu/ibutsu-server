import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';
import App from './app';
import Admin from './admin';
import Profile from './profile';
import Login from './login';
import { SignUp } from './sign-up';
import ForgotPassword from './forgot-password';
import ResetPassword from './reset-password';
import ProtectedRoute from './components/ProtectedRoute';
import { IbutsuContextProvider } from './components/contexts/ibutsuContext';

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
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/*"
          element={
            <ProtectedRoute requireSuperAdmin={true}>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="project/*"
          element={
            <ProtectedRoute>
              <App />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="project" replace />} />
      </Routes>
    </Router>
  </IbutsuContextProvider>
);
