import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Button,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  Grid,
  PageSection,
  Content,
  EmptyStateFooter,
  MenuToggle,
  Select,
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
import { useNavigate, useParams } from 'react-router-dom';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import NewDashboardModal from './components/new-dashboard-modal';
import NewWidgetWizard from './components/new-widget-wizard';
import EditWidgetModal from './components/edit-widget-modal';
import DeleteModal from './components/delete-modal';
import { useWidgets } from './components/hooks/useWidgets';
import { IbutsuContext } from './components/contexts/ibutsuContext';

import { nanoid } from 'nanoid/non-secure';

const Dashboard = () => {
  const { defaultDashboard, primaryObject } = useContext(IbutsuContext);
  const { dashboard_id, project_id } = useParams();

  const navigate = useNavigate();

  // dashboard states
  const [loading, setLoading] = useState(true);
  const [dashboards, setDashboards] = useState([]);
  const [filteredDashboards, setFilteredDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState();
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isNewDBOpen, setIsNewDBOpen] = useState(false);
  const [isDeleteDBOpen, setIsDeleteDBOpen] = useState(false);

  // widget states
  const [isNewWidgetOpen, setIsNewWidgetOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editWidgetData, setEditWidgetData] = useState({});
  const [isDeleteWidgetOpen, setIsDeleteWidgetOpen] = useState(false);
  const [currentWidget, setCurrentWidget] = useState();

  // typeahead input value states
  const [selectInputValue, setSelectInputValue] = useState('');
  const [selectFilterValue, setSelectFilterValue] = useState('');
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const selectInputRef = useRef();
  const [loadKey, setLoadKey] = useState(nanoid(6));

  const onDeleteWidgetClick = (id) => {
    setIsDeleteWidgetOpen(true);
    setCurrentWidget(id);
  };

  const onEditWidgetClick = (id) => {
    setIsEditModalOpen(true);

    const fetchWidgetData = async (id) => {
      try {
        const response = await HttpClient.get([
          Settings.serverUrl,
          'widget-config',
          id,
        ]);
        const data = await HttpClient.handleResponse(response);
        setCurrentWidget(id);
        setEditWidgetData(data);
      } catch (error) {
        alert(`Widget GET failed on edit: ${error}`);
        console.error(error);
      }
    };

    // Call the function
    const debouncer = setTimeout(() => {
      fetchWidgetData(id);
    }, 100);
    return () => {
      clearTimeout(debouncer);
    };
  };

  // update widgets
  const { widgets, widgetComponents } = useWidgets({
    dashboardId: selectedDashboard?.id,
    editCallback: onEditWidgetClick,
    deleteCallback: onDeleteWidgetClick,
    loadKey,
  });

  // Fetch all dashboards for the project
  useEffect(() => {
    setSelectedDashboard();
    setDashboards([]);
    setSelectInputValue('');
    let fetchedDashboards = [];
    const fetchDashboards = async (page = 1) => {
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'dashboard'],
          {
            project_id: primaryObject.id,
            pageSize: 50,
            page,
          },
        );
        const data = await HttpClient.handleResponse(response);
        const pagedDashboards = data['dashboards'];
        const paginationData = data['pagination'];
        fetchedDashboards = [...fetchedDashboards, ...pagedDashboards];
        if (
          pagedDashboards.length &&
          dashboard_id &&
          selectedDashboard?.id !== dashboard_id
        ) {
          const paramDashboard = pagedDashboards
            .filter((db) => db.id == dashboard_id)
            .pop();
          if (paramDashboard) {
            setSelectedDashboard(paramDashboard);
            setIsDashboardOpen(false);
            setSelectInputValue(paramDashboard.title);
          }
        }
        if (page < paginationData['totalPages']) {
          await fetchDashboards(page + 1);
        } else {
          setDashboards(fetchedDashboards);
          setLoading(false);
        }
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };

    if (primaryObject) {
      setLoading(true);
      const debouncer = setTimeout(() => {
        fetchDashboards();
      }, 100);

      return () => {
        clearTimeout(debouncer);
      };
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryObject]);

  // Apply the default dashboard
  useEffect(() => {
    // selectedDashboard is undefined until user picks one or this sets it
    if (
      dashboards.length &&
      defaultDashboard &&
      selectedDashboard === undefined
    ) {
      const default_db = dashboards
        .filter((dash) => dash.id == defaultDashboard)
        .pop();
      if (default_db) {
        setSelectedDashboard(default_db);
        setSelectInputValue(default_db.title);
        navigate(
          `/project/${default_db.project_id}/dashboard/${default_db.id}`,
        );
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!dashboards, !!selectedDashboard]); // only when they switch from undefined on first set

  // Apply filter inputs
  useEffect(() => {
    let filteredOptions = [...dashboards];
    if (selectFilterValue && dashboards.length) {
      filteredOptions = [...dashboards];

      filteredOptions = filteredOptions.filter((dashboard) =>
        dashboard.title.toLowerCase().includes(selectFilterValue.toLowerCase()),
      );
      if (!filteredOptions.length) {
        filteredOptions = [
          {
            isAriaDisabled: true,
            children: `No dashboards matching "${selectFilterValue}"`,
          },
        ];
      }
      if (!isDashboardOpen) {
        setIsDashboardOpen(true);
      }
    }

    setFilteredDashboards(filteredOptions);
  }, [selectFilterValue, dashboards, isDashboardOpen]);

  const onDashboardSelect = useCallback(
    (_event, selection) => {
      const selected = dashboards.find((d) => d.id === selection);
      setSelectInputValue(selected.title);
      setSelectFilterValue('');
      setSelectedDashboard(selected);
      setIsSelectOpen(false);
      navigate(`/project/${project_id}/dashboard/${selected.id}`);
    },
    [dashboards, navigate, project_id],
  );

  const onDashboardClear = useCallback(() => {
    // state update
    setSelectedDashboard();
    setIsDashboardOpen(false);
    setSelectInputValue('');
    setSelectFilterValue('');
    selectInputRef?.current?.focus();
    navigate(`/project/${project_id}/dashboard/`);
  }, [navigate, project_id]);

  const onDashboardFilterInput = useCallback(
    (_, value) => {
      setSelectInputValue(value);
      setSelectFilterValue(value);
      if (value !== selectedDashboard) {
        setSelectedDashboard(value);
      }
    },
    [selectedDashboard],
  );

  const onNewDashboardSave = async (newDashboard) => {
    try {
      const response = await HttpClient.post(
        [Settings.serverUrl, 'dashboard'],
        newDashboard,
      );
      const data = await HttpClient.handleResponse(response);
      setIsNewDBOpen(false);
      onDashboardSelect(null, data);
    } catch (error) {
      console.error(error);
    }
  };

  const onNewWidgetSave = (widgetData) => {
    if (!widgetData.project_id && primaryObject) {
      widgetData.project_id = primaryObject.id;
    }
    const postWidget = async (widgetData) => {
      try {
        const response = await HttpClient.post(
          [Settings.serverUrl, 'widget-config'],
          widgetData,
        );
        await HttpClient.handleResponse(response);
        setIsNewWidgetOpen(false); // wait to close modal until widget is saved
      } catch (error) {
        console.error(error);
      }
    };

    postWidget(widgetData);
    setLoadKey(nanoid(6)); // reset load key to re-fetch widgets
  };

  const onEditWidgetSave = (editedData) => {
    if (!editedData.project_id && primaryObject) {
      editedData.project_id = primaryObject.id;
    }
    const putWidget = async (editedData) => {
      try {
        const response = await HttpClient.put(
          [Settings.serverUrl, 'widget-config', currentWidget],
          '',
          editedData,
        );
        await HttpClient.handleResponse(response);
      } catch (error) {
        console.error(error);
      }
    };
    putWidget(editedData);
    setLoadKey(nanoid(6)); // reset load key to re-fetch widgets
    setIsEditModalOpen(false);
  };

  useEffect(() => {
    document.title = 'Dashboard | Ibutsu';
  }, []);

  const onDashboardToggle = useCallback(() => {
    setIsSelectOpen(!isSelectOpen);
    selectInputRef?.current?.focus();
  }, [isSelectOpen]);

  const dashboardSelect = useMemo(
    () => (
      <Flex>
        <FlexItem>
          <Select
            id="dashboard-select"
            isOpen={isSelectOpen}
            selected={selectedDashboard?.id}
            onSelect={onDashboardSelect}
            onOpenChange={(isOpen) => setIsSelectOpen(isOpen)}
            toggle={(toggleRef) => (
              <MenuToggle
                ref={toggleRef}
                variant="typeahead"
                onClick={onDashboardToggle}
                isExpanded={isSelectOpen}
              >
                <TextInputGroup isPlain>
                  <TextInputGroupMain
                    value={selectInputValue}
                    onClick={onDashboardToggle}
                    onChange={onDashboardFilterInput}
                    id="typeahead-select-input"
                    autoComplete="off"
                    placeholder="Select a dashboard"
                  />
                  {!!selectInputValue && (
                    <TextInputGroupUtilities>
                      <Button
                        icon={<TimesIcon aria-hidden />}
                        variant="plain"
                        onClick={onDashboardClear}
                        aria-label="Clear input value"
                      />
                    </TextInputGroupUtilities>
                  )}
                </TextInputGroup>
              </MenuToggle>
            )}
          >
            <SelectList>
              {filteredDashboards.map((dashboard, index) => (
                <SelectOption
                  key={dashboard.id || index}
                  value={dashboard.id}
                  description={dashboard.id}
                >
                  {dashboard.title}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        </FlexItem>
      </Flex>
    ),
    [
      filteredDashboards,
      isSelectOpen,
      onDashboardClear,
      onDashboardFilterInput,
      onDashboardSelect,
      onDashboardToggle,
      selectInputValue,
      selectedDashboard?.id,
    ],
  );

  const dashboardTitle = (
    <Content>
      <Content component="h1">Dashboard</Content>
    </Content>
  );

  return (
    <React.Fragment>
      <PageSection hasBodyWrapper={false}>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <Flex>
            <FlexItem spacer={{ default: 'spacerLg' }}>
              {dashboardTitle}
            </FlexItem>
            {!loading && dashboardSelect}
            <FlexItem>
              <Button
                icon={<PlusCircleIcon />}
                aria-label="New dashboard"
                variant="plain"
                title="New dashboard"
                isDisabled={isDashboardOpen}
                onClick={() => {
                  setIsNewDBOpen(true);
                }}
              />
            </FlexItem>
            <FlexItem>
              <Button
                icon={<TimesCircleIcon />}
                aria-label="Delete dashboard"
                variant="plain"
                title="Delete dashboard"
                isDisabled={!selectedDashboard}
                onClick={() => {
                  setIsDeleteDBOpen(true);
                }}
              />
            </FlexItem>
          </Flex>

          <Flex>
            <FlexItem>
              <Button
                icon={<PlusCircleIcon />}
                aria-label="Add widget"
                variant="secondary"
                title="Add widget"
                isDisabled={!selectedDashboard}
                onClick={() => {
                  setIsNewWidgetOpen(true);
                }}
              >
                Add Widget
              </Button>
            </FlexItem>
          </Flex>
        </Flex>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        {!!primaryObject && !!selectedDashboard && !!widgets && (
          <Grid hasGutter>{widgetComponents}</Grid>
        )}
        {!!primaryObject && !selectedDashboard && (
          <EmptyState
            headingLevel="h4"
            icon={TachometerAltIcon}
            titleText="No Dashboard Selected"
          >
            <EmptyStateBody>
              There is currently no dashboard selected. Please select a
              dashboard from the dropdown in order to view widgets, or create a
              new dashboard.
            </EmptyStateBody>
            <EmptyStateFooter>
              <Button
                variant="primary"
                onClick={() => {
                  setIsNewDBOpen(true);
                }}
              >
                New Dashboard
              </Button>
            </EmptyStateFooter>
          </EmptyState>
        )}
        {!!primaryObject && !!selectedDashboard && widgets.length === 0 && (
          <EmptyState headingLevel="h4" icon={CubesIcon} titleText="No Widgets">
            <EmptyStateBody>
              This dashboard currently has no widgets defined.
              <br />
              Click on the &quot;Add Widget&quot; button below to add a widget
              to this dashboard.
            </EmptyStateBody>
            <EmptyStateFooter>
              <Button
                variant="primary"
                onClick={() => {
                  setIsNewWidgetOpen(true);
                }}
              >
                Add Widget
              </Button>
            </EmptyStateFooter>
          </EmptyState>
        )}
      </PageSection>
      <NewDashboardModal
        project={primaryObject}
        saveCallback={(newDashboard) => onNewDashboardSave(newDashboard)}
        closeCallback={() => {
          setIsNewDBOpen(false);
        }}
        isOpen={isNewDBOpen}
      />
      <NewWidgetWizard
        dashboard={selectedDashboard}
        isOpen={isNewWidgetOpen}
        saveCallback={onNewWidgetSave}
        closeCallback={() => {
          setIsNewWidgetOpen(false);
        }}
      />
      <DeleteModal
        title="Delete Dashboard"
        body={
          <>
            Would you like to delete the current dashboard?{' '}
            <strong>ALL WIDGETS</strong> on the dashboard will also be deleted.{' '}
            <br /> <strong>This action cannot be undone.</strong>
          </>
        }
        isOpen={isDeleteDBOpen}
        onDelete={onDashboardClear}
        onClose={() => {
          setIsDeleteDBOpen(false);
        }}
        toDeletePath={['dashboard']}
        toDeleteId={selectedDashboard?.id}
      />
      <DeleteModal
        title="Delete widget"
        body="Would you like to delete the selected widget?"
        isOpen={isDeleteWidgetOpen}
        onClose={() => {
          setIsDeleteWidgetOpen(false);
          setLoadKey(nanoid(6)); // reset load key to re-fetch widgets
        }}
        toDeletePath={['widget-config']}
        toDeleteId={currentWidget}
      />
      {isEditModalOpen ? (
        <EditWidgetModal
          isOpen={isEditModalOpen}
          onSave={onEditWidgetSave}
          onClose={() => {
            setIsEditModalOpen(false);
            setLoadKey(nanoid(6)); // reset load key to re-fetch widgets
          }}
          data={editWidgetData}
        />
      ) : (
        ''
      )}
    </React.Fragment>
  );
};

Dashboard.propTypes = {};

export default Dashboard;
