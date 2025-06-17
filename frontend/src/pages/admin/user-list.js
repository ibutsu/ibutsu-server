import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Button,
  PageSection,
  Content,
  Title,
  Modal,
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

  const {
    page,
    setPage,
    onSetPage,
    pageSize,
    setPageSize,
    onSetPageSize,
    totalItems,
    setTotalItems,
  } = usePagination({});

  const [isError, setIsError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [fetching, setFetching] = useState(true);

  const { activeFilters, clearFilters } = useContext(FilterContext);

  useEffect(() => {
    const fetchUsers = async () => {
      setFetching(true);
      setIsError(false);
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'admin', 'user'],
          {
            page: page,
            pageSize: pageSize,
            filter: filtersToAPIParams(activeFilters),
          },
        );
        const data = await HttpClient.handleResponse(response);
        setRows(
          data?.users
            ?.map((user) =>
              userToRow(user, setSelectedUser, setIsDeleteModalOpen),
            )
            .filter(Boolean),
        );
        setPage(data.pagination.page);
        setPageSize(data.pagination.pageSize);
        setTotalItems(data.pagination.totalItems);
        setFetching(false);
      } catch (error) {
        console.error('Error fetching users data:', error);
        setRows([]);
        setIsError(true);
        setFetching(false);
      }
    };

    const debouncer = setTimeout(() => {
      fetchUsers();
    }, 50);
    return () => clearTimeout(debouncer);
  }, [
    page,
    pageSize,
    isDeleting,
    activeFilters,
    setPage,
    setPageSize,
    setTotalItems,
  ]);

  const onModalDeleteClick = useCallback(async () => {
    setIsDeleting(true);
    if (selectedUser) {
      try {
        const response = await HttpClient.delete([
          Settings.serverUrl,
          'admin',
          'user',
          selectedUser.id,
        ]);
        await HttpClient.handleResponse(response);
        setIsDeleting(false);
        setIsDeleteModalOpen(false);
      } catch (error) {
        console.error('Error deleting user:', error);
        setIsDeleting(false);
      }
    }
  }, [selectedUser]);

  useEffect(() => {
    document.title = 'Users - Administration | Ibutsu';
  }, []);

  const deleteModal = useMemo(() => {
    return (
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
    );
  }, [isDeleteModalOpen, isDeleting, selectedUser, onModalDeleteClick]);

  return (
    <React.Fragment>
      <PageSection hasBodyWrapper={false} id="page">
        <Content>
          <Title headingLevel="h1" ouiaId="users-title">
            Users
          </Title>
        </Content>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        <FilterTable
          columns={COLUMNS}
          rows={rows}
          filters={<AdminFilter />}
          isError={isError}
          onSetPage={onSetPage}
          onSetPageSize={onSetPageSize}
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          fetching={fetching}
          onClearFilters={clearFilters}
        />
      </PageSection>
      {deleteModal}
    </React.Fragment>
  );
};

UserList.propTypes = {};

export default UserList;
