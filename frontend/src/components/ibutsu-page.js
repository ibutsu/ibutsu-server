{
  /* TODO: Consider renaming to projects-page, maybe updates for static routing? */
}

import React, { useContext, useEffect } from 'react';

import { Outlet } from 'react-router-dom';

import {
  EmptyState,
  EmptyStateBody,
  EmptyStateHeader,
  EmptyStateIcon,
  Page,
} from '@patternfly/react-core';

import IbutsuHeader from './ibutsu-header';
import { IbutsuContext } from '../components/contexts/ibutsuContext';
import IbutsuSidebar from './sidebar';
import { ArchiveIcon } from '@patternfly/react-icons';
import { ToastContainer } from 'react-toastify';
import { ALERT_TIMEOUT } from '../constants';

const IbutsuPage = () => {
  const { primaryObject } = useContext(IbutsuContext);

  useEffect(() => {
    document.title = 'Ibutsu';
  }, []);

  return (
    <React.Fragment>
      <Page
        header={<IbutsuHeader />}
        sidebar={<IbutsuSidebar />}
        isManagedSidebar={true}
        style={{ position: 'relative' }}
      >
        {primaryObject ? (
          <Outlet />
        ) : (
          <EmptyState>
            <EmptyStateHeader
              titleText="No Project Selected"
              icon={<EmptyStateIcon icon={ArchiveIcon} />}
              headingLevel="h4"
            />
            <EmptyStateBody>
              There is currently no project selected. Please select a project
              from the dropdown in order to view the dashboard.
            </EmptyStateBody>
          </EmptyState>
        )}
      </Page>
      <ToastContainer stacked autoclose={ALERT_TIMEOUT} />
    </React.Fragment>
  );
};

IbutsuPage.propTypes = {};

export default IbutsuPage;
