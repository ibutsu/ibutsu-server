import React from 'react';

import {
  Nav,
  NavList,
  Page,
  PageSidebar,
  PageSidebarBody
} from '@patternfly/react-core';

import { Link, Outlet } from 'react-router-dom';

import IbutsuHeader from './ibutsu-header';



const AdminPage = () => {
  const navigation = (
    // TODO what is onNavSelect doing here ... I just carried this from a class ref
    <PageSidebar theme="dark" >
      <PageSidebarBody>
        <Nav onSelect={React.Component.onNavSelect} theme="dark" aria-label="Nav">
          <NavList>
            <li className="pf-v5-c-nav__item">
              <Link to="home" className="pf-v5-c-nav__link">Admin Home</Link>
            </li>
            <li className="pf-v5-c-nav__item">
              <Link to="users" className="pf-v5-c-nav__link">Users</Link>
            </li>
            <li className="pf-v5-c-nav__item">
              <Link to="projects" className="pf-v5-c-nav__link">Projects</Link>
            </li>
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );

  document.title = 'Administration | Ibutsu';

  return (
    <React.Fragment>
      <Page
        // TODO simplified admin header
        header={<IbutsuHeader/>}
        sidebar={navigation}
        isManagedSidebar={true}
        style={{position: 'relative'}}
      >
        <Outlet/>
      </Page>
    </React.Fragment>
  );
};

export default AdminPage;
