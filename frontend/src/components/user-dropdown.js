import { useState, useEffect } from 'react';

import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
} from '@patternfly/react-core';

import { UserIcon } from '@patternfly/react-icons';
import { useNavigate } from 'react-router-dom';

import { AuthService } from '../utilities/auth';

const UserDropdown = () => {
  const [displayName, setDisplayName] = useState('User');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const navigate = useNavigate();

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
          ouiaId="user-dropdown-toggle"
        >
          {displayName}
        </MenuToggle>
      )}
      ouiaId="user-dropdown-menu"
    >
      <DropdownList>
        <DropdownItem
          key="profile"
          onClick={() => navigate('/profile/user')}
          ouiaId="user-profile-item"
        >
          Profile
        </DropdownItem>
        {!!isSuperAdmin && (
          <DropdownItem
            key="admin"
            onClick={() => navigate('/admin/home')}
            ouiaId="user-admin-item"
          >
            Administration
          </DropdownItem>
        )}
        <DropdownItem key="logout" onClick={logout} ouiaId="user-logout-item">
          Logout
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};

export default UserDropdown;
