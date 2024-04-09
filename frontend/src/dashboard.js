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
  TextContent,
  Text,
  EmptyStateHeader,
  EmptyStateFooter,
  MenuToggle,
  SelectList,
  SelectOption,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from '@patternfly/react-core';

import {
  ArchiveIcon,
  CubesIcon,
  PlusCircleIcon,
  TachometerAltIcon,
  TimesCircleIcon,
  TimesIcon
} from '@patternfly/react-icons';

import { HttpClient } from './services/http';
import { KNOWN_WIDGETS } from './constants';
import { Settings } from './settings';
import { DeleteModal, NewDashboardModal, NewWidgetWizard, EditWidgetModal } from './components';
import {
  GenericAreaWidget,
  GenericBarWidget,
  FilterHeatmapWidget,
  ImportanceComponentWidget,
  ResultAggregatorWidget,
  ResultSummaryWidget
} from './widgets';
import { getActiveProject, getActiveDashboard } from './utilities.js';


export class Dashboard extends React.Component {
  static propTypes = {
    eventEmitter: PropTypes.object
  }

  constructor(props) {
    super(props);
    let dashboard = getActiveDashboard() || this.getDefaultDashboard();
    this.state = {
      widgets: [],
      filteredDashboards: [],
      dashboards: [],
      selectedDashboard: dashboard,
      isDashboardSelectorOpen: false,
      isNewDashboardOpen: false,
      isWidgetWizardOpen: false,
      isEditModalOpen: false,
      editWidgetData: {},
      dashboardInputValue: dashboard?.title || '',
      filterValueDashboard: ''
    };
    props.eventEmitter.on('projectChange', () => {
      this.clearDashboards();
      this.getDashboards();
    });
  }

  getDefaultDashboard() {
    let project = getActiveProject();
    if (project && project.defaultDashboard) {
      console
      const dashboard = JSON.stringify(project.defaultDashboard)
      localStorage.setItem('dashboard', dashboard);
      return project.defaultDashboard;
    }
    else {
      return null;
    }
  }

  clearDashboards() {
    localStorage.removeItem('dashboard');
    this.setState({
      selectedDashboard: null,
      filteredDashboards: [],
      dashboardInputValue: '',
      filterValueDashboard: ''
    });
  }

  getDashboards() {
    let project = getActiveProject();
    if (!project) {
      this.setState({dashboardInputValue: ''})
      return;
    }
    let params = {
      'project_id': project.id,
      'pageSize': 10
    };

    if (this.state.filterValueDashboard) {
      params['filter'] = ['title%' + this.state.filterValueDashboard];
    }
    HttpClient.get([Settings.serverUrl, 'dashboard'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        this.setState({dashboards: data['dashboards'], filteredDashboards: data['dashboards']}, this.getWidgets);
      });
  }

  getWidgets() {
    let params = {'type': 'widget'};
    let dashboard = getActiveDashboard() || this.getDefaultDashboard();
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

  onDashboardToggle = () => {
    this.setState({isDashboardSelectorOpen: !this.state.isDashboardSelectorOpen});
  };

  onDashboardSelect = (_event, value) => {
    const dashboard = JSON.stringify(value);
    localStorage.setItem('dashboard', dashboard);
    this.setState({
      selectedDashboard: value,
      isDashboardSelectorOpen: false,
      filterValueDashboard: '',
      dashboardInputValue: value.title,
    }, this.getWidgets);
  };

  onDashboardClear = () => {
    localStorage.removeItem('dashboard');
    this.setState({
      selectedDashboard: null,
      dashboardInputValue: '',
      filterValueDashboard: ''
    }, this.getDashboards, this.getWidgets);
  }

  onTextInputChange = (_event, value) => {
    this.setState({
      dashboardInputValue: value,
      filterValueDashboard: value
    }, this.getDashboards);
  };

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
          selectedDashboard: data,
          dashboardInputValue: data.title,
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

  onEditWidgetSave = (editWidget) => {
    const project = getActiveProject();
    if (!editWidget.project_id && project) {
      editWidget.project_id = project.id;
    }
    this.setState({isEditModalOpen: false});
    editWidget.id = this.state.currentWidgetId
    HttpClient.put([Settings.serverUrl, 'widget-config', this.state.currentWidgetId], "", editWidget)
        .then(response => HttpClient.handleResponse(response))
        .then(() => {
          this.getWidgets();
        });
  }

  onEditWidgetClose = () => {
    this.setState({isEditModalOpen: false});
  }

  onEditWidgetClick = (id) => {
    HttpClient.get([Settings.serverUrl, 'widget-config', id])
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          this.setState({isEditModalOpen: true, currentWidgetId: id, editWidgetData: data});
        });

  }

  onEditWidgetClose = () => {
    this.setState({isEditModalOpen: false});
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

  componentDidUpdate(prevProps, prevState) {
    if (
      prevState.filterValueDashboard !== this.state.filterValueDashboard
    ) {
      let newSelectOptionsDashboard = this.state.dashboards;
      if (this.state.dashboardInputValue) {
        newSelectOptionsDashboard = this.state.dashboards.filter(menuItem =>
          String(menuItem.title).toLowerCase().includes(this.state.filterValueDashboard.toLowerCase())
        );

        if (!this.state.isDashboardSelectorOpen) {
          this.setState({ isDashboardSelectorOpen: true });
        }
      }

      this.setState({
        filteredDashboards: newSelectOptionsDashboard,
      });
    }
  }

  render() {
    document.title = 'Dashboard | Ibutsu';
    const { widgets } = this.state || this.getWidgets();
    const project = getActiveProject();
    const dashboard = getActiveDashboard() || this.getDefaultDashboard();

    const toggle = toggleRef => (
      <MenuToggle
        ref={toggleRef}
        variant="typeahead"
        aria-label="Typeahead menu toggle"
        onClick={this.onDashboardToggle}
        isExpanded={this.state.isDashboardSelectorOpen}
        isFullWidth
        isDisabled={!project}
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={this.state.dashboardInputValue}
            onClick={this.onDashboardToggle}
            onChange={this.onTextInputChange}
            id="typeahead-select-input"
            autoComplete="off"
            placeholder={dashboard ? dashboard.title : "No active dashboard"}
            role="combobox"
            isExpanded={this.state.isDashboardSelectorOpen}
            aria-controls="select-typeahead-listbox"
          />
          <TextInputGroupUtilities>
            {!!this.state.dashboardInputValue && (
              <Button
                variant="plain"
                onClick={() => {
                  this.onDashboardClear();
                }}
                aria-label="Clear input value"
              >
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    )

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
                  id="typeahead-select"
                  isOpen={this.state.isDashboardSelectorOpen}
                  selected={this.state.selectedDashboard}
                  onSelect={this.onDashboardSelect}
                  onOpenChange={() => {
                    this.setState({isDashboardSelectorOpen: false});
                  }}
                  toggle={toggle}
                >
                  <SelectList id="select-typeahead-listbox">
                    {(this.state.dashboards.length === 0 && !this.state.filterValueDashboard) && (
                      <SelectOption isDisabled={true}>
                        No dashboards found
                      </SelectOption>
                    )}
                    {(this.state.dashboards.length === 0 && !!this.state.filterValueDashboard) && (
                      <SelectOption isDisabled={true}>
                        {`No results found for "${this.state.filterValueDashboard}"`}
                      </SelectOption>
                    )}
                    {this.state.filteredDashboards.map((dash, index) => (
                      <SelectOption
                        key={dash.id || index}
                        onClick={() => this.setState({selectedDashboard: dash})}
                        value={dash}
                        {...dash}
                      >
                        {dash.title}
                      </SelectOption>
                    ))}
                  </SelectList>
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
                      <FilterHeatmapWidget
                        title={widget.title}
                        params={widget.params}
                        includeAnalysisLink={true}
                        type='jenkins'
                        onDeleteClick={() => this.onDeleteWidgetClick(widget.id)}
                        onEditClick={() => this.onEditWidgetClick(widget.id)}
                      />
                    }
                    {(widget.type === "widget" && widget.widget === "filter-heatmap") &&
                      <FilterHeatmapWidget
                        title={widget.title}
                        params={widget.params}
                        includeAnalysisLink={true}
                        onDeleteClick={() => this.onDeleteWidgetClick(widget.id)}
                        onEditClick={() => this.onEditWidgetClick(widget.id)}
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
                        onEditClick={() => this.onEditWidgetClick(widget.id)}
                      />
                    }
                    {(widget.type === "widget" && widget.widget === "result-summary") &&
                      <ResultSummaryWidget
                        title={widget.title}
                        params={widget.params}
                        onDeleteClick={() => this.onDeleteWidgetClick(widget.id)}
                        onEditClick={() => this.onEditWidgetClick(widget.id)}
                      />
                    }
                    {(widget.type === "widget" && widget.widget === "result-aggregator") &&
                      <ResultAggregatorWidget
                        title={widget.title}
                        params={widget.params}
                        onDeleteClick={() => this.onDeleteWidgetClick(widget.id)}
                        onEditClick={() => this.onEditWidgetClick(widget.id)}
                      />
                    }
                    {(widget.type === "widget" && widget.widget === "jenkins-line-chart") &&
                      <GenericAreaWidget
                        title={widget.title}
                        params={widget.params}
                        yLabel="Execution time"
                        widgetEndpoint="jenkins-line-chart"
                        onDeleteClick={() => this.onDeleteWidgetClick(widget.id)}
                        onEditClick={() => this.onEditWidgetClick(widget.id)}
                      />
                    }
                    {(widget.type === "widget" && widget.widget === "jenkins-bar-chart") &&
                      <GenericBarWidget
                        title={widget.title}
                        params={widget.params}
                        barWidth={20}
                        horizontal={true}
                        hideDropdown={true}
                        widgetEndpoint="jenkins-bar-chart"
                        onDeleteClick={() => this.onDeleteWidgetClick(widget.id)}
                        onEditClick={() => this.onEditWidgetClick(widget.id)}
                      />
                    }
                    {(widget.type === "widget" && widget.widget === "importance-component") &&
                      <ImportanceComponentWidget
                        title={widget.title}
                        params={widget.params}
                        barWidth={20}
                        horizontal={true}
                        hideDropdown={true}
                        widgetEndpoint="importance-component"
                        onDeleteClick={() => this.onDeleteWidgetClick(widget.id)}
                        onEditClick={() => this.onEditWidgetClick(widget.id)}
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
            <EmptyStateHeader titleText="No Project Selected" icon={<EmptyStateIcon icon={ArchiveIcon} />} headingLevel="h4" />
            <EmptyStateBody>
              There is currently no project selected. Please select a project from the dropdown in
              order to view the dashboard.
            </EmptyStateBody>
          </EmptyState>
          }
          {!!project && !dashboard &&
          <EmptyState>
            <EmptyStateHeader titleText="No Dashboard Selected" icon={<EmptyStateIcon icon={TachometerAltIcon} />} headingLevel="h4" />
            <EmptyStateBody>
              There is currently no dashboard selected. Please select a dashboard from the dropdown
              in order to view widgets, or create a new dashboard.
            </EmptyStateBody>
            <EmptyStateFooter>
              <Button variant="primary" onClick={this.onNewDashboardClick}>New Dashboard</Button>
            </EmptyStateFooter>
          </EmptyState>
          }
          {(!!project && !!dashboard && widgets.length === 0) &&
          <EmptyState>
            <EmptyStateHeader titleText="No Widgets" icon={<EmptyStateIcon icon={CubesIcon} />} headingLevel="h4" />
            <EmptyStateBody>
              This dashboard currently has no widgets defined.<br />Click on the &quot;Add Widget&quot; button
              below to add a widget to this dashboard.
            </EmptyStateBody>
            <EmptyStateFooter>
              <Button variant="primary" onClick={this.onAddWidgetClick}>Add Widget</Button>
            </EmptyStateFooter>
          </EmptyState>
          }
        </PageSection>
        <NewDashboardModal
          project={project}
          isOpen={this.state.isNewDashboardOpen}
          onSave={this.onNewDashboardSave}
          onClose={this.onNewDashboardClose}
        />
        <NewWidgetWizard
          dashboard={dashboard}
          isOpen={this.state.isWidgetWizardOpen}
          onSave={this.onNewWidgetSave}
          onClose={this.onNewWidgetClose}
        />
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
        {this.state.isEditModalOpen ?
          <EditWidgetModal
            isOpen={this.state.isEditModalOpen}
            onSave={this.onEditWidgetSave}
            onClose={this.onEditWidgetClose}
            data={this.state.editWidgetData}
          />
        : ''}
      </React.Fragment>
    );
  }
}
