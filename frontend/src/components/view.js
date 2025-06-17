import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { PageSection, Title, Content } from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import AccessibilityDashboardView from '../views/accessibilitydashboard';
import JenkinsJobView from '../views/jenkinsjob';
import JenkinsJobAnalysisView from '../views/jenkinsjobanalysis';
import AccessibilityAnalysisView from '../views/accessibilityanalysis';
import CompareRunsView from '../views/compareruns';
import FilterProvider from './contexts/filterContext';

const VIEW_MAP = {
  'accessibility-dashboard-view': AccessibilityDashboardView,
  'accessibility-analysis-view': AccessibilityAnalysisView,
  'compare-runs-view': CompareRunsView,
  'jenkins-job-view': JenkinsJobView,
  'jenkins-analysis-view': JenkinsJobAnalysisView,
};

const View = () => {
  const params = useParams();

  const [viewSpec, setViewSpec] = useState();

  useEffect(() => {
    const fetchViewSpec = async () => {
      try {
        const response = await HttpClient.get([
          Settings.serverUrl,
          'widget-config',
          params.view_id,
        ]);
        const data = await HttpClient.handleResponse(response);
        setViewSpec(data);
      } catch (error) {
        console.error('Error fetching view spec:', error);
      }
    };

    if (params?.view_id) {
      const debouncer = setTimeout(() => {
        fetchViewSpec();
      }, 100);
      return () => {
        clearTimeout(debouncer);
      };
    }
  }, [params]);

  useEffect(() => {
    if (viewSpec) {
      document.title = viewSpec.title + ' | Ibutsu';
    }
  }, [viewSpec]);

  const ViewComponent = viewSpec ? VIEW_MAP[viewSpec.widget] : null;

  return (
    <React.Fragment>
      <PageSection hasBodyWrapper={false} id="page">
        <Content>
          <Title headingLevel="h1">
            {(viewSpec && viewSpec.title) || 'Loading...'}
          </Title>
        </Content>
      </PageSection>
      <PageSection hasBodyWrapper={false} className="pf-v6-u-pb-0">
        {!!ViewComponent && (
          <FilterProvider key={viewSpec.id}>
            <ViewComponent view={viewSpec} />
          </FilterProvider>
        )}
      </PageSection>
    </React.Fragment>
  );
};

export default View;
