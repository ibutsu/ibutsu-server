import React from 'react';
import PropTypes from 'prop-types';

import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle
} from '@patternfly/react-core';
import { UserIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import { AuthService } from '../services/auth';
import { clearActiveProject, clearActiveDashboard } from '../utilities';

export class UserDropdown extends React.Component {
  static propTypes = {
    eventEmitter: PropTypes.object
  }

  constructor(props) {
    super(props);
    this.eventEmitter = props.eventEmitter;
    this.state = {
      displayName: 'User',
      isDropdownOpen: false,
      isSuperAdmin: false
    };
    this.eventEmitter.on('updateUserName', (userName) => {
      this.updateUserName(userName);
    });
  }

  updateUserName(userName) {
    // Update the user in the browser
    const sessionUser = AuthService.getUser();
    sessionUser.name = userName;
    AuthService.setUser(sessionUser);
    this.setState({displayName: userName});
  }

  onDropdownToggle = () => {
    this.setState({isDropdownOpen: !this.state.isDropdownOpen});
  };

  onDropdownSelect = () => {
    this.setState({isDropdownOpen: false});
  };

  logout = () => {
    clearActiveProject();
    clearActiveDashboard();
    AuthService.logout();
    window.location = "/";
  }

  componentDidMount() {
    AuthService.isSuperAdmin().then(isSuperAdmin => this.setState({isSuperAdmin}));
    this.setState({
      displayName: AuthService.getUser() && (AuthService.getUser().name || AuthService.getUser().email)
    });
  }

  render() {
    return (
      <Dropdown
        isOpen={this.state.isDropdownOpen}
        onSelect={this.onDropdownSelect}
        onOpenChange={() => this.setState({isDropdownOpen: false})}
        toggle={toggleRef => (
          <MenuToggle
            ref={toggleRef}
            onClick={this.onDropdownToggle}
            isExpanded={this.state.isDropdownOpen}
            icon={<UserIcon />}
          >
            {this.state.displayName}
          </MenuToggle>
        )}
      >
        <DropdownList>
          <DropdownItem key="profile">
            <Link to="/profile/user" className="pf-v5-c-menu__list-item">Profile</Link>
          </DropdownItem>
          {!!this.state.isSuperAdmin &&
            <DropdownItem key="admin">
              <Link to="/admin/home" className="pf-v5-c-menu__list-item">Administration</Link>
            </DropdownItem>
          }
          <DropdownItem key="logout" onClick={this.logout}>
            Logout
          </DropdownItem>
        </DropdownList>
      </Dropdown>
    );
  }
}
