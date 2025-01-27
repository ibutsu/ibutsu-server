import React from 'react';

import {
  Nav,
  NavList,
  Page,
  PageSidebar,
  PageSidebarBody
} from '@patternfly/react-core';

import { NavLink, Outlet} from 'react-router-dom';


import IbutsuHeader from './ibutsu-header';
import { ToastContainer } from 'react-toastify';
import { ALERT_TIMEOUT } from '../constants';
import { getDarkTheme } from '../utilities';



const ProfilePage = () => {
  // TODO useEffect

  const navigation = (
    // TODO what is onNavSelect doing here ...
    <PageSidebar theme={getDarkTheme() ? 'dark' : 'light200'} >
      <PageSidebarBody>
        <Nav onSelect={React.Component.onNavSelect} theme={getDarkTheme() ? 'dark' : 'light200'} aria-label="Nav">
          <NavList>
            <li className="pf-v5-c-nav__item">
              <NavLink to="profile" className="pf-v5-c-nav__link">Profile</NavLink>
            </li>
            <li className="pf-v5-c-nav__item">
              <NavLink to="tokens" className="pf-v5-c-nav__link">Tokens</NavLink>
            </li>
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );

  return (
    <React.Fragment>
        <ToastContainer autoclose={ALERT_TIMEOUT} />
        <Page
            header={<IbutsuHeader/>}
            sidebar={navigation}
            isManagedSidebar={true}
            style={{position: 'relative'}}
        >
            <Outlet/>
        </Page>
    </React.Fragment>
  );
}

export default ProfilePage
