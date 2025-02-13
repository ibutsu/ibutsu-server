import React from 'react';

import {
  Nav,
  NavList,
  Page,
  PageSidebar,
  PageSidebarBody
} from '@patternfly/react-core';

import { Link, Outlet } from 'react-router-dom';
import ElementWrapper from './elementWrapper';

import { IbutsuHeader } from './ibutsu-header';
import PropTypes from 'prop-types';



const AdminPage = (props) => {
  // TODO useEffect instead of eventEmitter prop
  // TODO notifications on admin page with state and AlertGroup
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
        header={<ElementWrapper routeElement={IbutsuHeader} eventEmitter={props.eventEmitter}/>}
        sidebar={navigation}
        isManagedSidebar={true}
        style={{position: 'relative'}}
      >
        <Outlet/>
      </Page>
    </React.Fragment>
  );
};

AdminPage.propTypes = {
  eventEmitter: PropTypes.object,
};

export default AdminPage;
