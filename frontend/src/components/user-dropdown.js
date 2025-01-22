import React, { useContext, useState, useEffect } from 'react';
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
import { IbutsuContext } from '../services/context';

const UserDropdown = (props) => {
  const context = useContext(IbutsuContext);
  // TODO:
  // static propTypes = {
    // eventEmitter: PropTypes.object
  // }

  // const eventEmitter = props.eventEmitter;

  const [displayName, setDisplayName] = useState('User');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);


  // TODO:
  // this.eventEmitter.on('updateUserName', (userName) => {
    // this.updateUserName(userName);
  // })

  function updateUserName(userName) {
    // Update the user in the browser
    const sessionUser = AuthService.getUser();
    sessionUser.name = userName;
    AuthService.setUser(sessionUser);
    setDisplayName(userName);
  }

  function onDropdownToggle() {
    setIsDropdownOpen(!isDropdownOpen);
  }

  function onDropdownSelect() {
    setIsDropdownOpen(false);
  }

  function logout() {
    const { primaryObject } = context;
    AuthService.logout();
    window.location = '/';
  }

  useEffect(() => {
    AuthService.isSuperAdmin().then(isSuperAdmin => setIsSuperAdmin(isSuperAdmin));
    setDisplayName(AuthService.getUser() && (AuthService.getUser().name || AuthService.getUser().email));
  });

  return (
    <Dropdown
      isOpen={isDropdownOpen}
      onSelect={onDropdownSelect}
      onOpenChange={() => setIsDropdownOpen(false)}
      toggle={toggleRef => (
        <MenuToggle
          ref={toggleRef}
          onClick={onDropdownToggle}
          isExpanded={isDropdownOpen}
          icon={<UserIcon />}
        >
          {displayName}
        </MenuToggle>
      )}
    >
      <DropdownList>
        <DropdownItem key="profile">
          <Link to="/profile/user" className="pf-v5-c-menu__list-item">Profile</Link>
        </DropdownItem>
        {!!isSuperAdmin &&
          <DropdownItem key="admin">
            <Link to="/admin/home" className="pf-v5-c-menu__list-item">Administration</Link>
          </DropdownItem>
        }
        <DropdownItem key="logout" onClick={logout}>
          Logout
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
}

UserDropdown.propTypes = {
  // eventEmitter: PropTypes.object
};

export default UserDropdown;
