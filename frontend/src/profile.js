import React from 'react';

import {
  Nav,
  NavList
} from '@patternfly/react-core';

import { NavLink, Route, Routes } from 'react-router-dom';
import EventEmitter from 'wolfy87-eventemitter';

import { UserProfile } from './pages/profile/user';
import { UserTokens } from './pages/profile/tokens';
import { IbutsuPage } from './components';
import './app.css';
import ElementWrapper from './components/elementWrapper';


export class Profile extends React.Component {
  constructor(props) {
    super(props);
    this.eventEmitter = new EventEmitter();
  }

  render() {
    const navigation = (
      <Nav onSelect={this.onNavSelect} theme="dark" aria-label="Nav">
        <NavList>
          <li className="pf-v5-c-nav__item">
            <NavLink to="/profile" className="pf-v5-c-nav__link">Profile</NavLink>
          </li>
          <li className="pf-v5-c-nav__item">
            <NavLink to="/profile/tokens" className="pf-v5-c-nav__link">Tokens</NavLink>
          </li>
        </NavList>
      </Nav>
    );

    return (
      <React.Fragment>
        <IbutsuPage eventEmitter={this.eventEmitter} navigation={navigation} title="Profile | Ibutsu">
          <Routes>
            <Route path="*" element={<ElementWrapper routeElement={UserProfile} eventEmitter={this.eventEmitter} />} />
            <Route path="/tokens" element={<ElementWrapper routeElement={UserTokens} eventEmitter={this.eventEmitter} />} />
          </Routes>
        </IbutsuPage>
      </React.Fragment>
    );
  }
}
