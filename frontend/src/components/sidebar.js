import { use, useEffect, useState } from 'react';

import { Link, useParams } from 'react-router';
import { IbutsuContext } from './contexts/ibutsu-context';
import {
  PageSidebar,
  PageSidebarBody,
  Nav,
  NavList,
} from '@patternfly/react-core';
import { HttpClient } from '../utilities/http';
import { Settings } from '../pages/settings';

const IbutsuSidebar = () => {
  const context = use(IbutsuContext);
  const { primaryType, primaryObject } = context;
  const { project_id } = useParams();

  const [views, setViews] = useState();

  useEffect(() => {
    // When the project selection changes, fetch views to include unique sidebar items.
    const fetchViews = async () => {
      if (!primaryObject) {
        return;
      }

      let params = { filter: ['type=view', 'navigable=true'] };

      // read selected project from location
      params['filter'].push('project_id=' + primaryObject.id);
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'widget-config'],
          params,
        );
        const data = await HttpClient.handleResponse(response);
        // Note: project_id is handled at the widget config level, not in params
        // Views already have project_id from the database query filter
        setViews(data.widgets);
      } catch (error) {
        console.error('Error fetching project views:', error);
      }
    };
    if (primaryObject) {
      const debouncer = setTimeout(() => {
        fetchViews();
      }, 100);
      return () => {
        clearTimeout(debouncer);
      };
    }
  }, [primaryObject]);

  if (!project_id || primaryType !== 'project' || !primaryObject) {
    return;
  }

  const projectBasePath = `/project/${project_id}`;

  return (
    <PageSidebar ouiaId="project-sidebar">
      <PageSidebarBody isFilled>
        <Nav aria-label="Nav" ouiaId="project-nav">
          <NavList>
            <li className="pf-v6-c-nav__item">
              <Link to={`${projectBasePath}/dashboard`} className="pf-v6-c-nav__link">
                Dashboard
              </Link>
            </li>
            <li className="pf-v6-c-nav__item">
              <Link to={`${projectBasePath}/runs`} className="pf-v6-c-nav__link">
                Runs
              </Link>
            </li>
            <li className="pf-v6-c-nav__item">
              <Link to={`${projectBasePath}/results`} className="pf-v6-c-nav__link">
                Test Results
              </Link>
            </li>
            {views &&
              views.map(
                (view) =>
                  view.widget !== 'jenkins-analysis-view' && (
                    <li className="pf-v6-c-nav__item" key={view.id}>
                      <Link
                        to={`${projectBasePath}/view/${view.id}`}
                        className="pf-v6-c-nav__link"
                      >
                        {view.title}
                      </Link>
                    </li>
                  ),
              )}
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );
};

export default IbutsuSidebar;
