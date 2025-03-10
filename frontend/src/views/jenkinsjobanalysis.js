import React, { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Switch,
  Tab,
  Tabs
} from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';


import GenericAreaWidget from '../widgets/genericarea';
import GenericBarWidget from '../widgets/genericbar';
import FilterHeatmapWidget from '../widgets/filterheatmap';
import { HEATMAP_MAX_BUILDS } from '../constants';
import { IbutsuContext } from '../services/context';
import ParamDropdown from '../components/param-dropdown';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

const DEFAULT_BAR = 8;

const SHORT_BUILDS = [10, 20, 30, 40];
const LONG_BUILDS = [...SHORT_BUILDS, 70, 150];

const PF_BACK_100 = 'var(--pf-v5-global--BackgroundColor--100)';

const JenkinsJobAnalysisView =(props) => {
  const context = useContext(IbutsuContext);
  const {primaryObject} = context;
  const {view} = props;
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isAreaChart, setIsAreaChart] = useState(false);
  const [isLoading, setIsLoading] = useState();
  const [activeTab, setActiveTab] = useState('heatmap');

  const [barWidth, setBarWidth] = useState(DEFAULT_BAR);
  const [builds, setBuilds] = useState(20);
  const [countSkips, setCountSkips] = useState(true);

  const [heatmapParams, setHeatmapParams] = useState({'count_skips': countSkips});
  const [barchartParams, setBarchartParams] = useState({});
  const [linechartParams, setLinechartParams] = useState({});

  useEffect(() => {
    // Fetch the widget parameters for heatmap, barchart and linechart
    if (view) {
      setIsLoading(true);

      let params = {...view.params};
      if (primaryObject) {
        params['project'] = primaryObject.id;
      }
      else {
        delete params['project'];
      }
      if (searchParams.get('job_name')) {
        params['job_name'] = searchParams.get('job_name');
      }
      params['builds'] = builds;
      HttpClient.get([Settings.serverUrl, 'widget', view.widget], params)
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          setHeatmapParams({
            ...data.heatmap_params,
            'count_skips': countSkips
          });
          setBarchartParams(data.barchart_params);
          setLinechartParams(data.linechart_params);
          setIsLoading(false);
        })
        .catch(error => {
          console.error(error);
          setIsLoading(false);
        });
    }
  }, [builds, countSkips, primaryObject, view, searchParams]);

  useEffect(() => {
    let newWidth = DEFAULT_BAR;
    if (builds > HEATMAP_MAX_BUILDS) {
      if (builds > 100) {
        newWidth = 2;
      }
      else {
        newWidth = 5;
      }
    }
    setBarWidth(newWidth);
  }, [builds]);

  const getColors = (key) => {
    let color = 'var(--pf-v5-global--success-color--100)';
    if (key === 'failed') {
      color = 'var(--pf-v5-global--danger-color--100)';
    }
    else if (key === 'skipped') {
      color = 'var(--pf-v5-global--info-color--100)';
    }
    else if (key === 'error') {
      color = 'var(--pf-v5-global--warning-color--100)';
    }
    else if (key === 'xfailed') {
      color = 'var(--pf-v5-global--palette--purple-400)';
    }
    else if (key === 'xpassed') {
      color = 'var(--pf-v5-global--palette--purple-700)';
    }
    return color;
  };

  const onTabSelect = (_, tabIndex) => {
    navigate(`${location.pathname}${location.search}#${tabIndex}`);
    setActiveTab(tabIndex);
  };

  return (
    <React.Fragment>
      <div style={{backgroundColor: PF_BACK_100, float: 'right', clear: 'right', marginBottom: '-2em', padding: '0.2em 1em', width: '30em'}}>
        <ParamDropdown
          dropdownItems={['overall-health', 'build-durations'].includes(activeTab) ? LONG_BUILDS : SHORT_BUILDS}
          defaultValue={(activeTab === 'heatmap') ? Math.min(builds, HEATMAP_MAX_BUILDS) : builds}
          handleSelect={setBuilds}
          tooltip="Number of builds:"
        />
      </div>
      {activeTab === 'heatmap' &&
      <div style={{backgroundColor: PF_BACK_100, float: 'right', clear: 'none', marginBottom: '-2em', padding: '0.2em 1em', width: '30em'}}>
        <ParamDropdown
          dropdownItems={['Yes', 'No']}
          defaultValue={(countSkips ? 'Yes': 'No')}
          handleSelect={(value) => setCountSkips(value === 'Yes')}
          tooltip="Count skips as failure:"
        />
      </div>
      }
      {activeTab === 'overall-health' &&
      <div style={{backgroundColor: PF_BACK_100, float: 'right', clear: 'none', marginBottom: '-2em', padding: '0.5em 1em'}}>
        <Switch
          id="bar-chart-switch"
          labelOff="Change to Area Chart"
          label="Change to Bar Chart"
          isChecked={isAreaChart}
          onChange={(_, checked) => setIsAreaChart(checked)}
        />
      </div>
      }
      <Tabs activeKey={activeTab} onSelect={onTabSelect} isBox>
        <Tab eventKey='heatmap' title="Heatmap">
          {!isLoading && activeTab === 'heatmap' &&
        <FilterHeatmapWidget
          title={heatmapParams.job_name}
          params={heatmapParams}
          hideDropdown={true}
          abelWidth={400}
          type='jenkins'
        />
          }
        </Tab>
        <Tab eventKey='overall-health' title="Overall Health">
          {!isLoading && !isAreaChart && activeTab === 'overall-health' &&
        <GenericBarWidget
          title={'Test counts for ' + barchartParams.job_name}
          params={barchartParams}
          hideDropdown={true}
          widgetEndpoint="jenkins-bar-chart"
          barWidth={barWidth}
          horizontal={false}
          xLabelTooltip="Build"
          height={180}
          yLabel="Test counts"
          xLabel="Build number"
          padding={{
            bottom: 50,
            left: 50,
            right: 20,
            top: 20
          }}
          fontSize={9}
          sortOrder="ascending"
        />
          }
          {!isLoading && isAreaChart && activeTab === 'overall-health' &&
        <GenericAreaWidget
          title={'Test counts for ' + barchartParams.job_name}
          params={barchartParams}
          hideDropdown={true}
          getColors={getColors}
          widgetEndpoint="jenkins-bar-chart"
          height={180}
          yLabel="Test counts"
          xLabel="Build number"
          sortOrder="ascending"
          showTooltip={false}
          colorScale={[
            'var(--pf-v5-global--warning-color--100)',
            'var(--pf-v5-global--danger-color--100)',
            'var(--pf-v5-global--success-color--100)',
            'var(--pf-v5-global--info-color--100)',
          ]}
          padding={{
            bottom: 50,
            left: 50,
            right: 20,
            top: 20
          }}
          fontSize={9}
        />
          }
        </Tab>
        <Tab eventKey='build-durations' title="Build Duration">
          {!isLoading && activeTab === 'build-durations' &&
        <GenericAreaWidget
          title={'Durations for ' + linechartParams.job_name}
          params={linechartParams}
          hideDropdown={true}
          height={180}
          padding={{
            bottom: 50,
            left: 50,
            right: 20,
            top: 20
          }}
          fontSize={9}
          showTooltip={true}
          sortOrder="ascending"
          xLabel="Build number"
          yLabel="Time [hrs]"
          varExplanation="* Note: since for some jobs, the plugin tests execute in parallel, 'Duration' is the real time for which the build ran. 'Total Execution Time' is the sum of durations for each plugin run."
        />
          }
        </Tab>
      </Tabs>
    </React.Fragment>
  );
};

JenkinsJobAnalysisView.propTypes = {
  view: PropTypes.object
};

export default JenkinsJobAnalysisView;
