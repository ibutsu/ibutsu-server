import React from 'react';
import PropTypes from 'prop-types';

import {
  Card,
  CardBody,
  PageSection,
  PageSectionVariants,
  Text,
  TextContent,
} from '@patternfly/react-core';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { getSpinnerRow } from '../../utilities';
import { FilterTable } from '../../components';

function projectToRow(project) {
  return {
    "cells": [
      {title: project.name},
      {title: project.title},
      {title: ""},
      {title: ""}
    ]
  }
}

export class ProjectList extends React.Component {
  static propTypes = {
    location: PropTypes.object,
    history: PropTypes.object,
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
      columns: ['Email', 'Display Name', 'Projects', 'Actions'],
      rows: [getSpinnerRow(4)],
      users: [],
      page: page,
      pageSize: pageSize,
      totalItems: 0,
      totalPages: 0,
      isError: false,
      isEmpty: false
    };
  }

  updateUrl() {
    let params = [];
    params.push('page=' + this.state.page);
    params.push('pageSize=' + this.state.pageSize);
    this.props.history.replace('/admin/users?' + params.join('&'));
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
    HttpClient.get([Settings.serverUrl, 'admin', 'users'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({
        rows: data.users.map((user) => projectToRow(user)),
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

  componentDidMount() {
    this.getUsers();
  }

  render() {
    document.title = 'Projects - Administration | Ibutsu';
    const { columns, rows } = this.state;
    const pagination = {
      pageSize: this.state.pageSize,
      page: this.state.page,
      totalItems: this.state.totalItems
    };
    return (
      <React.Fragment>
        <PageSection id="page" variant={PageSectionVariants.light}>
          <TextContent>
            <Text className="title" component="h1" ouiaId="projects">Projects</Text>
          </TextContent>
        </PageSection>
        <PageSection className="pf-u-pb-0">
          <Card>
            <CardBody className="pf-u-p-0">
              <FilterTable
                columns={columns}
                rows={rows}
                pagination={pagination}
                isEmpty={this.state.isEmpty}
                isError={this.state.isError}
                onSetPage={this.setPage}
                onSetPageSize={this.setPageSize}
              />
            </CardBody>
          </Card>
        </PageSection>
      </React.Fragment>
    );
  }
}
