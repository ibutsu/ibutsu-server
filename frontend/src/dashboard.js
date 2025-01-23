import React, {useContext, useEffect, useState } from 'react';
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

import CubesIcon from '@patternfly/react-icons/dist/esm/icons/cubes-icon';
import PlusCircleIcon from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import TachometerAltIcon from '@patternfly/react-icons/dist/esm/icons/tachometer-alt-icon';
import TimesIcon from '@patternfly/react-icons/dist/esm/icons/times-icon';
import TimesCircleIcon from '@patternfly/react-icons/dist/esm/icons/times-circle-icon';

import { HttpClient } from './services/http';
import { KNOWN_WIDGETS } from './constants';
import { Settings } from './settings';
import { NewDashboardModal, NewWidgetWizard, EditWidgetModal } from './components';
import DeleteModal from './components/delete-modal.js';
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
  const {defaultDashboard, primaryObject } = useContext(IbutsuContext);
  const { dashboard_id, project_id } = useParams();

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
    // update widgets
    let api_params = {'type': 'widget'};
    if (selectedDB) {
      api_params['filter'] = 'dashboard_id=' + selectedDB.id;
      HttpClient.get([Settings.serverUrl, 'widget-config'], api_params)
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          // set the widget project param
          data.widgets.forEach(widget => {
            widget.params['project'] = selectedDB.project_id;
          });
          setWidgets(data.widgets);
        })
        .catch(error => console.error(error));
    }
  }, [selectedDB, isDeleteWidgetOpen, isEditModalOpen, isNewWidgetOpen]);

  useEffect(() => {
    // update dashboards when the filter input changes
    if (primaryObject) {
      let api_params = {
        'project_id': primaryObject?.id,
        'pageSize': 10
      };

      if (filterDBValue) {
        // api filter handles case, contains, and is a loose search on title
        api_params['filter'] = ['title%' + filterDBValue];
      }

      HttpClient.get([Settings.serverUrl, 'dashboard'], api_params)
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          setDashboards(data['dashboards']);
          setFilteredDBs(data['dashboards']);
          if (defaultDashboard && !selectedDB) {
            const default_db_item = data['dashboards'].filter(dash => dash.id == defaultDashboard).pop();
            if (default_db_item) {
              setSelectedDB(default_db_item);
              setSelectDBInputValue(default_db_item.title);
              navigate('/project/' + default_db_item.project_id + '/dashboard/' + default_db_item.id)
            }
          }
        })
        .catch(error => console.error(error));
    }


  }, [filterDBValue, defaultDashboard, primaryObject, navigate, selectedDB]);

  useEffect(() => {
    // sync the URL to the dashboard selection
    if (dashboard_id && (selectedDB?.id !== dashboard_id)) {
      HttpClient.get([Settings.serverUrl, 'dashboard', dashboard_id])
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          setSelectedDB(data);
          setIsDBSelectorOpen(false);
          setFilterDBValue();
          setSelectDBInputValue(data?.title);
        })
        .catch(error => console.error(error));
    }
  }, [dashboard_id, selectedDB])


  function onDashboardSelect(_event, value) {
    // state update
    setSelectedDB(value);
    setIsDBSelectorOpen(false);
    setFilterDBValue('');
    setSelectDBInputValue(value.title);

    navigate('/project/' + value.project_id + '/dashboard/' + value.id)
  }

  function onDashboardClear() {
    // state update
    setSelectedDB();
    setIsDBSelectorOpen(false);
    setSelectDBInputValue('');
    setFilterDBValue('');

    navigate('/project/' + project_id + '/dashboard/')
  }

  function handleDBFilterInput(e) {
    setSelectDBInputValue(e.target.value);
    setFilterDBValue(e.target.value);
  }

  function onNewDashboardSave(newDashboard) {
    HttpClient.post([Settings.serverUrl, 'dashboard'], newDashboard)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        setIsNewDBOpen(false);
        onDashboardSelect(null, data);
      })
      .catch(error => console.error(error));
  }

  function onDeleteWidgetClick(id) {
    setIsDeleteWidgetOpen(true);
    setCurrentWidget(id)
  }

  function onNewWidgetSave(widgetData) {
    if (!widgetData.project_id && primaryObject) {
      widgetData.project_id = primaryObject.id;
    }
    HttpClient.post([Settings.serverUrl, 'widget-config'], widgetData)
      .then(()=> setIsNewWidgetOpen(false))  // wait to close modal until widget is saved
      .catch(error => console.error(error));
  }

  function onEditWidgetSave(editedData) {
    if (!editedData.project_id && primaryObject) {
      editedData.project_id = primaryObject.id;
    }
    HttpClient.put([Settings.serverUrl, 'widget-config', currentWidget], '', editedData)
        .then(response => HttpClient.handleResponse(response))
        .catch(error => console.error(error));
    setIsEditModalOpen(false);
  }

  function onEditWidgetClick(id) {
    setIsEditModalOpen(true);

    HttpClient.get([Settings.serverUrl, 'widget-config', id])
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          setCurrentWidget(id);
          setEditWidgetData(data);
        })
        .catch(error => {
          console.error(error);
          setIsEditModalOpen(false);
        });

  }

  document.title = 'Dashboard | Ibutsu';

  const toggle = toggleRef => (
    <MenuToggle
      ref={toggleRef}
      variant="typeahead"
      aria-label="Typeahead menu toggle"
      onClick={() => {setIsDBSelectorOpen({isDBSelectorOpen: !isDBSelectorOpen})}}
      isExpanded={isDBSelectorOpen}
      isFullWidth
      isDisabled={!primaryObject}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={selectDBInputValue}
          onClick={() => {setIsDBSelectorOpen({isDBSelectorOpen: !isDBSelectorOpen})}}
          onChange={handleDBFilterInput}
          id="typeahead-select-input"
          autoComplete="off"
          placeholder={selectedDB?.title || 'No active dashboard'}
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
                  setIsDBSelectorOpen(false)
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
                      onClick={() => {setSelectedDB(dash)}}
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
                isDisabled={isDBSelectorOpen}
                onClick={() => {setIsNewDBOpen(true)}}
              >
                <PlusCircleIcon />
              </Button>
            </FlexItem>
            <FlexItem>
              <Button
                aria-label="Delete dashboard"
                variant="plain"
                title="Delete dashboard"
                isDisabled={!selectedDB}
                onClick={() => {setIsDeleteDBOpen(true)}}
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
                onClick={() => {setIsNewWidgetOpen(true)}}
              >
                <PlusCircleIcon /> Add Widget
              </Button>
            </FlexItem>
          </Flex>
        </Flex>
      </PageSection>
      <PageSection>
        {(!!primaryObject && !!selectedDB && !!widgets) &&
        <Grid hasGutter>
          {widgets?.map(widget => {
            if (KNOWN_WIDGETS.includes(widget.widget)) {
              return (
                <GridItem xl={4} lg={6} md={12} key={widget.id}>
                  {(widget.type === 'widget' && widget.widget === 'jenkins-heatmap') &&
                    <FilterHeatmapWidget
                      title={widget.title}
                      params={widget.params}
                      includeAnalysisLink={true}
                      type='jenkins'
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id)}}
                      onEditClick={() => {onEditWidgetClick(widget.id)}}
                    />
                  }
                  {(widget.type === 'widget' && widget.widget === 'filter-heatmap') &&
                    <FilterHeatmapWidget
                      title={widget.title}
                      params={widget.params}
                      includeAnalysisLink={true}
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id)}}
                      onEditClick={() => {onEditWidgetClick(widget.id)}}
                    />
                  }
                  {(widget.type === 'widget' && widget.widget === 'run-aggregator') &&
                    <GenericBarWidget
                      title={widget.title}
                      params={widget.params}
                      horizontal={true}
                      percentData={true}
                      barWidth={20}
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id)}}
                      onEditClick={() => {onEditWidgetClick(widget.id)}}
                    />
                  }
                  {(widget.type === 'widget' && widget.widget === 'result-summary') &&
                    <ResultSummaryWidget
                      title={widget.title}
                      params={widget.params}
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id)}}
                      onEditClick={() => {onEditWidgetClick(widget.id)}}
                    />
                  }
                  {(widget.type === 'widget' && widget.widget === 'result-aggregator') &&
                    <ResultAggregatorWidget
                      title={widget.title}
                      params={widget.params}
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id)}}
                      onEditClick={() => {onEditWidgetClick(widget.id)}}
                    />
                  }
                  {(widget.type === 'widget' && widget.widget === 'jenkins-line-chart') &&
                    <GenericAreaWidget
                      title={widget.title}
                      params={widget.params}
                      yLabel="Execution time"
                      widgetEndpoint="jenkins-line-chart"
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id)}}
                      onEditClick={() => {onEditWidgetClick(widget.id)}}
                    />
                  }
                  {(widget.type === 'widget' && widget.widget === 'jenkins-bar-chart') &&
                    <GenericBarWidget
                      title={widget.title}
                      params={widget.params}
                      barWidth={20}
                      horizontal={true}
                      hideDropdown={true}
                      widgetEndpoint="jenkins-bar-chart"
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id)}}
                      onEditClick={() => {onEditWidgetClick(widget.id)}}
                    />
                  }
                  {(widget.type === 'widget' && widget.widget === 'importance-component') &&
                    <ImportanceComponentWidget
                      title={widget.title}
                      params={widget.params}
                      barWidth={20}
                      horizontal={true}
                      hideDropdown={true}
                      widgetEndpoint="importance-component"
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id)}}
                      onEditClick={() => {onEditWidgetClick(widget.id)}}
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
        { (!!primaryObject && !selectedDB) &&
        <EmptyState>
          <EmptyStateHeader titleText="No Dashboard Selected" icon={<EmptyStateIcon icon={TachometerAltIcon} />} headingLevel="h4" />
          <EmptyStateBody>
            There is currently no dashboard selected. Please select a dashboard from the dropdown
            in order to view widgets, or create a new dashboard.
          </EmptyStateBody>
          <EmptyStateFooter>
            <Button
              variant="primary"
              onClick={() => {setIsNewDBOpen(true)}}
            >
              New Dashboard
            </Button>
          </EmptyStateFooter>
        </EmptyState>
        }
        {(!!primaryObject && !!selectedDB && widgets.length === 0) &&
        <EmptyState>
          <EmptyStateHeader titleText="No Widgets" icon={<EmptyStateIcon icon={CubesIcon} />} headingLevel="h4" />
          <EmptyStateBody>
            This dashboard currently has no widgets defined.<br />Click on the &quot;Add Widget&quot; button
            below to add a widget to this dashboard.
          </EmptyStateBody>
          <EmptyStateFooter>
            <Button
              variant="primary"
              onClick={() => {setIsNewWidgetOpen(true)}}
            >
              Add Widget
            </Button>
          </EmptyStateFooter>
        </EmptyState>
        }
      </PageSection>
      <NewDashboardModal
        project={primaryObject}
        isOpen={isNewDBOpen}
        onSave={onNewDashboardSave}
        onClose={() => {setIsNewDBOpen(false)}}
      />
      <NewWidgetWizard
        dashboard={selectedDB}
        isOpen={isNewWidgetOpen}
        onSave={onNewWidgetSave}
        onClose={() => {setIsNewWidgetOpen(false)}}
      />
      <DeleteModal
        title="Delete Dashboard"
        body={<>Would you like to delete the current dashboard? <strong>ALL WIDGETS</strong> on the dashboard will also be deleted. <br/> <strong>This action cannot be undone.</strong></>}
        isOpen={isDeleteDBOpen}
        onDelete={onDashboardClear}
        onClose={() => {setIsDeleteDBOpen(false)}}
        toDeletePath={['dashboard']}
        toDeleteId={selectedDB?.id}
      />
      <DeleteModal
        title="Delete widget"
        body="Would you like to delete the selected widget?"
        isOpen={isDeleteWidgetOpen}
        onClose={() => {setIsDeleteWidgetOpen(false)}}
        toDeletePath={['widget-config']}
        toDeleteId={currentWidget}
      />
      {isEditModalOpen ?
        <EditWidgetModal
          isOpen={isEditModalOpen}
          onSave={onEditWidgetSave}
          onClose={() => {setIsEditModalOpen(false)}}
          data={editWidgetData}
        />
      : ''}
    </React.Fragment>
  );
}

Dashboard.propTypes = {
};

export default Dashboard;
