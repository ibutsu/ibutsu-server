import React, { useEffect, useMemo, useState } from 'react';

import {
  Button,
  Modal,
  PageSection,
  PageSectionVariants,
  TextContent,
  Title,
} from '@patternfly/react-core';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { filtersToAPIParams, toAPIFilter, userToRow } from '../../utilities';
import useUserFilter from '../../components/user-filter';
import { USER_COLUMNS } from '../../constants';
import UserRow from '../../components/user-row';
import usePagination from '../../components/hooks/usePagination';
import FilterTable from '../../components/filtertable';

const COLUMNS = Object.values(USER_COLUMNS);

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState();

  const { page, setPage, pageSize, setPageSize, totalItems, setTotalItems } =
    usePagination({});

  const [isError, setIsError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [fetching, setFetching] = useState(true);

  const { filterComponents, activeFilters } = useUserFilter();

  useEffect(() => {
    // fetch the users
    setFetching(true);
    const apiParams = {
      page: page,
      pageSize: pageSize,
      filter: filtersToAPIParams(activeFilters),
    };
    console.log('Fetching users', apiParams);

    HttpClient.get([Settings.serverUrl, 'admin', 'user'], apiParams)
      .then((response) => HttpClient.handleResponse(response))
      .then((data) => {
        if (data?.users?.length > 0) {
          setUsers(data.users);
          setPage(data.pagination.page.toString());
          setPageSize(data.pagination.pageSize.toString());
          setTotalItems(data.pagination.totalItems.toString());
          setFetching(false);
        } else {
          setUsers([]);
          setFetching(false);
        }
      })
      .catch((error) => {
        console.error('Error fetching users data:', error);
        setUsers([]);
        setIsError(true);
        setFetching(false);
      });
  }, [
    page,
    pageSize,
    isDeleting,
    activeFilters,
    setPage,
    setPageSize,
    setTotalItems,
  ]); // isDeleteing so the users fetch after delete

  const onModalDeleteClick = () => {
    setIsDeleting(true);
    HttpClient.delete([Settings.serverUrl, 'admin', 'user', selectedUser.id])
      .then((response) => HttpClient.handleResponse(response))
      .then(() => {
        setIsDeleting(false);
        setIsDeleteModalOpen(false);
      });
  };

  useEffect(() => {
    document.title = 'Users - Administration | Ibutsu';
  }, []);

  const userRows = useMemo(() => {
    return users.map((user) => {
      return userToRow(user, setSelectedUser, setIsDeleteModalOpen);
    });
  }, [users]);

  console.log('UserList userRows: ', userRows);
  return (
    <React.Fragment>
      <PageSection id="page" variant={PageSectionVariants.light}>
        <TextContent>
          <Title headingLevel="h1" ouiaId="users-title">
            Users
          </Title>
        </TextContent>
      </PageSection>
      <PageSection>
        <FilterTable
          columns={COLUMNS}
          rows={userRows}
          filters={filterComponents}
          isError={isError}
          canSelectAll={false}
          onSetPage={setPage}
          onSetPageSize={setPageSize}
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          fetching={fetching}
        />
      </PageSection>
      <Modal
        title="Confirm Delete"
        variant="small"
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        actions={[
          <Button
            key="delete"
            variant="danger"
            isLoading={isDeleting}
            isDisabled={isDeleting}
            onClick={onModalDeleteClick}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>,
          <Button
            key="cancel"
            variant="secondary"
            isDisabled={isDeleting}
            onClick={() => setIsDeleteModalOpen(false)}
          >
            Cancel
          </Button>,
        ]}
      >
        Are you sure you want to delete &ldquo;
        {selectedUser && (selectedUser.name || selectedUser.email)}&rdquo;? This
        cannot be undone!
      </Modal>
    </React.Fragment>
  );
};

UserList.propTypes = {};

export default UserList;
