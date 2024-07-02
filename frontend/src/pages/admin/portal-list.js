import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Card,
  CardBody,
  Flex,
  FlexItem,
  Modal,
  PageSection,
  PageSectionVariants,
  Text,
  TextContent,
  TextInput
} from '@patternfly/react-core';
import { PencilAltIcon, PlusCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { debounce, getSpinnerRow } from '../../utilities';
import { FilterTable } from '../../components';

function portalToRow(portal, onDeleteClick) {
  return {
    cells: [
      {title: portal.title},
      {title: portal.name},
      {title: portal.owner && portal.owner.name},
      {
        title: (
          <div style={{textAlign: "right"}}>
            <Button
              variant="primary"
              ouiaId={`admin-portals-edit-${portal.id}`}
              component={(props: any) => <Link {...props} to={`/admin/portals/${portal.id}`} />}
              size="sm"
            >
              <PencilAltIcon />
            </Button>
            &nbsp;
            <Button
              variant="danger"
              ouiaId={`admin-portals-delete-${portal.id}`}
              onClick={() => onDeleteClick(portal.id)}
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

export class PortalList extends React.Component {
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
      columns: ['Title', 'Name', 'Owner', ''],
      rows: [getSpinnerRow(4)],
      portals: [],
      page: page,
      pageSize: pageSize,
      totalItems: 0,
      totalPages: 0,
      isError: false,
      isEmpty: false,
      selectedPortal: null,
      isDeleting: false,
      isDeleteModalOpen: false,
      textFilter: ''
    };
  }

  updateUrl() {
    let params = [];
    params.push('page=' + this.state.page);
    params.push('pageSize=' + this.state.pageSize);
    this.props.navigate('/admin/portals?' + params.join('&'));
  }

  setPage = (_event, pageNumber) => {
    this.setState({page: pageNumber}, () => {
      this.updateUrl();
    });
  }

  setPageSize = (_event, perPage) => {
    this.setState({pageSize: perPage}, () => {
      this.updateUrl();
    });
  }

  getPortals() {
    // distract the user with jingling keys
    this.setState({rows: [getSpinnerRow(4)], isEmpty: false, isError: false});
    let params = {
      pageSize: this.state.pageSize,
      page: this.state.page
    };
    if (this.state.textFilter) {
      params['filter'] = ['title%' + this.state.textFilter];
    }
    HttpClient.get([Settings.serverUrl, 'admin', 'portal'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({
        rows: data.portals.map((portal) => portalToRow(portal, this.onDeleteClick)),
        portals: data.portals,
        page: data.pagination.page,
        pageSize: data.pagination.pageSize,
        totalItems: data.pagination.totalItems,
        totalPages: data.pagination.totalPages,
        isEmpty: data.pagination.totalItems === 0
      }))
      .catch((error) => {
        console.error('Error fetching portals data:', error);
        this.setState({rows: [], isEmpty: false, isError: true});
      });
  }

  onDeleteClick = (portalId) => {
    const selectedPortal = this.state.portals.find((portal) => portal.id === portalId);
    this.setState({selectedPortal: selectedPortal, isDeleteModalOpen: true});
  };

  onDeleteModalClose = () => {
    this.setState({isDeleteModalOpen: false});
  };

  onModalDeleteClick = () => {
    // spinner
    HttpClient.delete([Settings.serverUrl, 'admin', 'portal', this.state.selectedPortal.id])
      .then(response => HttpClient.handleResponse(response))
      .then(() => {
        this.getPortals();
        this.setState({isDeleteModalOpen: false});
      });
  }

  onTextChanged = (newValue) => {
    this.setState({textFilter: newValue}, debounce(() => {
      if (newValue.length >= 3 || newValue.length === 0) {
        this.updateUrl();
        this.getPortals();
      }
    }));
  };

  componentDidMount() {
    this.getPortals();
  }

  render() {
    document.title = 'Portals - Administration | Ibutsu';
    const { columns, rows, textFilter } = this.state;
    const pagination = {
      pageSize: this.state.pageSize,
      page: this.state.page,
      totalItems: this.state.totalItems
    };
    const filters = [
      <TextInput type="text" id="filter" placeholder="Search for portal..." value={textFilter || ''} onChange={(_event, newValue) => this.onTextChanged(newValue)} style={{height: "inherit"}} key="textFilter"/>
    ];
    return (
      <React.Fragment>
        <PageSection id="page" variant={PageSectionVariants.light}>
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
            <Flex>
              <FlexItem spacer={{ default: 'spacerLg' }}>
                <TextContent>
                  <Text className="title" component="h1" ouiaId="admin-portals">Portals</Text>
                </TextContent>
              </FlexItem>
            </Flex>
            <Flex>
              <FlexItem>
                <Button
                  aria-label="Add portal"
                  variant="secondary"
                  title="Add portal"
                  ouiaId="admin-portals-add"
                  component={(props: any) => <Link {...props} to="/admin/portals/new" />}
                >
                  <PlusCircleIcon /> Add Portal
                </Button>
              </FlexItem>
            </Flex>
          </Flex>
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
            <Button
              key="delete"
              variant="danger"
              ouiaId="admin-portals-modal-delete"
              isLoading={this.state.isDeleting}
              isDisabled={this.state.isDeleting}
              onClick={this.onModalDeleteClick}
            >
              {this.state.isDeleting ? 'Deleting...' : 'Delete'}
            </Button>,
            <Button
              key="cancel"
              variant="secondary"
              ouiaId="admin-portals-modal-cancel"
              isDisabled={this.state.isDeleting}
              onClick={this.onDeleteModalClose}
            >
              Cancel
            </Button>
          ]}
        >
          Are you sure you want to delete &ldquo;{this.state.selectedPortal && this.state.selectedPortal.title}&rdquo;? This cannot be undone!
        </Modal>
      </React.Fragment>
    );
  }
}
