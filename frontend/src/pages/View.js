import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { PageSection, Title, Content } from '@patternfly/react-core';

import { HttpClient } from '../utilities/http';
import { Settings } from '../pages/settings';
import AccessibilityDashboardView from '../views/accessibility-dashboard';
import JenkinsJobView from '../views/jenkins-job';
import JenkinsJobAnalysisView from '../views/jenkins-job-analysis';
import AccessibilityAnalysisView from '../views/accessibility-analysis';
import CompareRunsView from '../views/compare-runs';
import FilterProvider from '../components/contexts/filter-context';

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
    <>
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
    </>
  );
};

export default View;
