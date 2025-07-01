import { Navigate, Route, Routes } from 'react-router-dom';

import AdminHome from '../pages/admin/home';
import UserList from '../pages/admin/user-list';
import UserEdit from '../pages/admin/user-edit';
import ProjectList from '../pages/admin/project-list';
import ProjectEdit from '../pages/admin/project-edit';

import '../app.css';
import AdminPage from './admin-page';
import { STRING_PROJECT_FIELDS, STRING_USER_FIELDS } from '../constants';
import FilterProvider from '../components/contexts/filter-context';

const Admin = () => {
  return (
    <Routes>
      <Route path="" element={<AdminPage />}>
        <Route path="home" element={<AdminHome />} />
        <Route
          path="users"
          element={
            <FilterProvider key="users" fieldOptions={STRING_USER_FIELDS}>
              <UserList />
            </FilterProvider>
          }
        />
        <Route path="users/:id" element={<UserEdit />} />
        <Route
          path="projects"
          element={
            <FilterProvider key="projects" fieldOptions={STRING_PROJECT_FIELDS}>
              <ProjectList />
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
              <ProjectEdit />
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
