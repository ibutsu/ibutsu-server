import React from 'react';

import '@patternfly/react-core/dist/styles/base.css';
import {
  Alert,
  AlertGroup,
  AlertVariant,
  Brand,
  Dropdown,
  DropdownItem,
  DropdownToggle,
  Nav,
  NavList,
  Page,
  PageHeader,
  PageSidebar,
  PageHeaderTools,
  PageHeaderToolsGroup,
  PageHeaderToolsItem
} from '@patternfly/react-core';

import { CaretDownIcon, UserIcon } from '@patternfly/react-icons';
import { Link, NavLink, Route, Switch } from 'react-router-dom';
import accessibleStyles from '@patternfly/patternfly/utilities/Accessibility/accessibility.css';
import { css } from '@patternfly/react-styles';

import { UserProfile } from './user-profile';
import { UserTokens } from './user-tokens';
import { ALERT_TIMEOUT } from './constants';
import { AuthService } from './services/auth';
import './app.css';


function getDateString() {
  return String((new Date()).getTime());
}

export class Profile extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      notifications: [],
      isUserDropdownOpen: false
    };
  }

  showNotification(type, title, message, action?, timeout?, key?) {
    let notifications = this.state.notifications;
    let alertKey = key || getDateString();
    timeout = timeout !== undefined ? timeout : true
    if (notifications.find(element => element.key === alertKey) !== undefined) {
      return;
    }
    let notification = {
      'key': alertKey,
      'type': AlertVariant[type],
      'title': title,
      'message': message,
      'action': action
    };
    notifications.push(notification);
    this.setState({notifications}, () => {
      if (timeout === true) {
        setTimeout(() => {
          let notifications = this.state.notifications.filter((n) => {
            if (n.type === type && n.title === title && n.message === message) {
              return false;
            }
            return true;
          });
          this.setState({notifications});
        }, ALERT_TIMEOUT);
      }
    });
  }

  onUserDropdownToggle = (isOpen) => {
    this.setState({isUserDropdownOpen: isOpen});
  };

  onUserDropdownSelect = () => {
    this.setState({isUserDropdownOpen: false});
  };

  logout = () => {
    AuthService.logout();
    window.location = "/";
  }

  render() {
    document.title = 'Profile | Ibutsu';
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
    const headerTools = (
      <PageHeaderTools>
        <PageHeaderToolsGroup className={css(accessibleStyles.srOnly, accessibleStyles.visibleOnLg)}>
          <PageHeaderToolsItem id="user-dropdown">
            <Dropdown
              onSelect={this.onUserDropdownSelect}
              toggle={
                <DropdownToggle
                  id="user-dropdown-toggle"
                  onToggle={this.onUserDropdownToggle}
                  toggleIndicator={CaretDownIcon}
                  icon={<UserIcon />}
                  isPlain={true}
                >
                  {AuthService.getUser() && (AuthService.getUser().name || AuthService.getUser().email)}
                </DropdownToggle>
              }
              isOpen={this.state.isUserDropdownOpen}
              dropdownItems={[
                <DropdownItem key="profile" component={<Link to="/profile">Profile</Link>} />,
                <DropdownItem key="logout" component="button" onClick={this.logout}>Logout</DropdownItem>
              ]}
            />
          </PageHeaderToolsItem>
        </PageHeaderToolsGroup>
      </PageHeaderTools>
    );
    const header = (
      <PageHeader
        logo={<Brand src="/images/ibutsu-wordart-164.png" alt="Ibutsu"/>}
        logoComponent={Link}
        logoProps={{to: '/'}}
        headerTools={headerTools}
        showNavToggle={true}
      />
    );
    const sidebar = <PageSidebar nav={navigation} theme="dark" />;

    return (
      <React.Fragment>
          <AlertGroup isToast>
            {this.state.notifications.map((notification) => (
              <Alert key={notification.key} variant={notification.type} title={notification.title} action={notification.action} isLiveRegion>
                {notification.message}
              </Alert>
            ))}
          </AlertGroup>
          <Page header={header} sidebar={sidebar} isManagedSidebar={true} style={{position: "relative"}}>
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
          </Page>
      </React.Fragment>
    );
  }
}
