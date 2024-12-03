/* eslint-disable no-unused-vars */
import React, { useContext, useEffect, useState } from 'react';
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
import { useNavigate, useParams } from 'react-router-dom';


function Dashboard() {
  const context = useContext(IbutsuContext);
  const params = useParams();

  const navigate = useNavigate();

  // dashboard states
  const [dashboards, setDashboards] = useState([]);
  const [filteredDBs, setFilteredDBs] = useState([]);
  const [selectedDB, setSelectedDB] = useState();
  const [isDBSelectorOpen, setIsDBSelectorOpen] = useState(false);
  const [isNewDBOpen, setIsNewDBOpen] = useState(false);
  const [isDeleteDBOpen, setIsDeleteDBOpen] = useState(false);

  // widget states
  const [widgets, setWidgets] = useState([]);
  const [isNewWidgetOpen, setIsNewWidgetOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editWidgetData, setEditWidgetData] = useState({});
  const [isDeleteWidgetOpen, setIsDeleteWidgetOpen] = useState(false);
  const [currentWidget, setCurrentWidget] = useState();

  // typeahead input value states
  const [selectDBInputValue, setSelectDBInputValue] = useState('');
  const [filterDBValue, setFilterDBValue] = useState('');

  useEffect(() => {
    // TODO is sync necessary with functional component...?
    //sync_context();

    getDashboards(); // dependent: filterDBValue
    getDefaultDashboard();  // TODO: only changes on project selection, not needed on setup?

    getWidgets(); // dependent: selectedDB

  }, [selectedDB, filterDBValue]);

  function getDashboards() {
    // TODO: react-router loaders would be way better
    const { primaryObject } = context;
    const paramProject = params?.project_id;
    const primaryObjectId = primaryObject?.id ?? paramProject;

    if (!primaryObjectId) {
      setSelectDBInputValue('')
      return;
    }
    let api_params = {
      'project_id': primaryObjectId,
      'pageSize': 10
    };

    if (filterDBValue) {
      api_params['filter'] = ['title%' + filterDBValue];
    }
    HttpClient.get([Settings.serverUrl, 'dashboard'], api_params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        setDashboards(data['dashboards']);
        setFilteredDBs(data['dashboards']);
      })
      .catch(error => console.log(error));
  }

  function getDefaultDashboard() {
    const { primaryObject, activeDashboard, setActiveDashboard } = context;
    const paramProject = params?.project_id;

    let targetObject = primaryObject ?? paramProject;

    if (typeof(targetObject) === 'string') {
      HttpClient.get([Settings.serverUrl, 'project', paramProject])
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          targetObject = data;
        })
        .catch(error => console.log(error));

    }

    // Maybe change this behavior for last-visted preference on dashboard page
    if ( !activeDashboard && targetObject?.defaultDashboard ){
      setActiveDashboard(targetObject.defaultDashboard);
      setSelectedDB(targetObject.defaultDashboard);
      setSelectDBInputValue(targetObject.defaultDashboard?.title);
      }
  }

  function getWidgets() {
    let api_params = {'type': 'widget'};
    const { activeDashboard } = context;
    if (!activeDashboard) {
      return;
    }
    api_params['filter'] = 'dashboard_id=' + activeDashboard.id;
    HttpClient.get([Settings.serverUrl, 'widget-config'], api_params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        // set the widget project param
        data.widgets.forEach(widget => {
          widget.params['project'] = activeDashboard.project_id;
        });
        setWidgets(data.widgets);
      })
      .catch(error => console.log(error));
  }

  function onDashboardToggle() {
    setIsDBSelectorOpen({isDBSelectorOpen: !isDBSelectorOpen});
  }

  function onDashboardSelect(_event, value) {
    // context update
    const { setActiveDashboard } = context;
    setActiveDashboard(value);

    // state update
    setSelectedDB(value);
    setIsDBSelectorOpen(false);
    setFilterDBValue('');
    setSelectDBInputValue(value.title);

    navigate('/project/' + params?.project_id + '/dashboard/' + value?.id)
  }

  function onDashboardClear() {
    // context update
    const { setActiveDashboard } = context;
    setActiveDashboard();

    // state update
    setSelectedDB(null);
    setIsDBSelectorOpen(false);
    setSelectDBInputValue('Select a dashboard');
    setFilterDBValue('');

    navigate('/project/' + params?.project_id + '/dashboard/')
  }

  function handleDBFilterInput(e) {
    setSelectDBInputValue(e.target.value);
    setFilterDBValue(e.target.value);
  }

  // TODO dump directly into return
  function onNewDashboardClick() {
    setIsNewDBOpen(true);
  }

  // TODO dump directly into return
  function onNewDashboardClose() {
    this.setState(false);
  }

  function onNewDashboardSave(newDashboard) {
    HttpClient.post([Settings.serverUrl, 'dashboard'], newDashboard)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        localStorage.setItem('dashboard', JSON.stringify(data));
        getDashboards();
        setIsNewDBOpen(false);
        setSelectedDB(data);
        setSelectDBInputValue(data);
      })
      .catch(error => console.log(error));
  }

  // TODO dump directly into return
  function onDeleteDashboardClick() {
    setIsDeleteDBOpen(true);
  }

  // TODO dump directly into return
  function onDeleteDashboardClose() {
    setIsDeleteDBOpen(false);
  }

  function onDeleteDashboard() {
    const { activeDashboard, setActiveDashboard } = context;

    HttpClient.delete([Settings.serverUrl, 'dashboard', activeDashboard.id])
        .then(response => HttpClient.handleResponse(response))
        .then(() => {
          setActiveDashboard();
          getDashboards();
          setIsDeleteDBOpen(false);
          setSelectedDB(null);
        })
        .catch(error => console.log(error));
  }

  function onDeleteWidgetClick(id) {
    setIsDeleteWidgetOpen(true);
    setCurrentWidget(id)
  }

  function onDeleteWidget() {
    HttpClient.delete([Settings.serverUrl, 'widget-config', currentWidget])
        .then(response => HttpClient.handleResponse(response))
        .then(() => {
          this.getWidgets();
          setIsDeleteWidgetOpen(false);
        })
        .catch(error => console.log(error));
  }

  // TODO dump directly into return
  function onDeleteWidgetClose() {
    setIsDeleteWidgetOpen(false);
  }
  // TODO dump directly into return
  function onNewWidgetClick() {
    setIsNewWidgetOpen(true);
  }
  // TODO dump directly into return
  function onNewWidgetClose() {
    setIsNewWidgetOpen(false);
  }

  function onNewWidgetSave(newWidget) {
    const { primaryObject } = context;
    if (!newWidget.project_id && primaryObject) {
      newWidget.project_id = primaryObject.id;
    }
    HttpClient.post([Settings.serverUrl, 'widget-config'], newWidget)
      .then(() => { getWidgets() })
      .catch(error => console.log(error));
      setIsNewWidgetOpen(false);
  }

  function onEditWidgetSave(widget_data) {
    const { primaryObject } = context;
    if (!widget_data.project_id && primaryObject) {
      widget_data.project_id = primaryObject.id;
    }
    setIsEditModalOpen({isEditModalOpen: false});
    widget_data.id = this.currentWidgetId
    HttpClient.put([Settings.serverUrl, 'widget-config', currentWidget], "", widget_data)
        .then(response => HttpClient.handleResponse(response))
        .then(() => {getWidgets()})
        .catch(error => console.log(error));
  }

  function onEditWidgetClose() {
    setIsEditModalOpen(false);
  }

  function onEditWidgetClick(id) {
    HttpClient.get([Settings.serverUrl, 'widget-config', id])
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          setIsEditModalOpen(true);
          setCurrentWidget(id);
          setEditWidgetData(data);
        })
        .catch(error => console.log(error));

  }

  function handleFilter() {
    // previously componentDidUpdate in class component
    let newSelectOptionsDashboard = dashboards;
    if (filterDBValue) {
      newSelectOptionsDashboard = dashboards.filter(menuItem =>
        String(menuItem.title).toLowerCase().includes(filterDBValue.toLowerCase())
      );

      if (!isDBSelectorOpen) {
        setIsDBSelectorOpen(true);
      }
    }

    setFilteredDBs(newSelectOptionsDashboard);
  }

  document.title = 'Dashboard | Ibutsu';


  const { primaryObject, activeDashboard } = context;

  const toggle = toggleRef => (
    <MenuToggle
      ref={toggleRef}
      variant="typeahead"
      aria-label="Typeahead menu toggle"
      onClick={onDashboardToggle}
      isExpanded={isDBSelectorOpen}
      isFullWidth
      isDisabled={!primaryObject}  // wait how do I correctly access the context here
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={selectDBInputValue}
          onClick={onDashboardToggle}
          onChange={handleDBFilterInput}
          id="typeahead-select-input"
          autoComplete="off"
          placeholder={activeDashboard?.title || "No active dashboard"}
          role="combobox"
          isExpanded={isDBSelectorOpen}
          aria-controls="select-typeahead-listbox"
        />
        <TextInputGroupUtilities>
          {!!selectDBInputValue && (
            <Button
              variant="plain"
              onClick={onDashboardClear}
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
                isOpen={isDBSelectorOpen}
                selected={selectedDB}
                onSelect={onDashboardSelect}
                onOpenChange={() => {
                  setIsDBSelectorOpen(false);
                }}
                toggle={
                  toggle
                }
              >
                <SelectList id="select-typeahead-listbox">
                  {(dashboards.length === 0 && !filterDBValue) && (
                    <SelectOption isDisabled={true}>
                      No dashboards found
                    </SelectOption>
                  )}
                  {(dashboards.length === 0 && !!filterDBValue) && (
                    <SelectOption isDisabled={true}>
                      {`No results found for "${filterDBValue}"`}
                    </SelectOption>
                  )}
                  {filteredDBs?.map((dash, index) => (
                    <SelectOption
                      key={dash.id || index}
                      onClick={() => setSelectedDB(dash)}
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
                onClick={onNewDashboardClick}
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
                onClick={onDeleteDashboardClick}
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
                isDisabled={!selectedDB}
                onClick={onNewWidgetClick}
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
          {widgets?.map(widget => {
            if (KNOWN_WIDGETS.includes(widget.widget)) {
              return (
                <GridItem xl={4} lg={6} md={12} key={widget.id}>
                  {(widget.type === "widget" && widget.widget === "jenkins-heatmap") &&
                    <FilterHeatmapWidget
                      title={widget.title}
                      params={widget.params}
                      includeAnalysisLink={true}
                      type='jenkins'
                      onDeleteClick={() => onDeleteWidgetClick(widget.id)}
                      onEditClick={() => onEditWidgetClick(widget.id)}
                    />
                  }
                  {(widget.type === "widget" && widget.widget === "filter-heatmap") &&
                    <FilterHeatmapWidget
                      title={widget.title}
                      params={widget.params}
                      includeAnalysisLink={true}
                      onDeleteClick={() => onDeleteWidgetClick(widget.id)}
                      onEditClick={() => onEditWidgetClick(widget.id)}
                    />
                  }
                  {(widget.type === "widget" && widget.widget === "run-aggregator") &&
                    <GenericBarWidget
                      title={widget.title}
                      params={widget.params}
                      horizontal={true}
                      percentData={true}
                      barWidth={20}
                      onDeleteClick={() => onDeleteWidgetClick(widget.id)}
                      onEditClick={() => onEditWidgetClick(widget.id)}
                    />
                  }
                  {(widget.type === "widget" && widget.widget === "result-summary") &&
                    <ResultSummaryWidget
                      title={widget.title}
                      params={widget.params}
                      onDeleteClick={() => onDeleteWidgetClick(widget.id)}
                      onEditClick={() => onEditWidgetClick(widget.id)}
                    />
                  }
                  {(widget.type === "widget" && widget.widget === "result-aggregator") &&
                    <ResultAggregatorWidget
                      title={widget.title}
                      params={widget.params}
                      onDeleteClick={() => onDeleteWidgetClick(widget.id)}
                      onEditClick={() => onEditWidgetClick(widget.id)}
                    />
                  }
                  {(widget.type === "widget" && widget.widget === "jenkins-line-chart") &&
                    <GenericAreaWidget
                      title={widget.title}
                      params={widget.params}
                      yLabel="Execution time"
                      widgetEndpoint="jenkins-line-chart"
                      onDeleteClick={() => onDeleteWidgetClick(widget.id)}
                      onEditClick={() => onEditWidgetClick(widget.id)}
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
                      onDeleteClick={() => onDeleteWidgetClick(widget.id)}
                      onEditClick={() => onEditWidgetClick(widget.id)}
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
                      onDeleteClick={() => onDeleteWidgetClick(widget.id)}
                      onEditClick={() => onEditWidgetClick(widget.id)}
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
            <Button variant="primary" onClick={onNewDashboardClick}>New Dashboard</Button>
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
            <Button variant="primary" onClick={onNewWidgetClick}>Add Widget</Button>
          </EmptyStateFooter>
        </EmptyState>
        }
      </PageSection>
      <NewDashboardModal
        project={primaryObject}
        isOpen={isNewDBOpen}
        onSave={onNewDashboardSave}
        onClose={onNewDashboardClose}
      />
      <NewWidgetWizard
        dashboard={activeDashboard}
        isOpen={isNewWidgetOpen}
        onSave={onNewWidgetSave}
        onClose={onNewWidgetClose}
      />
      <DeleteModal
        title="Delete dashboard"
        body={<>Would you like to delete the current dashboard? <strong>ALL WIDGETS</strong> on the dashboard will also be deleted.</>}
        isOpen={isDeleteDBOpen}
        onDelete={onDeleteDashboard}
        onClose={onDeleteDashboardClose}
      />
      <DeleteModal
        title="Delete widget"
        body="Would you like to delete the selected widget?"
        isOpen={isDeleteWidgetOpen}
        onDelete={onDeleteWidget}
        onClose={onDeleteWidgetClose}
      />
      {isEditModalOpen ?
        <EditWidgetModal
          isOpen={isEditModalOpen}
          onSave={onEditWidgetSave}
          onClose={onEditWidgetClose}
          data={editWidgetData}
        />
      : ''}
    </React.Fragment>
  );
}

Dashboard.propTypes = {
};

export default Dashboard;


    // TODO replaced by context forcing render on project selection changing?
    // props.eventEmitter.on('projectChange', (value) => {
    //   this.getDashboards(value);
    //   this.getDefaultDashboard(value);
    // });



// TODO what actually needs synced now...
  // sync_context = () => {
  //   // Active dashboard
  //   const { activeDashboard, setActiveDashboard } = this.context;
  //   const { selectedDashboard } = this.state;
  //   const paramDash = this.props.params?.dashboard_id;
  //   if (!paramDash) {
  //     // No dashboard in the URL, clear context
  //     setActiveDashboard();
  //   }
  //   let updatedDash = undefined;
  //   // API call to update context
  //   if ( paramDash != null && activeDashboard?.id !== paramDash) {
  //     HttpClient.get([Settings.serverUrl, 'dashboard', paramDash])
  //       .then(response => HttpClient.handleResponse(response))
  //       .then(data => {
  //         const { setActiveDashboard } = this.context;
  //         setActiveDashboard(data);
  //         updatedDash = data;
  //         this.setState({
  //           selectedDashboard: data,
  //           isDashboardSelectorOpen: false,
  //           filterValueDashboard: '',
  //           dashboardInputValue: data.title,
  //         });  // callback within class component  won't have updated context
  //         // TODO don't pass value when converting to functional component
  //         this.getWidgets(data);
  //       })
  //       .catch(error => console.log(error));
  //   }

  //   if (updatedDash && !selectedDashboard ) {
  //     this.setState({
  //       selectedDashboard: updatedDash,
  //       dashboardInputValue: updatedDash.title
  //     })
  //   }
  // }
