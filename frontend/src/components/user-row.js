import { Label, Button } from '@patternfly/react-core';
import { Td, Tr, TableText } from '@patternfly/react-table';
import {
  BanIcon,
  CheckIcon,
  LinuxIcon,
  PencilAltIcon,
  TrashIcon,
} from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import { USER_COLUMNS } from '../constants';
import PropTypes from 'prop-types';

const UserRow = ({ user, setSelectedUser, setIsDeleteModalOpen }) => {
  let userName = user.name;
  if (user.is_superadmin) {
    userName = [user.name, ' '];
  }
  return (
    <Tr key={user.id}>
      <Td dataLabel={USER_COLUMNS.name}>{userName} </Td>
      <Td dataLabel={USER_COLUMNS.email}>{user.email}</Td>
      <Td dataLabel={USER_COLUMNS.projects} modifier="wrap">
        {user.projects
          ? user.projects.map((project) => project.title).join(', ')
          : ''}
      </Td>
      <Td dataLabel={USER_COLUMNS.status}>
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
      </Td>
      <Td dataLabel={USER_COLUMNS.edit}>
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
      </Td>
      <Td>
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
      </Td>
    </Tr>
  );
};

UserRow.propTypes = {
  user: PropTypes.object.isRequired,
  setSelectedUser: PropTypes.func.isRequired,
  setIsDeleteModalOpen: PropTypes.func.isRequired,
};

export default UserRow;
