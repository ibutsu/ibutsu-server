import { lazy, Suspense } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';

import { IbutsuContextProvider } from '../components/contexts/ibutsu-context';
import { PageSpinner } from '../components/loading-spinners';

// Lazy load route-level components for code splitting
const App = lazy(() => import('./app'));
const Admin = lazy(() => import('./admin'));
const Profile = lazy(() => import('./profile'));
const Login = lazy(() => import('../pages/login'));
const SignUp = lazy(() =>
  import('../pages/sign-up').then((module) => ({ default: module.SignUp })),
);
const ForgotPassword = lazy(() => import('../pages/forgot-password'));
const ResetPassword = lazy(() => import('../pages/reset-password'));

export const Base = () => (
  <IbutsuContextProvider>
    <Router>
      <Suspense fallback={<PageSpinner />}>
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
      </Suspense>
    </Router>
  </IbutsuContextProvider>
);
