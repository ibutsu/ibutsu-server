import React, { useContext, useEffect, useState } from 'react';

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
import { filtersToAPIParams, userToRow } from '../../utilities';
import { USER_COLUMNS } from '../../constants';
import usePagination from '../../components/hooks/usePagination';
import FilterTable from '../../components/filtering/filtered-table-card';
import { FilterContext } from '../../components/contexts/filterContext';
import AdminFilter from '../../components/filtering/admin-filter';

const COLUMNS = Object.values(USER_COLUMNS);

const UserList = () => {
  const [rows, setRows] = useState([]);
  const [selectedUser, setSelectedUser] = useState();

  const { page, setPage, pageSize, setPageSize, totalItems, setTotalItems } =
    usePagination({});

  const [isError, setIsError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [fetching, setFetching] = useState(true);

  const { activeFilters, clearFilters } = useContext(FilterContext);

  useEffect(() => {
    // fetch the users
    setFetching(true);
    const apiParams = {
      page: page,
      pageSize: pageSize,
      filter: filtersToAPIParams(activeFilters),
    };

    HttpClient.get([Settings.serverUrl, 'admin', 'user'], apiParams)
      .then((response) => HttpClient.handleResponse(response))
      .then((data) => {
        setRows(
          data.users
            .map((user) =>
              userToRow(user, setSelectedUser, setIsDeleteModalOpen),
            )
            .filter(Boolean),
        );
        setPage(data.pagination.page.toString());
        setPageSize(data.pagination.pageSize.toString());
        setTotalItems(data.pagination.totalItems.toString());
        setFetching(false);
      })
      .catch((error) => {
        console.error('Error fetching users data:', error);
        setRows([]);
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
          rows={rows}
          filters={<AdminFilter />}
          isError={isError}
          canSelectAll={false}
          onSetPage={setPage}
          onSetPageSize={setPageSize}
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          fetching={fetching}
          onClearFilters={clearFilters}
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
