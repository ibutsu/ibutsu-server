import { Label, Button } from '@patternfly/react-core';
import { TableText } from '@patternfly/react-table';
import {
  BanIcon,
  CheckIcon,
  LinuxIcon,
  PencilAltIcon,
  TrashIcon,
} from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import PropTypes from 'prop-types';
import React from 'react';

const UserRow = ({ user, setSelectedUser, setIsDeleteModalOpen }) => {
  let userName = user.name;
  if (user.is_superadmin) {
    userName = [user.name, ' '];
  }
  return {
    cells: [
      {
        title: userName,
      },
      {
        title: user.email,
      },
      {
        title: user.projects
          ? user.projects.map((project) => project.title).join(', ')
          : '',
      },
      {
        title: (
          <React.Fragment>
            {user.is_active ? (
              <Label
                key="active"
                className="active"
                variant="filled"
                color="green"
                icon={<CheckIcon />}
              >
                Active
              </Label>
            ) : (
              <Label
                key="inactive"
                className="active"
                variant="filled"
                color="red"
                icon={<BanIcon />}
              >
                Inactive
              </Label>
            )}
            {user.is_superadmin ? (
              <Label
                key="admin"
                className="super-admin-label"
                variant="outline"
                color="orange"
                icon={<LinuxIcon />}
              >
                Administrator
              </Label>
            ) : (
              ''
            )}
          </React.Fragment>
        ),
      },
      {
        title: (
          <TableText>
            <Button
              variant="primary"
              ouiaId={`admin-users-edit-${user.id}`}
              component={(props) => (
                <Link {...props} to={`/admin/users/${user.id}`} />
              )}
              size="sm"
              aria-label="Edit"
            >
              <PencilAltIcon />
            </Button>
          </TableText>
        ),
      },
      {
        title: (
          <Button
            variant="primary"
            ouiaId={`admin-users-edit-${user.id}`}
            component={(props) => (
              <Link {...props} to={`/admin/users/${user.id}`} />
            )}
            size="sm"
            aria-label="Edit"
          >
            <PencilAltIcon />
          </Button>
        ),
      },
      {
        title: (
          <TableText>
            <Button
              variant="danger"
              ouiaId={`admin-users-delete-${user.id}`}
              onClick={() => {
                setSelectedUser(user);
                setIsDeleteModalOpen(true);
              }}
              size="sm"
            >
              <TrashIcon />
            </Button>
          </TableText>
        ),
      },
    ],
  };
};

UserRow.propTypes = {
  user: PropTypes.object.isRequired,
  setSelectedUser: PropTypes.func.isRequired,
  setIsDeleteModalOpen: PropTypes.func.isRequired,
};

export default UserRow;
