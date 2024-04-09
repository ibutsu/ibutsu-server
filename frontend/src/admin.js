import React from 'react';

import {
  Nav,
  NavList
} from '@patternfly/react-core';

import { NavLink, Route, Routes } from 'react-router-dom';
import EventEmitter from 'wolfy87-eventemitter';
import ElementWrapper from './components/elementWrapper';

import { IbutsuPage } from './components';
import { AdminHome } from './pages/admin/home';
import { UserList } from './pages/admin/user-list';
import { UserEdit } from './pages/admin/user-edit';
import { ProjectList } from './pages/admin/project-list';
import { ProjectEdit } from './pages/admin/project-edit';
import { AuthService } from './services/auth';
import './app.css';


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
    const navigation = (
      <Nav onSelect={this.onNavSelect} theme="dark" aria-label="Nav">
        <NavList>
          <li className="pf-v5-c-nav__item">
            <NavLink to="/admin" className="pf-v5-c-nav__link">Admin Home</NavLink>
          </li>
          <li className="pf-v5-c-nav__item">
            <NavLink to="/admin/users" className="pf-v5-c-nav__link">Users</NavLink>
          </li>
          <li className="pf-v5-c-nav__item">
            <NavLink to="/admin/projects" className="pf-v5-c-nav__link">Projects</NavLink>
          </li>
        </NavList>
      </Nav>
    );

    return (
      <React.Fragment>
        <IbutsuPage eventEmitter={this.eventEmitter} navigation={navigation} title="Administration | Ibutsu">
          <Routes>
            <Route path="*" element={<AdminHome />}/>
            <Route path="/users" element={<ElementWrapper routeElement={UserList} />} />
            <Route path="/users/:id" element={<ElementWrapper routeElement={UserEdit} />} />
            <Route path="/projects" element={<ElementWrapper routeElement={ProjectList} />} />
            <Route path="/projects/:id" element={<ElementWrapper routeElement={ProjectEdit} />} />
          </Routes>
        </IbutsuPage>
      </React.Fragment>
    );
  }
}
