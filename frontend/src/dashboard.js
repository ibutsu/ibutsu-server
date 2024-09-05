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
import { IbutsuContext } from './services/context.js';


export class Dashboard extends React.Component {
  static contextType = IbutsuContext;
  static propTypes = {
    eventEmitter: PropTypes.object,
    navigate: PropTypes.func,
    params: PropTypes.object,
  }

  constructor(props) {
    super(props);
    this.state = {
      widgets: [],
      filteredDashboards: [],
      dashboards: [],
      selectedDashboard: null,
      isDashboardSelectorOpen: false,
      isNewDashboardOpen: false,
      isWidgetWizardOpen: false,
      isEditModalOpen: false,
      editWidgetData: {},
      dashboardInputValue: '',
      filterValueDashboard: ''
    };
    props.eventEmitter.on('projectChange', (value) => {
      this.getDashboards(value);
      this.getDefaultDashboard(value);
    });
  }

  sync_context = () => {
    // Active dashboard
    const { activeDashboard } = this.context;
    const { selectedDashboard } = this.state;
    const paramDash = this.props.params?.dashboard_id;
    let updatedDash = undefined;
    // API call to update context
    if ( paramDash != null && activeDashboard?.id !== paramDash) {
      HttpClient.get([Settings.serverUrl, 'dashboard', paramDash])
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          const { setActiveDashboard } = this.context;
          setActiveDashboard(data);
          updatedDash = data;
          this.setState({
            selectedDashboard: data,
            isDashboardSelectorOpen: false,
            filterValueDashboard: '',
            dashboardInputValue: data.title,
          });  // callback within class component  won't have updated context
          // TODO don't pass value when converting to functional component
          this.getWidgets(data);
        })
        .catch(error => console.log(error));
    }

    if (updatedDash && !selectedDashboard ) {
      this.setState({
        selectedDashboard: updatedDash,
        dashboardInputValue: updatedDash.title
      })
    }
  }

  getDashboards = (handledOject = null) => {
    // value is checked because of handler scope not seeing context state updates
    // TODO: react-router loaders would be way better
    const { primaryObject } = this.context;
    const paramProject = this.props.params?.project_id;
    const primaryObjectId = handledOject?.id ?? primaryObject?.id ?? paramProject;

    if (!primaryObjectId) {
      this.setState({dashboardInputValue: ''})
      return;
    }
    let params = {
      'project_id': primaryObjectId,
      'pageSize': 10
    };

    if (this.state.filterValueDashboard) {
      params['filter'] = ['title%' + this.state.filterValueDashboard];
    }
    HttpClient.get([Settings.serverUrl, 'dashboard'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        this.setState({dashboards: data['dashboards'], filteredDashboards: data['dashboards']});
      })
      .catch(error => console.log(error));
  }

  getDefaultDashboard = (handledObject = null) => {
    const { primaryObject, activeDashboard, setActiveDashboard } = this.context;
    const paramProject = this.props.params?.project_id;

    let targetObject = handledObject ?? primaryObject ?? paramProject;

    if (typeof(targetObject) === 'string') {
      HttpClient.get([Settings.serverUrl, 'project', paramProject])
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          targetObject = data;
        })
        .catch(error => console.log(error));

    }

    if ( !activeDashboard && targetObject?.defaultDashboard ){
      setActiveDashboard(targetObject.defaultDashboard);
      this.setState({
        'selectedDashboard': targetObject.defaultDashboard,
        'dashboardInputValue': targetObject.defaultDashboard?.title
      })
    } else {
      this.setState({
        'selectedDashboard': 'Select a dashboard',
        'dashboardInputValue': 'Select a dashboard'
      })
    }
  }

  getWidgets = (dashboard) => {
    let params = {'type': 'widget'};
    const { activeDashboard } = this.context;
    // TODO don't pass value when converting to functional component
    let target_dash = null;
    if (dashboard === undefined) {
      target_dash = activeDashboard;
    } else {
      target_dash = dashboard;
    }
    if (!target_dash) {
      return;
    }
    params['filter'] = 'dashboard_id=' + target_dash.id;
    HttpClient.get([Settings.serverUrl, 'widget-config'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        // set the widget project param
        data.widgets.forEach(widget => {
          widget.params['project'] = target_dash.project_id;
        });
        this.setState({widgets: data.widgets});
      })
      .catch(error => console.log(error));
  }

  onDashboardToggle = () => {
    this.setState({isDashboardSelectorOpen: !this.state.isDashboardSelectorOpen});
  };

  onDashboardSelect = (_event, value) => {
    const { setActiveDashboard } = this.context;
    setActiveDashboard(value);
    this.setState({
      selectedDashboard: value,
      isDashboardSelectorOpen: false,
      filterValueDashboard: '',
      dashboardInputValue: value.title,
    });  // callback within class component  won't have updated context
    // TODO don't pass value when converting to functional component
    this.getWidgets(value);

    // does it really matter whether I read from params or the context here?
    // they should be the same, reading from params 'feels' better
    this.props.navigate('/project/' + this.props.params?.project_id + '/dashboard/' + value?.id)
  };

  onDashboardClear = () => {
    const { setActiveDashboard } = this.context;
    setActiveDashboard();
    this.setState({
      selectedDashboard: 'Select a dashboard',
      dashboardInputValue: 'Select a dashboard',
      filterValueDashboard: ''
    });
    // TODO convert to functional component and rely on context updating within callbacks
    this.getWidgets(null);

    this.props.navigate('/project/' + this.props.params?.project_id + '/dashboard/')
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
      })
      .catch(error => console.log(error));
  }

  onDeleteDashboardClick = () => {
    this.setState({isDeleteDashboardOpen: true});
  }

  onDeleteDashboardClose = () => {
    this.setState({isDeleteDashboardOpen: false});
  }

  onDeleteDashboard = () => {
    const { activeDashboard, setActiveDashboard } = this.context;

    HttpClient.delete([Settings.serverUrl, 'dashboard', activeDashboard.id])
        .then(response => HttpClient.handleResponse(response))
        .then(() => {
          setActiveDashboard();
          this.getDashboards();
          this.setState({
            isDeleteDashboardOpen: false,
            selectedDashboard: null
          });
        })
        .catch(error => console.log(error));
  }

  onDeleteWidget = () => {
    HttpClient.delete([Settings.serverUrl, 'widget-config', this.state.currentWidgetId])
        .then(response => HttpClient.handleResponse(response))
        .then(() => {
          this.getWidgets();
          this.setState({isDeleteWidgetOpen: false});
        })
        .catch(error => console.log(error));
  }

  onEditWidgetSave = (editWidget) => {
    const { primaryObject } = this.context;
    if (!editWidget.project_id && primaryObject) {
      editWidget.project_id = primaryObject.id;
    }
    this.setState({isEditModalOpen: false});
    editWidget.id = this.state.currentWidgetId
    HttpClient.put([Settings.serverUrl, 'widget-config', this.state.currentWidgetId], "", editWidget)
        .then(response => HttpClient.handleResponse(response))
        .then(() => {
          this.getWidgets();
        })
        .catch(error => console.log(error));
  }

  onEditWidgetClose = () => {
    this.setState({isEditModalOpen: false});
  }

  onEditWidgetClick = (id) => {
    HttpClient.get([Settings.serverUrl, 'widget-config', id])
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          this.setState({isEditModalOpen: true, currentWidgetId: id, editWidgetData: data});
        })
        .catch(error => console.log(error));

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
    const { primaryObject } = this.context;
    if (!newWidget.project_id && primaryObject) {
      newWidget.project_id = primaryObject.id;
    }
    HttpClient.post([Settings.serverUrl, 'widget-config'], newWidget)
      .then(() => { this.getWidgets() })
      .catch(error => console.log(error));
    this.setState({isWidgetWizardOpen: false});
  }

  componentDidMount() {
    this.sync_context();
    this.getDashboards();
    this.getDefaultDashboard();
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
    const { widgets } = this.state;
    const { primaryObject, activeDashboard } = this.context;

    const toggle = toggleRef => (
      <MenuToggle
        ref={toggleRef}
        variant="typeahead"
        aria-label="Typeahead menu toggle"
        onClick={this.onDashboardToggle}
        isExpanded={this.state.isDashboardSelectorOpen}
        isFullWidth
        isDisabled={!primaryObject}
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={this.state.dashboardInputValue}
            onClick={this.onDashboardToggle}
            onChange={this.onTextInputChange}
            id="typeahead-select-input"
            autoComplete="off"
            placeholder={activeDashboard?.title || "No active dashboard"}
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
                  isDisabled={!activeDashboard}
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
                  isDisabled={!activeDashboard}
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
          {!!primaryObject && !!activeDashboard && !!widgets &&
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
          {!!primaryObject && !activeDashboard &&
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
          {(!!primaryObject && !!activeDashboard && widgets.length === 0) &&
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
          project={primaryObject}
          isOpen={this.state.isNewDashboardOpen}
          onSave={this.onNewDashboardSave}
          onClose={this.onNewDashboardClose}
        />
        <NewWidgetWizard
          dashboard={activeDashboard}
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
