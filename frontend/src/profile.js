import React from 'react';

import {
  Nav,
  NavList
} from '@patternfly/react-core';

import { NavLink, Route, Switch } from 'react-router-dom';
import EventEmitter from 'wolfy87-eventemitter';

import { UserProfile } from './pages/profile/user';
import { UserTokens } from './pages/profile/tokens';
import { IbutsuPage } from './components';
import './app.css';


export class Profile extends React.Component {
  constructor(props) {
    super(props);
    this.eventEmitter = new EventEmitter();
  }

  render() {
    const navigation = (
      <Nav onSelect={this.onNavSelect} theme="dark" aria-label="Nav">
        <NavList>
          <li className="pf-c-nav__item">
            <NavLink to="/profile" className="pf-c-nav__link" activeClassName="pf-m-active" exact>Profile</NavLink>
          </li>
          <li className="pf-c-nav__item">
            <NavLink to="/profile/tokens" className="pf-c-nav__link" activeClassName="pf-m-active">Tokens</NavLink>
          </li>
        </NavList>
      </Nav>
    );

    return (
      <React.Fragment>
        <IbutsuPage eventEmitter={this.eventEmitter} navigation={navigation} title="Profile | Ibutsu">
          <Switch>
            <Route
              path="/profile"
              exact
              render={routerProps => <UserProfile eventEmitter={this.eventEmitter} {...routerProps} />}
            />
            <Route
              path="/profile/tokens"
              exact
              render={routerProps => (
                <UserTokens eventEmitter={this.eventEmitter} {...routerProps} />
              )}
            />
          </Switch>
        </IbutsuPage>
      </React.Fragment>
    );
  }
}
