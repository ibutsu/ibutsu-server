import React from 'react';
import PropTypes from 'prop-types';
import {
  DropdownDirection,
  Tab,
  Tabs,
} from '@patternfly/react-core';
import { Settings } from '../settings';
import {
  buildUrl,
  getActiveProject,
  parseFilter,
} from '../utilities';
import { JenkinsHeatmapWidget, GenericAreaWidget, GenericBarWidget } from '../widgets';
import { ParamDropdown } from '../components';
import { HEATMAP_MAX_BUILDS } from '../constants'


export class JenkinsJobAnalysisView extends React.Component {
  static propTypes = {
    location: PropTypes.object,
    history: PropTypes.object,
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
    this.getWidgetParams = this.getWidgetParams.bind(this);
    this.onBuildSelect = this.onBuildSelect.bind(this);
    this.state = {
      isEmpty: true,
      isError: false,
      filters: filters,
      activeTab: 'heatmap',
      barWidth: 8,
      builds: 20,
      heatmapParams: {},
      barchartParams: {},
      linechartParams: {},
    };
  }

  onTabSelect = (event, tabIndex) => {
    this.setState({
      activeTab: tabIndex
    });
  }

  getWidgetParams() {
    // Show a spinner
    this.setState({isLoading: true, isEmpty: false, isError: false});
    if (!this.props.view) {
      return;
    }
    let params = this.props.view.params;
    let project = getActiveProject();
    if (project) {
      params['project'] = project.id;
    }
    else {
      delete params['project'];
    }
    if (this.state.filters.job_name) {
      params['job_name'] = this.state.filters.job_name.val;
    }
    params['builds'] = this.state.builds;
    fetch(buildUrl(Settings.serverUrl + '/widget/' + this.props.view.widget, params))
      .then(response => response.json())
      .then(data => {
        this.setState({
          heatmapParams: data.heatmap_params,
          barchartParams: data.barchart_params,
          linechartParams: data.linechart_params,
          isLoading: false,
        });
      });
  }

  componentDidMount() {
    this.getWidgetParams();
  }

  onBuildSelect = (value) => {
    this.setState({builds: value}, () => {
      this.getWidgetParams();
      this.getBarWidth();
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

  getDropdown() {
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
        direction={DropdownDirection.down}
        handleSelect={this.onBuildSelect}
        tooltip={"Set builds to:"}
      />);
  }

  render() {
    const { isLoading, barchartParams, barWidth, heatmapParams, linechartParams } = this.state;

    return (
      <React.Fragment>
        <div style={{backgroundColor: 'white', float: 'right', clear: 'right', marginBottom: '-2em', padding: '0.2em 1em', width: '20em'}}>
          {this.getDropdown()}
        </div>
      <Tabs activeKey={this.state.activeTab} onSelect={this.onTabSelect}>
        <Tab eventKey='heatmap' title={'Heatmap'} style={{backgroundColor: 'white'}}>
          {!isLoading &&
          <JenkinsHeatmapWidget title={heatmapParams.job_name} params={heatmapParams} hideDropdown={true}/>
          }
        </Tab>
        <Tab eventKey='overall-health' title={'Overall Health'} style={{backgroundColor: 'white'}}>
          {!isLoading &&
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
        </Tab>
        <Tab eventKey='build-durations' title={'Build Duration'} style={{backgroundColor: 'white'}}>
          {!isLoading &&
          <GenericAreaWidget
            title={"Durations for " + barchartParams.job_name}
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
