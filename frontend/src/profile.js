import React from 'react';

import '@patternfly/react-core/dist/styles/base.css';
import {
  Nav,
  NavList
} from '@patternfly/react-core';

import { NavLink, Route, Switch } from 'react-router-dom';
import EventEmitter from 'wolfy87-eventemitter';

import { UserProfile } from './user-profile';
import { UserTokens } from './user-tokens';
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
            <Route path="/profile" component={UserProfile} exact />
            <Route
              path="/profile/tokens"
              exact
              render={routerProps => (
                <UserTokens parent={this} {...routerProps} />
              )}
            />
          </Switch>
        </IbutsuPage>
      </React.Fragment>
    );
  }
}
