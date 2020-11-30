import React from 'react';
import PropTypes from 'prop-types';

import {
  Flex,
  FlexItem,
  Grid,
  GridItem,
  PageSection,
  PageSectionVariants,
  Select,
  SelectOption,
  SelectVariant,
  TextContent,
  Text
} from '@patternfly/react-core';

import { KNOWN_WIDGETS } from './constants';
import { Settings } from './settings';
import {
  GenericBarWidget,
  JenkinsHeatmapWidget,
  ResultAggregatorWidget,
  ResultSummaryWidget
} from './widgets';
import { buildUrl, getActiveProject, getActiveDashboard } from './utilities.js';


function dashboardToSelect(dashboard) {
  if (!dashboard) {
    return '';
  }
  return {
    dashboard: dashboard,
    toString: function() {
      return this.dashboard.title;
    },
    compareTo: function (value) {
      return this.dashboard.title.toLowerCase().includes(value.dashboard.title.toLowerCase());
    }
  };
}


export class Dashboard extends React.Component {
  static propTypes = {
    eventEmitter: PropTypes.object
  }

  constructor(props) {
    super(props);
    let dashboard = getActiveDashboard();
    this.state = {
      widgets: [],
      dashboards: [],
      selectedDashboard: dashboardToSelect(dashboard),
      isDashboardSelectorOpen: false
    };
    props.eventEmitter.on('projectChange', () => {
      this.getDashboards();
    });
  }

  getDashboards() {
    let params = {};
    let project = getActiveProject();
    if (project) {
      params['project_id'] = project.id;
    }
    fetch(buildUrl(Settings.serverUrl + '/dashboard', params))
      .then(response => response.json())
      .then(data => {
        this.setState(
          {dashboards: data['dashboards']},
          () => {
            // If the current dashboard is not in current list
            if (this.state.selectedDashboard) {
              let selectedId = null;
              data['dashboards'].forEach(item => {
                if (item.id === this.state.selectedDashboard.dashboard.id) {
                  selectedId = item.id;
                }
              });
              if (!selectedId) {
                localStorage.removeItem('dashboard');
                this.setState({selectedDashboard: null}, this.getWidgets);
              }
            }
            else {
              this.getWidgets();
            }
          }
        );
      });
  }

  getWidgets() {
    let params = {"type": "widget"};
    let project = getActiveProject();
    let dashboard = getActiveDashboard();
    if (dashboard) {
      params['filter'] = 'dashboard_id=' + dashboard.id;
    }
    else if (project) {
      params['filter'] = 'project_id=' + project.id;
    }
    fetch(buildUrl(Settings.serverUrl + '/widget-config', params))
      .then(response => response.json())
      .then(data => {
        // set the widget project param
        data.widgets.forEach(widget => {
          if (project) {
            widget.params['project'] = project.id;
          }
          else if (this.state.selectedDashboard && this.state.selectedDashboard.dashboard.project_id) {
            widget.params['project'] = this.state.selectedDashboard.dashboard.project_id;
          }
          else {
            delete widget.params['project'];
          }
        });
        this.setState({widgets: data.widgets});
      });
  }

  onDashboardToggle = (isOpen) => {
    this.setState({isDashboardSelectorOpen: isOpen});
  };

  onDashboardSelect = (event, value, isPlaceholder) => {
    if (isPlaceholder) {
      this.onDashboardClear();
      return;
    }
    const dashboard = JSON.stringify(value.dashboard);
    localStorage.setItem('dashboard', dashboard);
    this.setState({
      selectedDashboard: value,
      isDashboardSelectorOpen: false
    }, this.getWidgets);
  };

  onDashboardClear = () => {
    localStorage.removeItem('dashboard');
    this.setState({
      selectedDashboard: null,
      isDashboardSelectorOpen: false
    }, this.getWidgets);
  }

  componentDidMount() {
    this.getDashboards();
    this.getWidgets();
  }

  render() {
    document.title = 'Dashboard | Ibutsu';
    const { widgets } = this.state;
    return (
      <React.Fragment>
        <PageSection variant={PageSectionVariants.light}>
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
            <FlexItem>
              <TextContent>
                <Text component="h1">Dashboard</Text>
              </TextContent>
            </FlexItem>
            <FlexItem id="dashboard-selector">
              <Select
                ariaLabelTypeAhead="Select a dashboard"
                placeholderText="No active dashboard"
                variant={SelectVariant.typeahead}
                isOpen={this.state.isDashboardSelectorOpen}
                selections={this.state.selectedDashboard}
                onToggle={this.onDashboardToggle}
                onSelect={this.onDashboardSelect}
                onClear={this.onDashboardClear}
              >
                {this.state.dashboards.map(dashboard => (
                  <SelectOption key={dashboard.id} value={dashboardToSelect(dashboard)} />
                ))}
              </Select>
            </FlexItem>
          </Flex>
        </PageSection>
        <PageSection>
          {!!widgets &&
          <Grid hasGutter>
            {widgets.map(widget => {
              if (KNOWN_WIDGETS.includes(widget.widget)) {
                return (
                  <GridItem xl={4} lg={6} md={12} key={widget.id}>
                    {(widget.type === "widget" && widget.widget === "jenkins-heatmap") &&
                      <JenkinsHeatmapWidget title={widget.title} params={widget.params} includeAnalysisLink={true}/>
                    }
                    {(widget.type === "widget" && widget.widget === "run-aggregator") &&
                      <GenericBarWidget title={widget.title} params={widget.params} horizontal={true} percentData={true} barWidth={20}/>
                    }
                    {(widget.type === "widget" && widget.widget === "result-summary") &&
                      <ResultSummaryWidget title={widget.title} params={widget.params}/>
                    }
                    {(widget.type === "widget" && widget.widget === "result-aggregator") &&
                      <ResultAggregatorWidget title={widget.title} params={widget.params}/>
                    }
                  </GridItem>
                );
              }
              else {
                return '';
              }
            })}
          </Grid>
          }
        </PageSection>
      </React.Fragment>
    );
  }
}
