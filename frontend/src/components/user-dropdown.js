import { useState, useEffect } from 'react';

import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
} from '@patternfly/react-core';
import { UserIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import { AuthService } from '../services/auth';

const UserDropdown = () => {
  const [displayName, setDisplayName] = useState('User');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const logout = () => {
    AuthService.logout();
    window.location = '/';
  };

  useEffect(() => {
    AuthService.isSuperAdmin().then((isSuperAdmin) =>
      setIsSuperAdmin(isSuperAdmin),
    );
    setDisplayName(
      AuthService.getUser() &&
        (AuthService.getUser().name || AuthService.getUser().email),
    );
  }, []);

  return (
    <Dropdown
      isOpen={isDropdownOpen}
      onSelect={() => setIsDropdownOpen(false)}
      onOpenChange={() => setIsDropdownOpen(false)}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          isExpanded={isDropdownOpen}
          icon={<UserIcon />}
        >
          {displayName}
        </MenuToggle>
      )}
    >
      <DropdownList>
        <DropdownItem key="profile">
          <Link to="/profile/user">Profile</Link>
        </DropdownItem>
        {!!isSuperAdmin && (
          <DropdownItem key="admin">
            <Link to="/admin/home">Administration</Link>
          </DropdownItem>
        )}
        <DropdownItem key="logout" onClick={logout}>
          <Link>Logout</Link>
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};

export default UserDropdown;
