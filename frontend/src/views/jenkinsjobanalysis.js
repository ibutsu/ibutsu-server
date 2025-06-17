import React, { useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Switch, Tab, Tabs } from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';

import GenericAreaWidget from '../widgets/genericarea';
import GenericBarWidget from '../widgets/genericbar';
import { FilterHeatmapWidget, HEATMAP_TYPES } from '../widgets/filterheatmap';
import { HEATMAP_MAX_BUILDS } from '../constants';
import { IbutsuContext } from '../components/contexts/ibutsuContext';
import ParamDropdown from '../components/param-dropdown';
import { useTabHook } from '../components/hooks/useTab';
import { FilterContext } from '../components/contexts/filterContext';

const DEFAULT_BAR = 8;

const SHORT_BUILDS = [10, 20, 30, 40];
const LONG_BUILDS = [...SHORT_BUILDS, 70, 150];

const PF_BACK_100 = 'var(--pf-t--color--background--secondary)';

const JenkinsJobAnalysisView = ({ view, defaultTab = 'heatmap' }) => {
  const { primaryObject } = useContext(IbutsuContext);
  const { activeFilters } = useContext(FilterContext);

  const [isAreaChart, setIsAreaChart] = useState(false);
  const [isLoading, setIsLoading] = useState();

  const [barWidth, setBarWidth] = useState(DEFAULT_BAR);
  const [builds, setBuilds] = useState(20);
  const [countSkips, setCountSkips] = useState(true);

  const [widgetParams, setWidgetParams] = useState({});
  const [barchartParams, setBarchartParams] = useState({});
  const [linechartParams, setLinechartParams] = useState({});

  const { activeTab, onTabSelect } = useTabHook({
    validTabIndicies: ['heatmap', 'overall-health', 'build-durations'],
    defaultTab: defaultTab,
  });

  useEffect(() => {
    // Fetch the widget parameters for heatmap, barchart and linechart
    const fetchWidgetParams = async () => {
      try {
        setIsLoading(true);
        let params = {
          ...view.params,
          project: primaryObject?.id,
          job_name: activeFilters.filter((f) => f.field === 'job_name')[0]
            ?.value,
        };

        params['builds'] = builds;
        const response = await HttpClient.get(
          [Settings.serverUrl, 'widget', view.widget],
          params,
        );
        const data = await HttpClient.handleResponse(response);
        setWidgetParams({
          ...data.heatmap_params,
        });
        setBarchartParams(data.barchart_params);
        setLinechartParams(data.linechart_params);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching widget parameters:', error);
        setIsLoading(false);
      }
    };

    if (view) {
      const debouncer = setTimeout(() => {
        fetchWidgetParams();
      }, 50);
      return () => clearTimeout(debouncer);
    }
  }, [builds, countSkips, primaryObject, view, activeFilters]);

  useEffect(() => {
    let newWidth = DEFAULT_BAR;
    if (builds > HEATMAP_MAX_BUILDS) {
      if (builds > 100) {
        newWidth = 2;
      } else {
        newWidth = 5;
      }
    }
    setBarWidth(newWidth);
  }, [builds]);

  const heatmapParams = useMemo(() => {
    return {
      ...widgetParams,
      count_skips: countSkips,
    };
  }, [countSkips, widgetParams]);

  return (
    <React.Fragment>
      <div
        style={{
          backgroundColor: PF_BACK_100,
          float: 'right',
          clear: 'right',
          marginBottom: '-2em',
          padding: '0.2em 1em',
          width: '30em',
        }}
      >
        <ParamDropdown
          dropdownItems={
            ['overall-health', 'build-durations'].includes(activeTab)
              ? LONG_BUILDS
              : SHORT_BUILDS
          }
          defaultValue={
            activeTab === 'heatmap'
              ? Math.min(builds, HEATMAP_MAX_BUILDS)
              : builds
          }
          handleSelect={setBuilds}
          tooltip="Number of builds:"
        />
      </div>
      {activeTab === 'heatmap' && (
        <div
          style={{
            backgroundColor: PF_BACK_100,
            float: 'right',
            clear: 'none',
            marginBottom: '-2em',
            padding: '0.2em 1em',
            width: '30em',
          }}
        >
          <ParamDropdown
            dropdownItems={['Yes', 'No']}
            defaultValue={countSkips ? 'Yes' : 'No'}
            handleSelect={(value) => setCountSkips(value === 'Yes')}
            tooltip="Count skips as failure:"
          />
        </div>
      )}
      {activeTab === 'overall-health' && (
        <div
          style={{
            backgroundColor: PF_BACK_100,
            float: 'right',
            clear: 'none',
            marginBottom: '-2em',
            padding: '0.5em 1em',
          }}
        >
          <Switch
            id="bar-chart-switch"
            label="Change to Bar Chart"
            isChecked={isAreaChart}
            onChange={(_, checked) => setIsAreaChart(checked)}
          />
        </div>
      )}
      <Tabs activeKey={activeTab} onSelect={onTabSelect} isBox>
        <Tab eventKey="heatmap" title="Heatmap">
          {!isLoading && activeTab === 'heatmap' && (
            <FilterHeatmapWidget
              params={heatmapParams}
              hideDropdown={true}
              type={HEATMAP_TYPES.jenkins}
            />
          )}
        </Tab>
        <Tab eventKey="overall-health" title="Overall Health">
          {!isLoading && !isAreaChart && activeTab === 'overall-health' && (
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
                top: 20,
              }}
              fontSize={9}
              sortOrder="ascending"
            />
          )}
          {!isLoading && isAreaChart && activeTab === 'overall-health' && (
            <GenericAreaWidget
              title={'Test counts for ' + barchartParams.job_name}
              params={barchartParams}
              hideDropdown={true}
              widgetEndpoint="jenkins-bar-chart"
              height={180}
              yLabel="Test counts"
              xLabel="Build number"
              sortOrder="ascending"
              showTooltip={false}
              padding={{
                bottom: 50,
                left: 50,
                right: 20,
                top: 20,
              }}
              fontSize={9}
            />
          )}
        </Tab>
        <Tab eventKey="build-durations" title="Build Duration">
          {!isLoading && activeTab === 'build-durations' && (
            <GenericAreaWidget
              title={'Durations for ' + linechartParams.job_name}
              params={linechartParams}
              hideDropdown={true}
              height={180}
              padding={{
                bottom: 50,
                left: 50,
                right: 20,
                top: 20,
              }}
              fontSize={9}
              showTooltip={true}
              sortOrder="ascending"
              xLabel="Build number"
              yLabel="Time [hrs]"
              varExplanation="* Note: since for some jobs, the plugin tests execute in parallel, 'Duration' is the real time for which the build ran. 'Total Execution Time' is the sum of durations for each plugin run."
            />
          )}
        </Tab>
      </Tabs>
    </React.Fragment>
  );
};

JenkinsJobAnalysisView.propTypes = {
  view: PropTypes.object,
  defaultTab: PropTypes.string,
};

export default JenkinsJobAnalysisView;
