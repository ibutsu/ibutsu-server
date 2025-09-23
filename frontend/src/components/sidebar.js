import { useContext, useEffect, useState } from 'react';

import { Link } from 'react-router-dom';
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
  const context = useContext(IbutsuContext);
  const { primaryType, primaryObject } = context;

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

  if (primaryType == 'project' && primaryObject) {
    return (
      <PageSidebar>
        <PageSidebarBody isFilled>
          <Nav aria-label="Nav">
            <NavList>
              <li className="pf-v6-c-nav__item">
                <Link to="dashboard" className="pf-v6-c-nav__link">
                  Dashboard
                </Link>
              </li>
              <li className="pf-v6-c-nav__item">
                <Link to="runs/" className="pf-v6-c-nav__link">
                  Runs
                </Link>
              </li>
              <li className="pf-v6-c-nav__item">
                <Link to="results/" className="pf-v6-c-nav__link">
                  Test Results
                </Link>
              </li>
              {views &&
                views.map(
                  (view) =>
                    view.widget !== 'jenkins-analysis-view' && (
                      <li className="pf-v6-c-nav__item" key={view.id}>
                        <Link
                          to={`view/${view.id}`}
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
  }
};

export default IbutsuSidebar;
