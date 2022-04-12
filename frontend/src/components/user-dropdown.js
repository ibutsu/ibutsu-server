import React from 'react';
import PropTypes from 'prop-types';

import {
  Dropdown,
  DropdownItem,
  DropdownToggle
} from '@patternfly/react-core';
import { CaretDownIcon, UserIcon } from '@patternfly/react-icons';
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

  onDropdownToggle = (isOpen) => {
    this.setState({isDropdownOpen: isOpen});
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
    const dropdownItems = [
      <DropdownItem key="profile" component={<Link to="/profile">Profile</Link>} />,
      <DropdownItem key="logout" component="button" onClick={this.logout}>Logout</DropdownItem>
    ];
    if (this.state.isSuperAdmin) {
      dropdownItems.splice(1, 0, <DropdownItem key="admin" component={<Link to="/admin">Administration</Link>} />);
    }
    return (
      <Dropdown
        onSelect={this.onDropdownSelect}
        toggle={
          <DropdownToggle
            id="user-dropdown-toggle"
            onToggle={this.onDropdownToggle}
            toggleIndicator={CaretDownIcon}
            icon={<UserIcon />}
            isPlain={true}
          >
            {this.state.displayName}
          </DropdownToggle>
        }
        isOpen={this.state.isDropdownOpen}
        dropdownItems={dropdownItems}
      />
    );
  }
}
