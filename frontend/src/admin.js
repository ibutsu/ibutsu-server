import React from 'react';

import '@patternfly/react-core/dist/styles/base.css';
import {
  Nav,
  NavList
} from '@patternfly/react-core';

import { NavLink, Route, Switch } from 'react-router-dom';
import EventEmitter from 'wolfy87-eventemitter';

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
          <li className="pf-c-nav__item">
            <NavLink to="/admin" className="pf-c-nav__link" activeClassName="pf-m-active" exact>Admin Home</NavLink>
          </li>
          <li className="pf-c-nav__item">
            <NavLink to="/admin/users" className="pf-c-nav__link" activeClassName="pf-m-active">Users</NavLink>
          </li>
          <li className="pf-c-nav__item">
            <NavLink to="/admin/projects" className="pf-c-nav__link" activeClassName="pf-m-active">Projects</NavLink>
          </li>
        </NavList>
      </Nav>
    );

    return (
      <React.Fragment>
        <IbutsuPage eventEmitter={this.eventEmitter} navigation={navigation} title="Administration | Ibutsu">
          <Switch>
            <Route path="/admin" component={AdminHome} exact />
            <Route path="/admin/users" component={UserList} exact />
            <Route path="/admin/users/:id" component={UserEdit} />
            <Route path="/admin/projects" component={ProjectList} exact />
            <Route path="/admin/projects/:id" component={ProjectEdit} exact />
          </Switch>
        </IbutsuPage>
      </React.Fragment>
    );
  }
}
