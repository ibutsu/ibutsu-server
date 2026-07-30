import {
  Nav,
  NavList,
  Page,
  PageSidebar,
  PageSidebarBody,
} from '@patternfly/react-core';

import { NavLink, Outlet } from 'react-router';

import IbutsuHeader from '../components/ibutsu-header';
import { ToastContainer } from 'react-toastify';
import { ALERT_TIMEOUT } from '../constants';

const ProfilePage = () => {
  return (
    <>
      <ToastContainer autoclose={ALERT_TIMEOUT} />
      <Page
        masthead={<IbutsuHeader />}
        sidebar={
          <PageSidebar>
            <PageSidebarBody>
              <Nav aria-label="Nav">
                <NavList>
                  {/* Absolute paths: this sidebar is nested under Profile's own splat route. */}
                  <li className="pf-v6-c-nav__item">
                    <NavLink to="/profile/user" className="pf-v6-c-nav__link">
                      Profile
                    </NavLink>
                  </li>
                  <li className="pf-v6-c-nav__item">
                    <NavLink to="/profile/tokens" className="pf-v6-c-nav__link">
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
    </>
  );
};

export default ProfilePage;
