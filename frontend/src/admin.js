import { useState, useEffect } from 'react';

import { Navigate, Route, Routes } from 'react-router-dom';

import AdminHome from './pages/admin/home';
import UserList from './pages/admin/user-list';
import UserEdit from './pages/admin/user-edit';
import ProjectList from './pages/admin/project-list';
import ProjectEdit from './pages/admin/project-edit';
import { AuthService } from './services/auth';

import './app.css';
import AdminPage from './components/admin-page';

const Admin = () => {
  const [isSuper, setIsSuper] = useState();
  useEffect(() => {
    AuthService.isSuperAdmin().then((admin) => {
      setIsSuper(admin);
    });
  }, []);

  useEffect(() => {
    if (isSuper === false) {
      window.location = '/';
    }
  }, [isSuper]);

  return (
    <Routes>
      <Route path="" element={<AdminPage />}>
        <Route path="home" element={<AdminHome />} />
        <Route path="users" element={<UserList />} />
        <Route path="users/:id" element={<UserEdit />} />
        <Route path="projects" element={<ProjectList />} />
        <Route path="projects/:id" element={<ProjectEdit />} />
      </Route>
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
};

Admin.propTypes = {};

export default Admin;
