import React, {useEffect, useState} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import {
  PageSection,
  PageSectionVariants,
  Title,
  TextContent
} from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import AccessibilityDashboardView from '../views/accessibilitydashboard';
import JenkinsJobView from '../views/jenkinsjob';
import JenkinsJobAnalysisView from '../views/jenkinsjobanalysis';
import AccessibilityAnalysisView from '../views/accessibilityanalysis';
import CompareRunsView from '../views/compareruns';

const VIEW_MAP = {
  'accessibility-dashboard-view': AccessibilityDashboardView,
  'accessibility-analysis-view': AccessibilityAnalysisView,
  'compare-runs-view': CompareRunsView,
  'jenkins-job-view': JenkinsJobView,
  'jenkins-analysis-view': JenkinsJobAnalysisView
};

const View = () => {
  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();

  const [view, setView] = useState();

  useEffect(() =>{
    if (params?.view_id) {
      HttpClient.get([Settings.serverUrl, 'widget-config', params.view_id])
        .then(response => HttpClient.handleResponse(response))
        .then(data => setView(data))
        .catch((error) => {console.error(error);});
    }

  }, [params]);

  document.title = view ? view.title + ' | Ibutsu' : document.title;
  const ViewComponent = view ? VIEW_MAP[view.widget] : null;

  return(
    <React.Fragment>
      <PageSection id="page" variant={PageSectionVariants.light}>
        <TextContent>
          <Title headingLevel="h1">
            {(view && view.title) ||
            'Loading...'}
          </Title>
        </TextContent>
      </PageSection>
      <PageSection className="pf-u-pb-0">
        {!!ViewComponent &&
          <ViewComponent view={view} location={location} navigate={navigate}/>
        }
      </PageSection>
    </React.Fragment>
  );
};

export default View;
