
import { useCallback, useContext, useEffect, useState } from 'react';

import { Link } from 'react-router-dom';
import { IbutsuContext } from '../services/context';
import {  PageSidebar,
  PageSidebarBody,
  Nav,
  NavList,
} from '@patternfly/react-core';
import { HttpClient } from '../services/http';
import { Settings } from '../settings';

const IbutsuSidebar = () => {
  const context = useContext(IbutsuContext);
  const { primaryType, primaryObject } = context;

  const [views, setViews] = useState();

  const setProjectViews = useCallback(() => {
    if (!primaryObject) {return;}

    let params = {'filter': ['type=view', 'navigable=true']};

    // read selected project from location
    params['filter'].push('project_id=' + primaryObject.id);

    HttpClient.get([Settings.serverUrl, 'widget-config'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        data.widgets.forEach(widget => {
          if (primaryObject) {
            widget.params['project'] = primaryObject.id;
          }
          else {
            delete widget.params['project'];
          }
        });
        setViews(data.widgets);})
      .catch(error => console.log(error));
  }, [primaryObject]);

  useEffect(() => {
    // When the project selection changes, fetch views to include unique sidebar items.
    setProjectViews();
  }, [primaryObject, setProjectViews]);


  if ( primaryType == 'project' && primaryObject  ) {
    return (
      <PageSidebar theme="dark" >
        <PageSidebarBody>
          <Nav theme="dark" aria-label="Nav">
            <NavList>
              <li className="pf-v5-c-nav__item">
                <Link to="dashboard" className="pf-v5-c-nav__link">Dashboard</Link>
              </li>
              <li className="pf-v5-c-nav__item">
                <Link to="runs/" className="pf-v5-c-nav__link">Runs</Link>
              </li>
              <li className="pf-v5-c-nav__item">
                <Link to="results/" className="pf-v5-c-nav__link">Test Results</Link>
              </li>
              <li className="pf-v5-c-nav__item">
                <Link to="reports/" className="pf-v5-c-nav__link">Report Builder</Link>
              </li>
              {views && views.map(view => (
                view.widget !== 'jenkins-analysis-view' && (
                  <li className="pf-v5-c-nav__item" key={view.id}>
                    <Link to={`view/${view.id}`} className="pf-v5-c-nav__link">{view.title}</Link>
                  </li>
                )
              ))}
            </NavList>
          </Nav>
        </PageSidebarBody>
      </PageSidebar>
    );
  }
};

export default IbutsuSidebar;
