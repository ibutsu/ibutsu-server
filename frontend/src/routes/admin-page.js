import { useEffect } from 'react';

import {
  Nav,
  NavList,
  Page,
  PageSidebar,
  PageSidebarBody,
  NavItem,
} from '@patternfly/react-core';

import { Link, Outlet } from 'react-router';

import IbutsuHeader from '../components/ibutsu-header';

const AdminPage = () => {
  const navigation = (
    <PageSidebar>
      <PageSidebarBody>
        <Nav aria-label="Nav">
          <NavList>
            {/*
              These links are rendered from the "" layout route inside
              Admin's descendant <Routes>, one level below the "admin/*"
              splat match. With React Router v7's default relative-splat
              resolution, a bare "users" would resolve relative to whatever
              splat-captured sub-page is currently active (e.g. clicking
              "Users" while on /admin/home would navigate to
              /admin/home/users instead of /admin/users). Absolute paths
              avoid that ambiguity entirely.
            */}
            <NavItem>
              <Link to="/admin/home" className="pf-v6-c-nav__link">
                Admin Home
              </Link>
            </NavItem>
            <NavItem>
              <Link to="/admin/users" className="pf-v6-c-nav__link">
                Users
              </Link>
            </NavItem>
            <NavItem>
              <Link to="/admin/projects" className="pf-v6-c-nav__link">
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
    <>
      <Page
        masthead={<IbutsuHeader />}
        sidebar={navigation}
        isManagedSidebar={true}
        style={{ position: 'relative' }}
      >
        <Outlet />
      </Page>
    </>
  );
};

export default AdminPage;
