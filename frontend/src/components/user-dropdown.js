import React, { useState, useEffect } from 'react';

import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle
} from '@patternfly/react-core';
import { UserIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import { AuthService } from '../services/auth';

const UserDropdown = () => {
  const [displayName, setDisplayName] = useState('User');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  function onDropdownToggle() {
    setIsDropdownOpen(!isDropdownOpen);
  }

  function onDropdownSelect() {
    setIsDropdownOpen(false);
  }

  function logout() {
    AuthService.logout();
    window.location = '/';
  }

  useEffect(() => {
    AuthService.isSuperAdmin().then(isSuperAdmin => setIsSuperAdmin(isSuperAdmin));
    setDisplayName(AuthService.getUser() && (AuthService.getUser().name || AuthService.getUser().email));
  }, []);

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

export default UserDropdown;
