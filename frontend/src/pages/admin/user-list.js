import React, { useEffect, useState } from 'react';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  FlexItem,
  Label,
  Modal,
  PageSection,
  PageSectionVariants,
  Pagination,
  PaginationVariant,
  Skeleton,
  TextContent,
  Title
} from '@patternfly/react-core';
import { BanIcon, CheckIcon, LinuxIcon, PencilAltIcon, TrashIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { toAPIFilter } from '../../utilities';
import useUserFilter from '../../components/user-filter';
import { Table, TableText, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { TableEmptyState, TableErrorState } from '../../components/tablestates';

const COLUMNS = {
  name:'Display Name',
  email:'Email',
  projects:'Projects',
  status:'Status',
  edit:'Edit Action',
  delete: 'Delete Action'
};

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

  const {filterComponents, activeFilterComponents, activeFilters } = useUserFilter();


  useEffect(() => {
    // fetch the users
    setFetching(true);
    const apiParams = {
      page: page,
      pageSize: pageSize,
      ...(Object.keys(activeFilters)?.length === 0 ? {} : {'filter': toAPIFilter(activeFilters)})
    };
    HttpClient.get([Settings.serverUrl, 'admin', 'user'], apiParams)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
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
      .then(response => HttpClient.handleResponse(response))
      .then(() => {
        setIsDeleting(false);
        setIsDeleteModalOpen(false);
      });
  };

  useEffect(() => {document.title = 'Users - Administration | Ibutsu';}, []);

  return (
    <React.Fragment>
      <PageSection id="page" variant={PageSectionVariants.light}>
        <TextContent>
          <Title headingLevel="h1" ouiaId="users-title">Users</Title>
        </TextContent>
      </PageSection>
      <PageSection>
        <Card>
          <CardHeader>
            {filterComponents}
            {activeFilterComponents}
          </CardHeader>
          <CardBody>
            <Flex alignSelf={{default: 'alignSelfFlexEnd'}} direction={{default: 'column'}} align={{default: 'alignRight'}}>
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
                  <Th width={20} dataLabel={COLUMNS.name}>{COLUMNS.name}</Th>
                  <Th width={20} dataLabel={COLUMNS.name}>{COLUMNS.email}</Th>
                  <Th width={40} dataLabel={COLUMNS.name}>{COLUMNS.projects}</Th>
                  <Th width={10} dataLabel={COLUMNS.name}>{COLUMNS.status}</Th>
                  <Th width={5} screenReaderText='Edit Action'/>
                  <Th width={5} screenReaderText='Delete Action'/>
                </Tr>
              </Thead>
              <Tbody>
                {!fetching && users?.length === 0 && <TableEmptyState />}
                {!fetching && isError && <TableErrorState />}
                {!fetching &&
                  users.map((user) => {
                    let userName = user.name;
                    if (user.is_superadmin) {
                      userName = [
                        user.name,
                        ' ',

                      ];
                    }
                    return(
                      <Tr key={user.id}>
                        <Td dataLabel={COLUMNS.name}>{userName} </Td>
                        <Td dataLabel={COLUMNS.email}>{user.email}</Td>
                        <Td dataLabel={COLUMNS.projects} modifier='wrap'>{user.projects ? user.projects.map(project => project.title).join(', ') : ''}</Td>
                        <Td dataLabel={COLUMNS.status}>
                          {
                            user.is_active
                              ? <Label key="active" className="active" variant="filled" color="green" icon={<CheckIcon />}>Active</Label>
                              : <Label key="inactive" className="active" variant="filled" color="red" icon={<BanIcon />}>Inactive</Label>}
                          {user.is_superadmin
                            ? <Label key="admin" className="super-admin-label" variant="outline" color="orange" icon={<LinuxIcon/>}>Administrator</Label>
                            : '' }
                        </Td>
                        <Td dataLabel={COLUMNS.edit}>
                          <TableText>
                            <Button
                              variant="primary"
                              ouiaId={`admin-users-edit-${user.id}`}
                              component={(props) => <Link {...props} to={`/admin/users/${user.id}`} />}
                              size="sm"
                              aria-label='Edit'
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
                  })
                }
                {fetching && <Tr ><Td colSpan={6}><Skeleton/></Td></Tr>}
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
              style={{marginTop: '1rem'}}
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
