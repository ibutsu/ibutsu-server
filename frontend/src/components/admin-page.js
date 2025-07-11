import React, { useEffect } from 'react';

import {
  Nav,
  NavList,
  Page,
  PageSidebar,
  PageSidebarBody,
  NavItem,
} from '@patternfly/react-core';

import { Link, Outlet } from 'react-router-dom';

import IbutsuHeader from './ibutsu-header';

const AdminPage = () => {
  const navigation = (
    <PageSidebar>
      <PageSidebarBody>
        <Nav aria-label="Nav">
          <NavList>
            <NavItem>
              <Link to="home" className="pf-v6-c-nav__link">
                Admin Home
              </Link>
            </NavItem>
            <NavItem>
              <Link to="users" className="pf-v6-c-nav__link">
                Users
              </Link>
            </NavItem>
            <NavItem>
              <Link to="projects" className="pf-v6-c-nav__link">
                Projects
              </Link>
            </NavItem>
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );

  useEffect(() => {
    document.title = 'Administration | Ibutsu';
  }, []);

  return (
    <React.Fragment>
      <Page
        masthead={<IbutsuHeader />}
        sidebar={navigation}
        isManagedSidebar={true}
        style={{ position: 'relative' }}
      >
        <Outlet />
      </Page>
    </React.Fragment>
  );
};

export default AdminPage;
