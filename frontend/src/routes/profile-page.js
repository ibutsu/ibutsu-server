import React from 'react';

import {
  Nav,
  NavList,
  Page,
  PageSidebar,
  PageSidebarBody,
} from '@patternfly/react-core';

import { NavLink, Outlet } from 'react-router-dom';

import IbutsuHeader from '../components/ibutsu-header';
import { ToastContainer } from 'react-toastify';
import { ALERT_TIMEOUT } from '../constants';

const ProfilePage = () => {
  return (
    <React.Fragment>
      <ToastContainer autoclose={ALERT_TIMEOUT} />
      <Page
        masthead={<IbutsuHeader />}
        sidebar={
          <PageSidebar>
            <PageSidebarBody>
              <Nav onSelect={React.Component.onNavSelect} aria-label="Nav">
                <NavList>
                  <li className="pf-v6-c-nav__item">
                    <NavLink to="profile" className="pf-v6-c-nav__link">
                      Profile
                    </NavLink>
                  </li>
                  <li className="pf-v6-c-nav__item">
                    <NavLink to="tokens" className="pf-v6-c-nav__link">
                      Tokens
                    </NavLink>
                  </li>
                </NavList>
              </Nav>
            </PageSidebarBody>
          </PageSidebar>
        }
        isManagedSidebar={true}
        style={{ position: 'relative' }}
      >
        <Outlet />
      </Page>
    </React.Fragment>
  );
};

export default ProfilePage;
