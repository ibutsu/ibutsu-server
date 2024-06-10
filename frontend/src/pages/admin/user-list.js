import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Card,
  CardBody,
  Label,
  Modal,
  PageSection,
  PageSectionVariants,
  Text,
  TextContent,
  TextInput
} from '@patternfly/react-core';
import { PencilAltIcon, TrashIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { debounce, getSpinnerRow } from '../../utilities';
import { FilterTable } from '../../components';

function userToRow(user, onDeleteClick) {
  let userName = user.name;
  if (user.is_superadmin) {
    userName = [
      user.name,
      " ",
      <Label key="admin" className="super-admin-label" variant="filled" color="blue" isCompact>Administrator</Label>
    ];
  }
  return {
    "cells": [
      {title: userName},
      {title: user.email},
      {title: user.projects ? user.projects.map(project => project.title).join(', ') : ''},
      {title: user.is_active ? 'Active' : 'Inactive'},
      {
        title: (
          <div style={{textAlign: "right"}}>
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
              onClick={() => onDeleteClick(user.id)}
              size="sm"
            >
              <TrashIcon />
            </Button>
          </div>
        )
      }
    ]
  }
}

export class UserList extends React.Component {
  static propTypes = {
    location: PropTypes.object,
    navigate: PropTypes.func,
  }

  constructor(props) {
    super(props);
    const params = new URLSearchParams(props.location.search);
    let page = 1, pageSize = 20;
    if (params.toString() !== '') {
      for(let pair of params) {
        if (pair[0] === 'page') {
          page = parseInt(pair[1]);
        }
        else if (pair[0] === 'pageSize') {
          pageSize = parseInt(pair[1]);
        }
      }
    }
    this.state = {
      columns: ['Display Name', 'Email', 'Projects', 'Status', ''],
      rows: [getSpinnerRow(5)],
      users: [],
      page: page,
      pageSize: pageSize,
      totalItems: 0,
      totalPages: 0,
      isError: false,
      isEmpty: false,
      selectedUser: null,
      isDeleting: false,
      isDeleteModalOpen: false,
      textFilter: ''
    };
  }

  updateUrl() {
    let params = [];
    params.push('page=' + this.state.page);
    params.push('pageSize=' + this.state.pageSize);
    this.props.navigate('/admin/users?' + params.join('&'))
  }

  setPage = (_event, pageNumber) => {
    this.setState({page: pageNumber}, () => {
      this.updateUrl();
      this.getUsers();
    });
  }

  setPageSize = (_event, perPage) => {
    this.setState({pageSize: perPage}, () => {
      this.updateUrl();
      this.getUsers();
    });
  }

  getUsers() {
    // Show a spinner
    this.setState({rows: [getSpinnerRow(4)], isEmpty: false, isError: false});
    let params = {
      pageSize: this.state.pageSize,
      page: this.state.page
    };
    if (this.state.textFilter) {
      params['filter'] = ['name%' + this.state.textFilter];
    }
    HttpClient.get([Settings.serverUrl, 'admin', 'user'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({
        rows: data.users.map((user) => userToRow(user, this.onDeleteClick)),
        users: data.users,
        page: data.pagination.page,
        pageSize: data.pagination.pageSize,
        totalItems: data.pagination.totalItems,
        totalPages: data.pagination.totalPages,
        isEmpty: data.pagination.totalItems === 0
      }))
      .catch((error) => {
        console.error('Error fetching users data:', error);
        this.setState({rows: [], isEmpty: false, isError: true});
      });
  }

  onDeleteClick = (userId) => {
    const selectedUser = this.state.users.find((user) => user.id === userId);
    this.setState({selectedUser: selectedUser, isDeleteModalOpen: true});
  };

  onDeleteModalClose = () => {
    this.setState({isDeleteModalOpen: false});
  };

  onModalDeleteClick = () => {
    // spinner
    HttpClient.delete([Settings.serverUrl, 'admin', 'user', this.state.selectedUser.id])
      .then(response => HttpClient.handleResponse(response))
      .then(() => {
        this.getUsers();
        this.setState({isDeleteModalOpen: false});
      });
  }

  onTextChanged = (newValue) => {
    this.setState({textFilter: newValue}, debounce(() => {
      if (newValue.length >= 3 || newValue.length === 0) {
        this.updateUrl();
        this.getUsers();
      }
    }));
  };

  componentDidMount() {
    this.getUsers();
  }

  render() {
    document.title = 'Users - Administration | Ibutsu';
    const { columns, rows, textFilter } = this.state;
    const pagination = {
      pageSize: this.state.pageSize,
      page: this.state.page,
      totalItems: this.state.totalItems
    };
    const filters = [
      <TextInput type="text" id="filter" placeholder="Search for user..." value={textFilter || ''} onChange={(_event, newValue) => this.onTextChanged(newValue)} style={{height: "inherit"}} key="textFilter"/>
    ];
    return (
      <React.Fragment>
        <PageSection id="page" variant={PageSectionVariants.light}>
          <TextContent>
            <Text className="title" component="h1" ouiaId="users">Users</Text>
          </TextContent>
        </PageSection>
        <PageSection className="pf-u-pb-0">
          <Card>
            <CardBody className="pf-u-p-0">
              <FilterTable
                columns={columns}
                rows={rows}
                filters={filters}
                pagination={pagination}
                isEmpty={this.state.isEmpty}
                isError={this.state.isError}
                onSetPage={this.setPage}
                onSetPageSize={this.setPageSize}
              />
            </CardBody>
          </Card>
        </PageSection>
        <Modal
          title="Confirm Delete"
          variant="small"
          isOpen={this.state.isDeleteModalOpen}
          onClose={this.onDeleteModalClose}
          actions={[
            <Button key="delete" variant="danger" isLoading={this.state.isDeleting} isDisabled={this.state.isDeleting} onClick={this.onModalDeleteClick}>
              {this.state.isDeleting ? 'Deleting...' : 'Delete'}
            </Button>,
            <Button key="cancel" variant="secondary" isDisabled={this.state.isDeleting} onClick={this.onDeleteModalClose}>
              Cancel
            </Button>
          ]}
        >
          Are you sure you want to delete &ldquo;{this.state.selectedUser && this.state.selectedUser.name}&rdquo;? This cannot be undone!
        </Modal>
      </React.Fragment>
    );
  }
}
