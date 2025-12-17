import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Bullseye, Spinner } from '@patternfly/react-core';

import '../app.css';
import AdminPage from './admin-page';
import { STRING_PROJECT_FIELDS, STRING_USER_FIELDS } from '../constants';
import FilterProvider from '../components/contexts/filter-context';

// Lazy load admin page components for code splitting
const AdminHome = lazy(() => import('../pages/admin/home'));
const UserList = lazy(() => import('../pages/admin/user-list'));
const UserEdit = lazy(() => import('../pages/admin/user-edit'));
const ProjectList = lazy(() => import('../pages/admin/project-list'));
const ProjectEdit = lazy(() => import('../pages/admin/project-edit'));

const ContentSpinner = () => (
  <Bullseye style={{ minHeight: '200px' }}>
    <Spinner size="lg" aria-label="Loading content..." />
  </Bullseye>
);

const Admin = () => {
  return (
    <Routes>
      <Route path="" element={<AdminPage />}>
        <Route
          path="home"
          element={
            <Suspense fallback={<ContentSpinner />}>
              <AdminHome />
            </Suspense>
          }
        />
        <Route
          path="users"
          element={
            <FilterProvider key="users" fieldOptions={STRING_USER_FIELDS}>
              <Suspense fallback={<ContentSpinner />}>
                <UserList />
              </Suspense>
            </FilterProvider>
          }
        />
        <Route
          path="users/:id"
          element={
            <Suspense fallback={<ContentSpinner />}>
              <UserEdit />
            </Suspense>
          }
        />
        <Route
          path="projects"
          element={
            <FilterProvider key="projects" fieldOptions={STRING_PROJECT_FIELDS}>
              <Suspense fallback={<ContentSpinner />}>
                <ProjectList />
              </Suspense>
            </FilterProvider>
          }
        />
        <Route
          path="projects/:id"
          element={
            // user filtering is available on project edit
            <FilterProvider
              key="project_edit"
              fieldOptions={STRING_USER_FIELDS}
            >
              <Suspense fallback={<ContentSpinner />}>
                <ProjectEdit />
              </Suspense>
            </FilterProvider>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
};

Admin.propTypes = {};

export default Admin;
