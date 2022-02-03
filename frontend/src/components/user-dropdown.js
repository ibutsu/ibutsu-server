import React from 'react';

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
  constructor(props) {
    super(props);
    this.state = {
      isDropdownOpen: false,
      isSuperAdmin: false
    };
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
  }

  render() {
    const displayName = AuthService.getUser() && (AuthService.getUser().name || AuthService.getUser().email);
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
            {displayName}
          </DropdownToggle>
        }
        isOpen={this.state.isDropdownOpen}
        dropdownItems={dropdownItems}
      />
    );
  }
}
