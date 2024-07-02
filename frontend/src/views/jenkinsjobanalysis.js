import React from 'react';
import PropTypes from 'prop-types';
import {
  Switch,
  Tab,
  Tabs
} from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import {
  parseFilter,
} from '../utilities';
import { FilterHeatmapWidget, GenericAreaWidget, GenericBarWidget } from '../widgets';
import { ParamDropdown } from '../components';
import { HEATMAP_MAX_BUILDS } from '../constants'
import { IbutsuContext } from '../services/context';


export class JenkinsJobAnalysisView extends React.Component {
  static contextType = IbutsuContext;
  static propTypes = {
    location: PropTypes.object,
    navigate: PropTypes.func,
    view: PropTypes.object
  };

  constructor(props) {
    super(props);
    const params = new URLSearchParams(props.location.search);
    let filters = {};
    if (params.toString() !== '') {
      for(let pair of params) {
        const combo = parseFilter(pair[0]);
        filters[combo['key']] = {
          'op': combo['op'],
          'val': pair[1]
        };
      }
    }
    this.state = {
      isAreaChart: false,
      isEmpty: true,
      isError: false,
      isLoading: true,
      filters: filters,
      activeTab: this.getTabIndex('heatmap'),
      barWidth: 8,
      builds: 20,
      heatmapParams: {},
      barchartParams: {},
      linechartParams: {},
      countSkips: 'Yes'
    };
  }

  getTabIndex(defaultValue) {
    defaultValue = defaultValue || null;
    return this.props.location.hash !== '' ? this.props.location.hash.substring(1) : defaultValue;
  }

  getWidgetParams = () => {
    // Show a spinner
    this.setState({isLoading: true, isEmpty: false, isError: false});
    if (!this.props.view) {
      return;
    }
    let params = this.props.view.params;
    const { primaryObject } = this.context;
    if (primaryObject) {
      params['project'] = primaryObject.id;
    }
    else {
      delete params['project'];
    }
    if (this.state.filters.job_name) {
      params['job_name'] = this.state.filters.job_name.val;
    }
    params['builds'] = this.state.builds;
    HttpClient.get([Settings.serverUrl, 'widget', this.props.view.widget], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        data.heatmap_params['count_skips'] = (this.state.countSkips === 'Yes');
        this.setState({
          heatmapParams: data.heatmap_params,
          barchartParams: data.barchart_params,
          linechartParams: data.linechart_params,
          isLoading: false,
        });
      });
  }

  getBarWidth() {
    const numBars = this.state.builds;
    let barWidth = 8;
    if (numBars > HEATMAP_MAX_BUILDS) {
      if (numBars > 100) {
        barWidth = 2;
      }
      else {
        barWidth = 5;
      }
    }
    this.setState({barWidth})
  }

  getBuildsDropdown() {
    const { activeTab } = this.state;
    let dropdownItems = [10, 20, 30, 40]
    let defaultValue = this.state.builds;
    if (activeTab === 'overall-health' || activeTab === 'build-durations') {
      dropdownItems.push(70, 150);
    }
    if (activeTab === 'heatmap') {
      defaultValue = Math.min(defaultValue, HEATMAP_MAX_BUILDS);
    }
    return (<ParamDropdown
        dropdownItems={dropdownItems}
        defaultValue={defaultValue}
        handleSelect={this.onBuildSelect}
        tooltip={"Set builds to:"}
      />);
  }

  getSwitch() {
    const { isAreaChart } = this.state;
    return (
      <Switch
        id="bar-chart-switch"
        labelOff="Change to Area Chart"
        label="Change to Bar Chart"
        isChecked={isAreaChart}
        onChange={this.handleSwitch}
      />
    );
  }

  getColors = (key) => {
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
  }

  onTabSelect = (_event, tabIndex) => {
    const loc = this.props.location;
    this.props.navigate(`${loc.pathname}${loc.search}#${tabIndex}`)
    this.setState({activeTab: tabIndex});
  }

  onBuildSelect = (value) => {
    this.setState({builds: value}, () => {
      this.getWidgetParams();
      this.getBarWidth();
    });
  }

  onSkipSelect = (value) => {
    this.setState({countSkips: value}, () => {
      this.getWidgetParams();
    });
  }

  handleSwitch = (_event, isChecked) => {
    this.setState({isAreaChart: isChecked});
  }

  componentDidMount() {
    this.getWidgetParams();
    window.addEventListener('popstate', this.handlePopState);
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this.handlePopState);
  }

  handlePopState = () => {
    // Handle browser navigation buttons click
    const tabIndex = this.getTabIndex('summary');
    this.setState({activeTab: tabIndex}, () => {
      this.updateTab(tabIndex);
    });
  };

  render() {
    const {
      activeTab,
      isAreaChart,
      isLoading,
      barchartParams,
      barWidth,
      heatmapParams,
      linechartParams
    } = this.state;

    return (
      <React.Fragment>
        <div style={{backgroundColor: 'var(--pf-v5-global--BackgroundColor--100)', float: 'right', clear: 'right', marginBottom: '-2em', padding: '0.2em 1em', width: '20em'}}>
          {this.getBuildsDropdown()}
        </div>
        {activeTab === 'heatmap' &&
        <div style={{backgroundColor: 'var(--pf-v5-global--BackgroundColor--100)', float: 'right', clear: 'none', marginBottom: '-2em', padding: '0.2em 1em', width: '30em'}}>
          <ParamDropdown
            dropdownItems={['Yes', 'No']}
            defaultValue={this.state.countSkips}
            handleSelect={this.onSkipSelect}
            tooltip="Count skips as failure:"
          />
        </div>
        }
        {activeTab === 'overall-health' &&
        <div style={{backgroundColor: 'var(--pf-v5-global--BackgroundColor--100)', float: 'right', clear: 'none', marginBottom: '-2em', padding: '0.5em 1em'}}>
          {this.getSwitch()}
        </div>
        }
      <Tabs activeKey={this.state.activeTab} onSelect={this.onTabSelect} isBox>
        <Tab eventKey='heatmap' title={'Heatmap'}>
          {!isLoading && activeTab === "heatmap" &&
          <FilterHeatmapWidget title={heatmapParams.job_name} params={heatmapParams} hideDropdown={true} labelWidth={400} type='jenkins'/>
          }
        </Tab>
        <Tab eventKey='overall-health' title={'Overall Health'}>
          {!isLoading && !isAreaChart && activeTab === "overall-health" &&
          <GenericBarWidget
            title={"Test counts for " + barchartParams.job_name}
            params={barchartParams}
            hideDropdown={true}
            widgetEndpoint={'jenkins-bar-chart'}
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
          {!isLoading && isAreaChart && activeTab === "overall-health" &&
          <GenericAreaWidget
            title={"Test counts for " + barchartParams.job_name}
            params={barchartParams}
            hideDropdown={true}
            getColors={this.getColors}
            widgetEndpoint={'jenkins-bar-chart'}
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
        <Tab eventKey='build-durations' title={'Build Duration'}>
          {!isLoading && activeTab === 'build-durations' &&
          <GenericAreaWidget
            title={"Durations for " + linechartParams.job_name}
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
            varExplanation={
              "* Note: since for some jobs, the plugin tests execute in parallel, 'Duration' is the real time for which the build ran. 'Total Execution Time' is the sum of durations for each plugin run."
            }
          />
          }
        </Tab>
      </Tabs>
      </React.Fragment>
    );
  }
}
