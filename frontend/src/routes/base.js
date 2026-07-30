import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router';
import ProtectedRoute from '../components/ProtectedRoute';

import { IbutsuContextProvider } from '../components/contexts/ibutsu-context';
import { PageSpinner } from '../components/loading-spinners';

// Lazy load route-level components for code splitting
const App = lazy(() => import('./app'));
const Admin = lazy(() => import('./admin'));
const Profile = lazy(() => import('./profile'));
const Login = lazy(() => import('../pages/login'));
const SignUp = lazy(() => import('../pages/sign-up'));
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
          {/*
            NOTE: Admin/Profile/App each mount their own descendant <Routes>
            internally, which requires their parent Route's path to end in
            "/*" (React Router will warn and fail to match anything beyond
            the first render otherwise). That means these three must stay as
            single combined "x/*" routes here rather than being split into a
            static parent + separate "*"/"index" children.

            React Router v7 makes the `v7_relativeSplatPath` fix the
            default: relative link resolution no longer ignores the
            splat-matched portion of the URL for multi-segment splat paths
            like "admin/*". Combined with a descendant <Routes> boundary,
            this means bare relative links inside Admin/Profile (e.g.
            <Link to="users">) resolve relative to whatever sub-page is
            currently active instead of to "/admin", producing broken URLs.
            Rather than restructure the mount points, the sidebars in
            admin-page.js and profile-page.js use absolute paths
            (e.g. "/admin/users") to avoid the ambiguity entirely.
            See: https://reactrouter.com/upgrading/v6#v7_relativesplatpath
          */}
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
