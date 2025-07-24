import { useState, useEffect } from 'react';

import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
} from '@patternfly/react-core';

import { UserIcon } from '@patternfly/react-icons';
import { useNavigate } from 'react-router-dom';

import { AuthService } from '../services/auth';

const UserDropdown = () => {
  const [displayName, setDisplayName] = useState('User');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const navigate = useNavigate();

  const logout = () => {
    AuthService.logout();
    window.location = '/';
  };

  useEffect(() => {
    const localUser = AuthService.getLocalUser();
    setDisplayName(
      (localUser && (localUser.name || localUser.email)) || 'User',
    );

    // Check admin status
    const checkAdminStatus = async () => {
      try {
        const adminStatus = await AuthService.isSuperAdmin();
        setIsAdminUser(adminStatus);
      } catch (error) {
        console.error('Error checking super admin status:', error);
        setIsAdminUser(false);
      }
    };

    checkAdminStatus();
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
        <DropdownItem key="profile" onClick={() => navigate('/profile/user')}>
          Profile
        </DropdownItem>

          <DropdownItem key="admin" isDisabled={!isAdminUser} onClick={() => navigate('/admin/home')}>
          Administration
        </DropdownItem>

        <DropdownItem key="logout" onClick={logout}>
          Logout
        </DropdownItem>
      </DropdownList>
    </Dropdown>
  );
};

export default UserDropdown;
