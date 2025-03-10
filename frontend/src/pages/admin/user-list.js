import React, { useEffect, useState } from 'react';

import {
  Button,
  Card,
  CardBody,
  Label,
  Modal,
  PageSection,
  PageSectionVariants,
  TextContent,
  TextInput,
  Title
} from '@patternfly/react-core';
import { PencilAltIcon, TrashIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { getSpinnerRow } from '../../utilities';
import FilterTable from '../../components/filtertable';


const COLUMNS = ['Display Name', 'Email', 'Projects', 'Status', ''];

const UserList = () => {

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  const [isError, setIsError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [textFilter, setTextFilter] = useState('');
  const [activeFilters, setActiveFilters] = useState({});

  const [fetching, setFetching] = useState(true);

  const userToRow  = (user) => {
    let userName = user.name;
    if (user.is_superadmin) {
      userName = [
        user.name,
        ' ',
        <Label key="admin" className="super-admin-label" variant="filled" color="blue" isCompact>Administrator</Label>
      ];
    }
    return {
      'cells': [
        {title: userName},
        {title: user.email},
        {title: user.projects ? user.projects.map(project => project.title).join(', ') : ''},
        {title: user.is_active ? 'Active' : 'Inactive'},
        {
          title: (
            <div style={{textAlign: 'right'}}>
              <Button
                variant="primary"
                ouiaId={`admin-users-edit-${user.id}`}
                component={(props) => <Link {...props} to={`/admin/users/${user.id}`} />}
                size="sm"
              >
                <PencilAltIcon />
              </Button>
              &nbsp;
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
            </div>
          )
        }
      ]
    };
  };

  useEffect(() => {
    // filter fetched users
    setActiveFilters(textFilter ? {'name': textFilter} : {});

    let newUsers = [...users];
    if (textFilter && users) {
      newUsers = users.filter((u) => String(u.name).toLowerCase().includes(textFilter.toLowerCase()));
    }

    setFilteredUsers(newUsers);
  }, [textFilter, users]);

  useEffect(() => {
    // fetch the users
    setFetching(true);
    HttpClient.get([Settings.serverUrl, 'admin', 'user'], {page: page, pageSize: pageSize})
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        if (data?.users?.length > 0) {
          setUsers(data.users);
          setPage(data.pagination.page);
          setPageSize(data.pagination.pageSize);
          setTotalItems(data.pagination.totalItems);
        } else {
          setUsers([]);
        }
      })
      .catch((error) => {
        console.error('Error fetching users data:', error);
        setUsers([]);
        setIsError(true);
      });

    setFetching(false);
  }, [page, pageSize, isDeleting]); // isDeleteing so the users fetch after delete


  const onModalDeleteClick = () => {
    setIsDeleting(true);
    HttpClient.delete([Settings.serverUrl, 'admin', 'user', selectedUser.id])
      .then(response => HttpClient.handleResponse(response))
      .then(() => {
        setIsDeleting(false);
        setIsDeleteModalOpen(false);
      });
  };

  const onFilterChange = (value) => {
    setTextFilter(value);
  };

  const onRemoveFilter = () => {
    setTextFilter('');
  };

  document.title = 'Users - Administration | Ibutsu';

  return (
    <React.Fragment>
      <PageSection id="page" variant={PageSectionVariants.light}>
        <TextContent>
          <Title headingLevel="h1" ouiaId="users">Users</Title>
        </TextContent>
      </PageSection>
      <PageSection className="pf-u-pb-0">
        <Card>
          <CardBody className="pf-u-p-0">
            <FilterTable
              columns={COLUMNS}
              rows={!fetching ? filteredUsers.map((user) => userToRow(user)) : [getSpinnerRow(5)]}
              filters={[
                <TextInput type="text" id="filter" placeholder="Search for user..." value={textFilter} onChange={(_event, value) => onFilterChange(value)} style={{height: 'inherit'}} key="textFilter"/>
              ]}
              activeFilters={activeFilters}
              onRemoveFilter={onRemoveFilter}
              pagination={{
                pageSize: pageSize,
                page: page,
                totalItems: totalItems
              }}
              isEmpty={filteredUsers.length === 0}
              isError={isError}
              onSetPage={(_event, value) => setPage(value)}
              onSetPageSize={(_event, value) => setPageSize(value)}
            />
          </CardBody>
        </Card>
      </PageSection>
      <Modal
        title="Confirm Delete"
        variant="small"
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        actions={[
          <Button key="delete" variant="danger" isLoading={isDeleting} isDisabled={isDeleting} onClick={onModalDeleteClick}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>,
          <Button key="cancel" variant="secondary" isDisabled={isDeleting} onClick={() => setIsDeleteModalOpen(false)}>
            Cancel
          </Button>
        ]}
      >
        Are you sure you want to delete &ldquo;{selectedUser && (selectedUser.name || selectedUser.email)}&rdquo;? This cannot be undone!
      </Modal>
    </React.Fragment>
  );
};

UserList.propTypes = {};

export default UserList;
