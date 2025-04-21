import React, { useEffect, useState } from 'react';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  FlexItem,
  Modal,
  PageSection,
  PageSectionVariants,
  Pagination,
  PaginationVariant,
  Skeleton,
  TextContent,
  Title,
} from '@patternfly/react-core';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { toAPIFilter } from '../../utilities';
import useUserFilter from '../../components/user-filter';
import { USER_COLUMNS } from '../../constants';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { TableEmptyState, TableErrorState } from '../../components/tablestates';
import UserRow from '../../components/user-row';

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  const [isError, setIsError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [fetching, setFetching] = useState(true);

  const { filterComponents, activeFilterComponents, activeFilters } =
    useUserFilter();

  useEffect(() => {
    // fetch the users
    setFetching(true);
    const apiParams = {
      page: page,
      pageSize: pageSize,
      ...(Object.keys(activeFilters)?.length === 0
        ? {}
        : { filter: toAPIFilter(activeFilters) }),
    };
    HttpClient.get([Settings.serverUrl, 'admin', 'user'], apiParams)
      .then((response) => HttpClient.handleResponse(response))
      .then((data) => {
        if (data?.users?.length > 0) {
          setUsers(data.users);
          setPage(data.pagination.page);
          setPageSize(data.pagination.pageSize);
          setTotalItems(data.pagination.totalItems);
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
  }, [page, pageSize, isDeleting, activeFilters]); // isDeleteing so the users fetch after delete

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
        <Card>
          <CardHeader>
            {filterComponents}
            {activeFilterComponents}
          </CardHeader>
          <CardBody>
            <Flex
              alignSelf={{ default: 'alignSelfFlexEnd' }}
              direction={{ default: 'column' }}
              align={{ default: 'alignRight' }}
            >
              <FlexItem>
                <Pagination
                  perPage={pageSize}
                  page={page}
                  variant={PaginationVariant.top}
                  itemCount={totalItems}
                  onSetPage={(_, value) => setPage(value)}
                  onPerPageSelect={(_, value) => setPageSize(value)}
                  isCompact
                />
              </FlexItem>
            </Flex>
            <Table>
              <Thead>
                <Tr>
                  <Th width={20} dataLabel={USER_COLUMNS.name}>
                    {USER_COLUMNS.name}
                  </Th>
                  <Th width={20} dataLabel={USER_COLUMNS.email}>
                    {USER_COLUMNS.email}
                  </Th>
                  <Th width={40} dataLabel={USER_COLUMNS.projects}>
                    {USER_COLUMNS.projects}
                  </Th>
                  <Th width={10} dataLabel={USER_COLUMNS.status}>
                    {USER_COLUMNS.status}
                  </Th>
                  <Th width={5} screenReaderText="Edit Action" />
                  <Th width={5} screenReaderText="Delete Action" />
                </Tr>
              </Thead>
              <Tbody>
                {!fetching && users?.length === 0 && <TableEmptyState />}
                {!fetching && isError && <TableErrorState />}
                {!fetching &&
                  users.map((user) => (
                    <UserRow
                      user={user}
                      key={user.id}
                      setSelectedUser={setSelectedUser}
                      setIsDeleteModalOpen={setIsDeleteModalOpen}
                    />
                  ))}
                {fetching && (
                  <Tr>
                    <Td colSpan={6}>
                      <Skeleton />
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>

            <Pagination
              widgetId="pagination-options-menu-bottom"
              perPage={pageSize}
              page={page}
              variant={PaginationVariant.top}
              itemCount={totalItems}
              dropDirection="up"
              onSetPage={(_, value) => setPage(value)}
              onPerPageSelect={(_, value) => setPageSize(value)}
              style={{ marginTop: '1rem' }}
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
