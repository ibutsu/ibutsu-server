{
  /* TODO: Consider renaming to projects-page, maybe updates for static routing? */
}

import { useContext, useEffect } from 'react';

import { Outlet } from 'react-router-dom';

import { EmptyState, EmptyStateBody, Page } from '@patternfly/react-core';

import IbutsuHeader from '../components/ibutsu-header';
import { IbutsuContext } from '../components/contexts/ibutsu-context';
import IbutsuSidebar from '../components/sidebar';
import ArchiveIcon from '@patternfly/react-icons/dist/esm/icons/archive-icon';
import { ToastContainer } from 'react-toastify';
import { ALERT_TIMEOUT } from '../constants';

const IbutsuPage = () => {
  const { primaryObject } = useContext(IbutsuContext);

  useEffect(() => {
    document.title = 'Ibutsu';
  }, []);

  return (
    <>
      <Page
        masthead={<IbutsuHeader />}
        sidebar={<IbutsuSidebar />}
        isManagedSidebar={true}
        style={{ position: 'relative' }}
      >
        {primaryObject ? (
          <Outlet />
        ) : (
          <EmptyState
            headingLevel="h4"
            icon={ArchiveIcon}
            titleText="No Project Selected"
          >
            <EmptyStateBody>
              There is currently no project selected. Please select a project
              from the dropdown in order to view the dashboard.
            </EmptyStateBody>
          </EmptyState>
        )}
      </Page>
      <ToastContainer stacked autoclose={ALERT_TIMEOUT} />
    </>
  );
};

IbutsuPage.propTypes = {};

export default IbutsuPage;
