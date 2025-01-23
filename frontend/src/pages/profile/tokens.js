import React from 'react';
import PropTypes from 'prop-types';
import { ToastContainer, toast } from 'react-toastify';

import {
  Button,
  Card,
  CardBody,
  ClipboardCopy,
  Flex,
  FlexItem,
  PageSection,
  PageSectionVariants,
  Text,
  TextContent,
} from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { getSpinnerRow } from '../../utilities';
import { FilterTable } from '../../components';
import AddTokenModal from '../../components/add-token-modal';
import DeleteModal from '../../components/delete-modal';
import ToastWrapper from '../../components/toast-wrapper';
import { ALERT_TIMEOUT } from '../../constants';


export class UserTokens extends React.Component {

  static propTypes = {
    location: PropTypes.object,
    navigate: PropTypes.func,
    eventEmitter: PropTypes.object
  }

  constructor(props) {
    super(props);
    this.eventEmitter = props.eventEmitter;
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
      columns: ['Name', 'Token', 'Expires', ''],
      rows: [getSpinnerRow(5)],
      page: page,
      pageSize: pageSize,
      totalItems: 0,
      totalPages: 0,
      isError: false,
      isEmpty: false,
      isAddTokenOpen: false,
      isDeleteTokenOpen: false,
      tokenToDelete: null,
    };
  }


  copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast(<ToastWrapper />,
      {
        data: {
          type: 'info',
          title: 'Copied to clipboard',
          message: 'Your token has been copied to the clipboard'
    }});
  }

  tokenToRow(token) {
    return {
      'cells': [
        {title: token.name},
        {title: (
          <ClipboardCopy isReadOnly hoverTip="Copy to clipboard" clickTip="Copied!">
            {token.token}
          </ClipboardCopy>
        )},
        {title: token.expires},
        {title: <Button variant="danger" onClick={() => this.onDeleteTokenClick(token)}>Delete</Button>}
      ]
    };
  }

  updateUrl() {
    let params = [];
    params.push('page=' + this.state.page);
    params.push('pageSize=' + this.state.pageSize);
    this.props.navigate('/profile/tokens?' + params.join('&'));
  }

  setPage = (_event, pageNumber) => {
    this.setState({page: pageNumber}, () => {
      this.updateUrl();
      this.getTokens();
    });
  }

  setPageSize = (_event, perPage) => {
    this.setState({pageSize: perPage}, () => {
      this.updateUrl();
      this.getTokens();
    });
  }

  // TODO: useEffect on add and delete modal close
  getTokens() {
    // First, show a spinner
    this.setState({rows: [getSpinnerRow(4)], isEmpty: false, isError: false});
    let params = {
      'pageSize': this.state.pageSize,
      'page': this.state.page
    };
    HttpClient.get([Settings.serverUrl, 'user', 'token'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({
        rows: data.tokens.map((token) => this.tokenToRow(token)),
        page: data.pagination.page,
        pageSize: data.pagination.pageSize,
        totalItems: data.pagination.totalItems,
        totalPages: data.pagination.totalPages,
        isEmpty: data.pagination.totalItems === 0
      }))
      .catch((error) => {
        console.error('Error fetching token data:', error);
        this.setState({rows: [], isEmpty: false, isError: true});
      });
  }

  onAddTokenClick = () => {
    this.setState({isAddTokenOpen: true});
  }

  onAddTokenClose = () => {
    this.setState({isAddTokenOpen: false});
  }

  onDeleteTokenClick = (token) => {
    this.setState({tokenToDelete: token, isDeleteTokenOpen: true});
  }

  onDeleteTokenClose = () => {
    this.setState({tokenToDelete: null, isDeleteTokenOpen: false});
  }

  componentDidMount() {
    this.getTokens();
  }

  render() {
    document.title = 'User Tokens | Ibutsu';
    const { columns, rows } = this.state;
    const pagination = {
      pageSize: this.state.pageSize,
      page: this.state.page,
      totalItems: this.state.totalItems
    };
    return (
      <React.Fragment>
        <PageSection id="page" variant={PageSectionVariants.light}>
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
            <FlexItem spacer={{ default: 'spacerLg' }}>
              <TextContent>
                <Text className="title" component="h1">Tokens</Text>
              </TextContent>
            </FlexItem>
            <FlexItem>
              <Button
                aria-label="Add token"
                variant="secondary"
                title="Add token"
                onClick={this.onAddTokenClick}
              >
                <PlusCircleIcon /> Add Token
              </Button>
            </FlexItem>
          </Flex>
        </PageSection>
        <PageSection>
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
        <AddTokenModal
          isOpen={this.state.isAddTokenOpen}
          onClose={this.onAddTokenClose}
        />
        <DeleteModal
          title="Delete token"
          body="Would you like to delete the selected token?"
          toDeleteId={this.state.tokenToDelete?.id}
          toDeletePath={['user', 'token']}
          isOpen={this.state.isDeleteTokenOpen}
          onClose={this.onDeleteTokenClose}
        />
        <ToastContainer autoClose={ALERT_TIMEOUT} stacked/>
      </React.Fragment>
    );
  }
}
