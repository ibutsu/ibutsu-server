import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  EmptyState,
  EmptyStateIcon,
  EmptyStateBody,
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
  Text,
  Title,
} from '@patternfly/react-core';
import { ArchiveIcon, CubesIcon, PlusCircleIcon, TachometerAltIcon, TimesCircleIcon } from '@patternfly/react-icons';

import { HttpClient } from './services/http';
import { KNOWN_WIDGETS } from './constants';
import { Settings } from './settings';
import { DeleteModal, NewDashboardModal, NewWidgetWizard } from './components';
import {
  GenericBarWidget,
  JenkinsHeatmapWidget,
  ResultAggregatorWidget,
  ResultSummaryWidget
} from './widgets';
import { getActiveProject, getActiveDashboard } from './utilities.js';


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
      isDashboardSelectorOpen: false,
      isNewDashboardOpen: false,
      isWidgetWizardOpen: false,
    };
    props.eventEmitter.on('projectChange', () => {
      this.getDashboards();
    });
  }

  getDashboards() {
    let params = {};
    let project = getActiveProject();
    if (!project) {
      localStorage.removeItem('dashboard');
      this.setState({
        dashboards: [],
        selectedDashboard: null
      });
      return;
    }
    params['project_id'] = project.id;
    HttpClient.get([Settings.serverUrl, 'dashboard'], params)
      .then(response => HttpClient.handleResponse(response))
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
    let params = {'type': 'widget'};
    let dashboard = getActiveDashboard();
    if (!dashboard) {
      return;
    }
    params['filter'] = 'dashboard_id=' + dashboard.id;
    HttpClient.get([Settings.serverUrl, 'widget-config'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        // set the widget project param
        data.widgets.forEach(widget => {
          widget.params['project'] = dashboard.project_id;
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

  onNewDashboardClick = () => {
    this.setState({isNewDashboardOpen: true});
  }

  onNewDashboardClose = () => {
    this.setState({isNewDashboardOpen: false});
  }

  onNewDashboardSave = (newDashboard) => {
    HttpClient.post([Settings.serverUrl, 'dashboard'], newDashboard)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        localStorage.setItem('dashboard', JSON.stringify(data));
        this.getDashboards();
        this.setState({
          isNewDashboardOpen: false,
          selectedDashboard: dashboardToSelect(data)
        }, this.getWidgets);
      });
  }

  onDeleteDashboardClick = () => {
    this.setState({isDeleteDashboardOpen: true});
  }

  onDeleteDashboardClose = () => {
    this.setState({isDeleteDashboardOpen: false});
  }

  onDeleteDashboard = () => {
    const dashboard = getActiveDashboard();

    HttpClient.delete([Settings.serverUrl, 'dashboard', dashboard.id])
        .then(response => HttpClient.handleResponse(response))
        .then(() => {
          localStorage.removeItem('dashboard');
          this.getDashboards();
          this.setState({
            isDeleteDashboardOpen: false,
            selectedDashboard: null
          });
        });
  }

  onDeleteWidget = () => {
    HttpClient.delete([Settings.serverUrl, 'widget-config', this.state.currentWidgetId])
        .then(response => HttpClient.handleResponse(response))
        .then(() => {
          this.getWidgets();
          this.setState({isDeleteWidgetOpen: false});
        });
  }

  onDeleteWidgetClick = (id) => {
    this.setState({isDeleteWidgetOpen: true, currentWidgetId: id});
  }

  onDeleteWidgetClose = () => {
    this.setState({isDeleteWidgetOpen: false});
  }

  onAddWidgetClick = () => {
    this.setState({isWidgetWizardOpen: true});
  }

  onNewWidgetClose = () => {
    this.setState({isWidgetWizardOpen: false});
  }

  onNewWidgetSave = (newWidget) => {
    const project = getActiveProject();
    if (!newWidget.project_id && project) {
      newWidget.project_id = project.id;
    }
    HttpClient.post([Settings.serverUrl, 'widget-config'], newWidget).then(() => { this.getWidgets() });
    this.setState({isWidgetWizardOpen: false});
  }

  componentDidMount() {
    this.getDashboards();
    this.getWidgets();
  }

  render() {
    document.title = 'Dashboard | Ibutsu';
    const { widgets } = this.state;
    const project = getActiveProject();
    const dashboard = getActiveDashboard();
    return (
      <React.Fragment>
        <PageSection variant={PageSectionVariants.light}>
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
            <Flex>
              <FlexItem spacer={{ default: 'spacerLg' }}>
                <TextContent>
                  <Text component="h1">Dashboard</Text>
                </TextContent>
              </FlexItem>
              <FlexItem id="dashboard-selector" spacer={{ default: 'spacerNone' }}>
                <Select
                  ariaLabelTypeAhead="Select a dashboard"
                  placeholderText="No active dashboard"
                  variant={SelectVariant.typeahead}
                  isOpen={this.state.isDashboardSelectorOpen}
                  isDisabled={!project}
                  selections={this.state.selectedDashboard}
                  onToggle={this.onDashboardToggle}
                  onSelect={this.onDashboardSelect}
                  onClear={this.onDashboardClear}
                  isPlain
                >
                  {this.state.dashboards.map(dashboard => (
                    <SelectOption key={dashboard.id} value={dashboardToSelect(dashboard)} />
                  ))}
                </Select>
              </FlexItem>
              <FlexItem spacer={{ default: 'spacerNone' }}>
                <Button
                  aria-label="New dashboard"
                  variant="plain"
                  title="New dashboard"
                  isDisabled={!project}
                  onClick={this.onNewDashboardClick}
                >
                  <PlusCircleIcon />
                </Button>
              </FlexItem>
              <FlexItem>
                <Button
                  aria-label="Delete dashboard"
                  variant="plain"
                  title="Delete dashboard"
                  isDisabled={!dashboard}
                  onClick={this.onDeleteDashboardClick}
                >
                  <TimesCircleIcon />
                </Button>
              </FlexItem>
            </Flex>
            <Flex>
              <FlexItem>
                <Button
                  aria-label="Add widget"
                  variant="secondary"
                  title="Add widget"
                  isDisabled={!this.state.selectedDashboard}
                  onClick={this.onAddWidgetClick}
                >
                  <PlusCircleIcon /> Add Widget
                </Button>
              </FlexItem>
            </Flex>
          </Flex>
        </PageSection>
        <PageSection>
          {!!project && !!dashboard && !!widgets &&
          <Grid hasGutter>
            {widgets.map(widget => {
              if (KNOWN_WIDGETS.includes(widget.widget)) {
                return (
                  <GridItem xl={4} lg={6} md={12} key={widget.id}>
                    {(widget.type === "widget" && widget.widget === "jenkins-heatmap") &&
                      <JenkinsHeatmapWidget
                        title={widget.title}
                        params={widget.params}
                        includeAnalysisLink={true}
                        onDeleteClick={() => this.onDeleteWidgetClick(widget.id)}
                      />
                    }
                    {(widget.type === "widget" && widget.widget === "run-aggregator") &&
                      <GenericBarWidget
                        title={widget.title}
                        params={widget.params}
                        horizontal={true}
                        percentData={true}
                        barWidth={20}
                        onDeleteClick={() => this.onDeleteWidgetClick(widget.id)}
                      />
                    }
                    {(widget.type === "widget" && widget.widget === "result-summary") &&
                      <ResultSummaryWidget
                        title={widget.title}
                        params={widget.params}
                        onDeleteClick={() => this.onDeleteWidgetClick(widget.id)}
                      />
                    }
                    {(widget.type === "widget" && widget.widget === "result-aggregator") &&
                      <ResultAggregatorWidget
                        title={widget.title}
                        params={widget.params}
                        onDeleteClick={() => this.onDeleteWidgetClick(widget.id)}
                      />
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
          {!project &&
          <EmptyState>
            <EmptyStateIcon icon={ArchiveIcon} />
            <Title headingLevel="h4" size="lg">
              No Project Selected
            </Title>
            <EmptyStateBody>
              There is currently no project selected. Please select a project from the dropdown in
              order to view the dashboard.
            </EmptyStateBody>
          </EmptyState>
          }
          {!!project && !dashboard &&
          <EmptyState>
            <EmptyStateIcon icon={TachometerAltIcon} />
            <Title headingLevel="h4" size="lg">
              No Dashboard Selected
            </Title>
            <EmptyStateBody>
              There is currently no dashboard selected. Please select a dashboard from the dropdown
              in order to view widgets, or create a new dashboard.
            </EmptyStateBody>
            <Button variant="primary" onClick={this.onNewDashboardClick}>New Dashboard</Button>
          </EmptyState>
          }
          {(!!project && !!dashboard && widgets.length === 0) &&
          <EmptyState>
            <EmptyStateIcon icon={CubesIcon} />
            <Title headingLevel="h4" size="lg">
              No Widgets
            </Title>
            <EmptyStateBody>
              This dashboard currently has no widgets defined.<br />Click on the &quot;Add Widget&quot; button
              below to add a widget to this dashboard.
            </EmptyStateBody>
            <Button variant="primary" onClick={this.onAddWidgetClick}>Add Widget</Button>
          </EmptyState>
          }
        </PageSection>
        <NewDashboardModal project={project} isOpen={this.state.isNewDashboardOpen} onSave={this.onNewDashboardSave} onClose={this.onNewDashboardClose} />
        <NewWidgetWizard dashboard={dashboard} isOpen={this.state.isWidgetWizardOpen} onSave={this.onNewWidgetSave} onClose={this.onNewWidgetClose} />
        <DeleteModal
          title="Delete dashboard"
          body={<>Would you like to delete the current dashboard? <strong>ALL WIDGETS</strong> on the dashboard will also be deleted.</>}
          isOpen={this.state.isDeleteDashboardOpen}
          onDelete={this.onDeleteDashboard}
          onClose={this.onDeleteDashboardClose}
        />
        <DeleteModal
          title="Delete widget"
          body="Would you like to delete the selected widget?"
          isOpen={this.state.isDeleteWidgetOpen}
          onDelete={this.onDeleteWidget}
          onClose={this.onDeleteWidgetClose}
        />
      </React.Fragment>
    );
  }
}
