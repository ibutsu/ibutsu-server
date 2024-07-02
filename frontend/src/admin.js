import React from 'react';

import { Navigate, Route, Routes } from 'react-router-dom';
import EventEmitter from 'wolfy87-eventemitter';
import ElementWrapper from './components/elementWrapper';

import AdminHome from './pages/admin/home';
import { UserList } from './pages/admin/user-list';
import { UserEdit } from './pages/admin/user-edit';
import { ProjectList } from './pages/admin/project-list';
import { ProjectEdit } from './pages/admin/project-edit';
import { AuthService } from './services/auth';
import { PortalList } from './pages/admin/portal-list';
import { PortalEdit } from './pages/admin/portal-edit';

import './app.css';
import AdminPage from './components/admin-page';


export class Admin extends React.Component {
  constructor(props) {
    super(props);
    this.eventEmitter = new EventEmitter();
  }

  componentDidMount() {
    AuthService.isSuperAdmin().then(isSuperAdmin => {
      if (!isSuperAdmin) {
        window.location = '/';
      }
    });
  }

  render() {
    return (
      <Routes>
        <Route
          path=""
          element={<AdminPage eventEmitter={this.eventEmitter} />}
        >
          <Route path="home" element={<AdminHome/>} />
          <Route path="users" element={<ElementWrapper routeElement={UserList} emitter={this.eventEmitter} />} />
          <Route path="users/:id" element={<ElementWrapper routeElement={UserEdit} emitter={this.eventEmitter} />} />
          <Route path="projects" element={<ElementWrapper routeElement={ProjectList} emitter={this.eventEmitter} />} />
          <Route path="projects/:id" element={<ElementWrapper routeElement={ProjectEdit} emitter={this.eventEmitter} />} />
          <Route path="portals" element={<ElementWrapper routeElement={PortalList} emitter={this.eventEmitter} />} />
          <Route path="portals/:id" element={<ElementWrapper routeElement={PortalEdit} emitter={this.eventEmitter} />} />
        </Route>
        <Route path="*" element={<Navigate to="" replace />}/>
      </Routes>
    );
  }
}
