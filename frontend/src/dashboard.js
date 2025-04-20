import React, { useContext, useEffect, useRef, useState } from 'react';
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
import NewDashboardModal from './components/new-dashboard-modal.js';
import NewWidgetWizard from './components/new-widget-wizard.js';
import EditWidgetModal from './components/edit-widget-modal.js';
import DeleteModal from './components/delete-modal.js';
import GenericAreaWidget from './widgets/genericarea.js';
import GenericBarWidget from './widgets/genericbar.js';
import FilterHeatmapWidget from './widgets/filterheatmap';
import ImportanceComponentWidget from './widgets/importancecomponent';
import ResultAggregatorWidget from './widgets/resultaggregator';
import ResultSummaryWidget from './widgets/resultsummary';
import { IbutsuContext } from './services/context.js';
import { useNavigate, useParams } from 'react-router-dom';


const Dashboard = () => {
  const {defaultDashboard, primaryObject } = useContext(IbutsuContext);
  const { dashboard_id, project_id } = useParams();

  const navigate = useNavigate();

  // dashboard states
  const [loading, setLoading] = useState(true);
  const [dashboards, setDashboards] = useState();
  const [filteredDashboards, setFilteredDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState();
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
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
  const [selectInputValue, setSelectInputValue] = useState('');
  const [selectFilterValue, setSelectFilterValue] = useState('');
  const selectInputRef = useRef();

  // update widgets
  useEffect(() => {
    const getWidgets = async () => {
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'widget-config'],
          {'type': 'widget', 'filter': `dashboard_id=${selectedDashboard.id}`}
        );
        const data = await HttpClient.handleResponse(response);
        data.widgets.forEach(widget => {
          widget.params['project'] = selectedDashboard.project_id;
        });
        setWidgets(data.widgets);
      } catch (error) { console.error(error); }
    };
    if (selectedDashboard) {
      getWidgets();
    }
  }, [selectedDashboard, isDeleteWidgetOpen, isEditModalOpen, isNewWidgetOpen]);

  // Fetch all dashboards for the project
  useEffect(() => {
    const fetchDashboards = async () => {
      setSelectedDashboard();
      setDashboards();
      setSelectInputValue('');
      try {
        const response = await HttpClient.get([Settings.serverUrl, 'dashboard'], {
          'project_id': primaryObject.id,
          'pageSize': 100,
        });
        const data = (await HttpClient.handleResponse(response))['dashboards'];
        setDashboards(data);
        setLoading(false);
        if (data && dashboard_id && (selectedDashboard?.id !== dashboard_id)) {
          const paramDashboard = data.filter(dashboard => dashboard.id == dashboard_id).pop();
          if (paramDashboard) {
            console.log('setting default');
            setSelectedDashboard(paramDashboard);
            setIsDashboardOpen(false);
            setSelectInputValue(paramDashboard.title);
          } else {console.error('URL parameter dashboard ID not found');}
        }
      } catch (error) { console.error(error); }
    };
    if (primaryObject) {
      fetchDashboards();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryObject, defaultDashboard]);

  // Apply the default dashboard
  useEffect(() => {
  // selectedDashboard is undefined until user picks one or this sets it
    if (dashboards?.length > 0 && defaultDashboard && (selectedDashboard === undefined)) {
      const default_db = dashboards.filter(dash => dash.id == defaultDashboard).pop();
      if (default_db) {
        console.log('applying default dash');
        setSelectedDashboard(default_db);
        setSelectInputValue(default_db.title);
        navigate(`/project/${default_db.project_id}/dashboard/${default_db.id}`);
      }
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!dashboards, !!selectedDashboard]); // only when they switch from undefined on first set

  // Apply filter inputs
  useEffect(() => {
    let filteredOptions = dashboards;
    if (selectFilterValue && dashboards) {
      console.log('filter effect:  '+selectFilterValue);
      filteredOptions = filteredOptions.filter(
        dashboard => dashboard.title.toLowerCase().includes(selectFilterValue.toLowerCase())
      );
      if (!filteredOptions.length) {
        filteredOptions = [{
          isAriaDisabled: true,
          children: `No dashboards matching "${selectFilterValue}"`
        }];
      }
      if (!isDashboardOpen) {
        setIsDashboardOpen(true);
      }
    }


    setFilteredDashboards(filteredOptions);
  }, [selectFilterValue, dashboards, isDashboardOpen]);

  const onDashboardSelect = (_, value) => {
    if (value) {
      setSelectedDashboard(value);
      setIsDashboardOpen(false);
      setSelectFilterValue('');
      setSelectInputValue(String(value.title));

      navigate(`/project/${value.project_id}/dashboard/${value.id}`);
    }
  };

  const onDashboardClear = () => {
    // state update
    setSelectedDashboard();
    setIsDashboardOpen(false);
    setSelectInputValue('');
    setSelectFilterValue('');
    selectInputRef?.current?.focus();
    navigate(`/project/${project_id}/dashboard/`);
  };

  const onDashboardFilterInput = (_, value) => {
    setSelectInputValue(value);
    setSelectFilterValue(value);
    if(value !== selectedDashboard) { setSelectedDashboard(value); }
  };

  const onNewDashboardSave = async (newDashboard) => {
    try {
      const response = await HttpClient.post([Settings.serverUrl, 'dashboard'], newDashboard);
      const data = await HttpClient.handleResponse(response);
      setIsNewDBOpen(false);
      onDashboardSelect(null, data);
    } catch (error) { console.error(error); };
  };

  const onDeleteWidgetClick = (id) => {
    setIsDeleteWidgetOpen(true);
    setCurrentWidget(id);
  };

  const onNewWidgetSave = (widgetData) => {
    if (!widgetData.project_id && primaryObject) {
      widgetData.project_id = primaryObject.id;
    }
    HttpClient.post([Settings.serverUrl, 'widget-config'], widgetData)
      .then(()=> setIsNewWidgetOpen(false))  // wait to close modal until widget is saved
      .catch(error => console.error(error));
  };

  const onEditWidgetSave = (editedData) => {
    if (!editedData.project_id && primaryObject) {
      editedData.project_id = primaryObject.id;
    }
    HttpClient.put([Settings.serverUrl, 'widget-config', currentWidget], '', editedData)
      .then(response => HttpClient.handleResponse(response))
      .catch(error => console.error(error));
    setIsEditModalOpen(false);
  };

  const onEditWidgetClick = (id) => {
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

  };

  useEffect(() => { document.title = 'Dashboard | Ibutsu'; }, []);

  const toggle = toggleRef => (
    <MenuToggle
      ref={toggleRef}
      variant="typeahead"
      aria-label="Typeahead menu toggle"
      onClick={() => {setIsDashboardOpen(!isDashboardOpen); selectInputRef?.current?.focus();}}
      isExpanded={isDashboardOpen}
      isFullWidth
      isDisabled={!primaryObject}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={selectInputValue}
          onClick={() => {setIsDashboardOpen(!isDashboardOpen);}}
          onChange={onDashboardFilterInput}
          id="typeahead-select-input"
          autoComplete="off"
          placeholder={loading ? 'Loading Dashboards...' : 'No active dashboard'}
          role="combobox"
          isExpanded={isDashboardOpen}
          aria-controls="select-typeahead-listbox"
        />
        <TextInputGroupUtilities {...!selectInputValue ? {style: {display: 'none'}} : {}}>
          <Button
            variant="plain"
            onClick={onDashboardClear}
            aria-label="Clear input value"
          >
            <TimesIcon aria-hidden />
          </Button>
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

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
                isScrollable={true}
                isOpen={isDashboardOpen}
                selected={selectedDashboard}
                onSelect={onDashboardSelect}
                onOpenChange={() => {
                  setIsDashboardOpen(false);
                }}
                toggle={
                  toggle
                }
              >
                <SelectList id="select-typeahead-listbox" scrolling='true'>
                  {filteredDashboards?.map((dash) => (
                    <SelectOption
                      key={dash.id}
                      onClick={() => {setSelectedDashboard(dash);}}
                      value={dash}
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
                isDisabled={isDashboardOpen}
                onClick={() => {setIsNewDBOpen(true);}}
              >
                <PlusCircleIcon />
              </Button>
            </FlexItem>
            <FlexItem>
              <Button
                aria-label="Delete dashboard"
                variant="plain"
                title="Delete dashboard"
                isDisabled={!selectedDashboard}
                onClick={() => {setIsDeleteDBOpen(true);}}
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
                isDisabled={!selectedDashboard}
                onClick={() => {setIsNewWidgetOpen(true);}}
              >
                <PlusCircleIcon /> Add Widget
              </Button>
            </FlexItem>
          </Flex>
        </Flex>
      </PageSection>
      <PageSection>
        {(!!primaryObject && !!selectedDashboard && !!widgets) &&
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
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id);}}
                      onEditClick={() => {onEditWidgetClick(widget.id);}}
                    />
                  }
                  {(widget.type === 'widget' && widget.widget === 'filter-heatmap') &&
                    <FilterHeatmapWidget
                      title={widget.title}
                      params={widget.params}
                      includeAnalysisLink={true}
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id);}}
                      onEditClick={() => {onEditWidgetClick(widget.id);}}
                    />
                  }
                  {(widget.type === 'widget' && widget.widget === 'run-aggregator') &&
                    <GenericBarWidget
                      title={widget.title}
                      params={widget.params}
                      horizontal={true}
                      percentData={true}
                      barWidth={20}
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id);}}
                      onEditClick={() => {onEditWidgetClick(widget.id);}}
                    />
                  }
                  {(widget.type === 'widget' && widget.widget === 'result-summary') &&
                    <ResultSummaryWidget
                      title={widget.title}
                      params={widget.params}
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id);}}
                      onEditClick={() => {onEditWidgetClick(widget.id);}}
                    />
                  }
                  {(widget.type === 'widget' && widget.widget === 'result-aggregator') &&
                    <ResultAggregatorWidget
                      title={widget.title}
                      params={
                        {
                          project: widget.params.project,
                          run_id: widget.params.run_id,
                          additional_filters: widget.params.additional_filters
                        }
                      }
                      chartType={widget.params.chart_type}
                      days={widget.params.days}
                      groupField={widget.params.group_field}
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id);}}
                      onEditClick={() => {onEditWidgetClick(widget.id);}}
                    />
                  }
                  {(widget.type === 'widget' && widget.widget === 'jenkins-line-chart') &&
                    <GenericAreaWidget
                      title={widget.title}
                      params={widget.params}
                      yLabel="Execution time"
                      widgetEndpoint="jenkins-line-chart"
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id);}}
                      onEditClick={() => {onEditWidgetClick(widget.id);}}
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
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id);}}
                      onEditClick={() => {onEditWidgetClick(widget.id);}}
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
                      onDeleteClick={() => {onDeleteWidgetClick(widget.id);}}
                      onEditClick={() => {onEditWidgetClick(widget.id);}}
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
        { (!!primaryObject && !selectedDashboard) &&
        <EmptyState>
          <EmptyStateHeader titleText="No Dashboard Selected" icon={<EmptyStateIcon icon={TachometerAltIcon} />} headingLevel="h4" />
          <EmptyStateBody>
            There is currently no dashboard selected. Please select a dashboard from the dropdown
            in order to view widgets, or create a new dashboard.
          </EmptyStateBody>
          <EmptyStateFooter>
            <Button
              variant="primary"
              onClick={() => {setIsNewDBOpen(true);}}
            >
              New Dashboard
            </Button>
          </EmptyStateFooter>
        </EmptyState>
        }
        {(!!primaryObject && !!selectedDashboard && widgets.length === 0) &&
        <EmptyState>
          <EmptyStateHeader titleText="No Widgets" icon={<EmptyStateIcon icon={CubesIcon} />} headingLevel="h4" />
          <EmptyStateBody>
            This dashboard currently has no widgets defined.<br />Click on the &quot;Add Widget&quot; button
            below to add a widget to this dashboard.
          </EmptyStateBody>
          <EmptyStateFooter>
            <Button
              variant="primary"
              onClick={() => {setIsNewWidgetOpen(true);}}
            >
              Add Widget
            </Button>
          </EmptyStateFooter>
        </EmptyState>
        }
      </PageSection>
      <NewDashboardModal
        project={primaryObject}
        saveCallback={(newDashboard) => onNewDashboardSave(newDashboard)}
        closeCallback={() => {setIsNewDBOpen(false);}}
        isOpen={isNewDBOpen}
      />
      <NewWidgetWizard
        dashboard={selectedDashboard}
        isOpen={isNewWidgetOpen}
        saveCallback={onNewWidgetSave}
        closeCallback={() => {setIsNewWidgetOpen(false);}}
      />
      <DeleteModal
        title="Delete Dashboard"
        body={<>Would you like to delete the current dashboard? <strong>ALL WIDGETS</strong> on the dashboard will also be deleted. <br/> <strong>This action cannot be undone.</strong></>}
        isOpen={isDeleteDBOpen}
        onDelete={onDashboardClear}
        onClose={() => {setIsDeleteDBOpen(false);}}
        toDeletePath={['dashboard']}
        toDeleteId={selectedDashboard?.id}
      />
      <DeleteModal
        title="Delete widget"
        body="Would you like to delete the selected widget?"
        isOpen={isDeleteWidgetOpen}
        onClose={() => {setIsDeleteWidgetOpen(false);}}
        toDeletePath={['widget-config']}
        toDeleteId={currentWidget}
      />
      {isEditModalOpen ?
        <EditWidgetModal
          isOpen={isEditModalOpen}
          onSave={onEditWidgetSave}
          onClose={() => {setIsEditModalOpen(false);}}
          data={editWidgetData}
        />
        : ''}
    </React.Fragment>
  );
};

Dashboard.propTypes = {
};

export default Dashboard;
