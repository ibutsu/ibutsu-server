{/* TODO: Consider renaming to projects-page, maybe updates for static routing? */}

import React from 'react';
import PropTypes from 'prop-types';

import { Outlet } from 'react-router-dom';

import {
  EmptyState,
  EmptyStateBody,
  EmptyStateHeader,
  EmptyStateIcon,
  Page,
} from '@patternfly/react-core';

import IbutsuHeader from './ibutsu-header';
import { IbutsuContext } from '../services/context';
import IbutsuSidebar from './sidebar';
import { ArchiveIcon } from '@patternfly/react-icons';
import { ToastContainer } from 'react-toastify';
import { ALERT_TIMEOUT } from '../constants';



export class IbutsuPage extends React.Component {
  static contextType = IbutsuContext;

  static propTypes = {
    eventEmitter: PropTypes.object,
    navigation: PropTypes.node,
    location: PropTypes.object,
    children: PropTypes.node,
    title: PropTypes.string,
    params: PropTypes.object
  };

  constructor (props) {
    super(props);
    this.state = {
      views: []
    };
    // TODO: empty state props.children override

  }



  render () {
    document.title = this.props.title || 'Ibutsu';
    const { primaryObject } = this.context;
    return (
      <React.Fragment>
        <Page
          header={<IbutsuHeader/>}
          sidebar={<IbutsuSidebar eventEmitter={this.props.eventEmitter} />}
          isManagedSidebar={true}
          style={{position: 'relative'}}
        >
          {primaryObject ?
            <Outlet/> :
            <EmptyState>
              <EmptyStateHeader titleText="No Project Selected" icon={<EmptyStateIcon icon={ArchiveIcon} />} headingLevel="h4" />
              <EmptyStateBody>
              There is currently no project selected. Please select a project from the dropdown in
              order to view the dashboard.
              </EmptyStateBody>
            </EmptyState>
          }
        </Page>
        <ToastContainer stacked autoclose={ALERT_TIMEOUT} />
      </React.Fragment>
    );
  }
}
