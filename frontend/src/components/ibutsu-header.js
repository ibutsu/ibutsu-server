import React, { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import {
  AboutModal,
  AlertActionLink,
  Brand,
  Button,
  ButtonVariant,
  Flex,
  FlexItem,
  Masthead,
  MastheadMain,
  MastheadBrand,
  MastheadToggle,
  MastheadContent,
  PageToggleButton,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  Switch,
  TextContent,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  TextList,
  TextListItem,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from '@patternfly/react-core';
import { BarsIcon, MoonIcon, ServerIcon, TimesIcon, QuestionCircleIcon, UploadIcon } from '@patternfly/react-icons';

import { FileUpload, UserDropdown } from '../components';
import { MONITOR_UPLOAD_TIMEOUT, VERSION_CHECK_TIMEOUT } from '../constants';
import  packageJson from '../../package.json'
import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { getDateString, getTheme, setTheme } from '../utilities';
import { IbutsuContext } from '../services/context';
import { useNavigate, useParams } from 'react-router-dom';


function IbutsuHeader (props) {
  const context = useContext(IbutsuContext);
  const params = useParams();
  const navigate = useNavigate();

  const [version] = useState(packageJson.version);
  //const [uploadFile, setUploadFile] = useState();
  const [importId, setImportId] = useState();
  const [monitorUploadId, setMonitorUploadId] = useState();
  const [isProjectSelectorOpen, setIsProjectSelectOpen] = useState();
  const [selectedProject, setSelectedProject] = useState();
  const [inputValue, setInputValue] = useState();
  const [filterValue, setFilterValue] = useState();
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isAboutOpen, setIsAboutOpen] = useState();
  const [isDarkTheme, setIsDarkTheme] = useState(getTheme() === 'dark');
  const [endpoint] = useState("project"); // TODO: portal dashboard

  useEffect(() => {
    // update projects/portals when the filter input changes
    getSelectorOptions();
    console.log('dashboard useEffect filterDBValue');

  }, [filterValue, endpoint]);

  useEffect(() => {
    setTheme(isDarkTheme);
  }, [isDarkTheme]);

  useEffect(() => {
    // periodically check for version updates
    // TODO do we really need this?
    setInterval(() => checkVersion(), VERSION_CHECK_TIMEOUT);
  });

  const { project_id } = params;
  useEffect(() => {
    if (selectedProject?.id !== project_id) {
      const { setPrimaryObject, setPrimaryType } = context;

      HttpClient.get([Settings.serverUrl, '/project/', project_id])
        .then(response => HttpClient.handleResponse(response))
        .then((data) => {
          setPrimaryObject(data)
          setPrimaryType('project')
          setSelectedProject(data);
          setFilterValue();
          setInputValue(data.title);
          setIsProjectSelectOpen(false);
        });
    }
  }, [project_id])


  function showNotification(type, title, message, action = null, timeout = null, key = null) {
    // TODO replace with notification refactor
    props?.eventEmitter?.emit('showNotification', type, title, message, action, timeout, key);
  }

  function checkVersion() {
    // TODO do we really need this?
    const frontendUrl = window.location.origin;
    HttpClient.get([frontendUrl, 'version.json'], {'v': getDateString()})
      .then(response => HttpClient.handleResponse(response))
      .then((data) => {
        if (data?.version && (data.version !== version)) {
          const action = <AlertActionLink onClick={() => { window.location.reload(); }}>Reload</AlertActionLink>;
          showNotification(
            'info',
            'Ibutsu has been updated',
            'A newer version of Ibutsu is available, click reload to get it.',
            action,
            true,
            'check-version');
        }
      });
  }

  function getSelectorOptions() {
    // TODO: iterate over pages, fix controller filtering behavior to apply pageSize AFTER filter
    let api_params = {pageSize: 20};
    if (filterValue) {
      api_params['filter'] = ['title%' + filterValue];
    }
    HttpClient.get([Settings.serverUrl, endpoint], api_params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        setProjects(data[endpoint+'s']);
        setFilteredProjects(data[endpoint+'s']);
      })
  }

  // TODO: separate functional upload component
  function onBeforeUpload(files) {
    for (var i = 0; i < files.length; i++) {
      showNotification('info', 'File Uploaded', files[i].name + ' has been uploaded, importing will start momentarily.');
    }
  }

  function onAfterUpload(response) {
    response = HttpClient.handleResponse(response, 'response');
    if (response.status >= 200 && response.status < 400) {
      response.json().then((importObject) => {
        showNotification('info', 'Import Starting', importObject.filename + ' is being imported...');
        setImportId(importObject['id'], () => {
          setMonitorUploadId(setInterval(monitorUpload, MONITOR_UPLOAD_TIMEOUT))
        });
      })
    }
    else {
      showNotification('danger', 'Import Error', 'There was a problem importing your file');
    }
  }

  function monitorUpload() {
    const { primaryObject } = context;
    HttpClient.get([Settings.serverUrl, 'import', importId])
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        if (data['status'] === 'done') {
          clearInterval(monitorUploadId);
          setMonitorUploadId(null);
          let action = null;
          if (data.metadata.run_id) {
            const RunButton = () => (
              <AlertActionLink onClick={() => {navigate('/project/' + (data.metadata.project_id || primaryObject.id) + '/runs/' + data.metadata.run_id)}}>
                Go to Run
              </AlertActionLink>
            )
            action = <RunButton />;
          }
          showNotification('success', 'Import Complete', `${data.filename} has been successfully imported as run ${data.metadata.run_id}`, action);
        }
      });
  }


  function onProjectSelect(_event, value) {
    const {
      primaryObject,
      setPrimaryObject,
      setPrimaryType,
      setDefaultDashboard,
    } = context;
    if (primaryObject?.id === value?.id) {
      setIsProjectSelectOpen(false);
      setInputValue(value.title);
      setFilterValue('');
      return;
    }
    // update context
    setPrimaryObject(value);
    setPrimaryType('project');
    setDefaultDashboard(value.default_dashboard_id);

    // update state
    setSelectedProject(value);
    setIsProjectSelectOpen(false);
    setInputValue(value?.title);
    setFilterValue('');

    navigate('/project/' + value?.id + '/dashboard/');
  }

  function onProjectClear() {
    const { setPrimaryObject } = context;

    setSelectedProject('');
    setIsProjectSelectOpen(false);
    setInputValue('');
    setFilterValue('');

    setPrimaryObject();

    navigate("/project");
  }

  function onProjectTextInputChange(_event, value) {
    setInputValue(value);
    setFilterValue(value);
  }

  const toggle = toggleRef => (
    <MenuToggle
      variant="typeahead"
      onClick={setIsProjectSelectOpen(!isProjectSelectorOpen)}
      isExpanded={isProjectSelectorOpen}
      isFullWidth
      innerRef={toggleRef}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={inputValue}
          onClick={setIsProjectSelectOpen(!isProjectSelectorOpen)}
          onChange={onProjectTextInputChange}
          id="typeahead-select-input"
          autoComplete="off"
          placeholder="No active project"
          role="combobox"
          isExpanded={isProjectSelectorOpen}
          aria-controls="select-typeahead-listbox"
        />
        <TextInputGroupUtilities>
          {!!inputValue && (
            <Button variant="plain" onClick={() => {
              onProjectClear()
            }} aria-label="Clear input value">
              <TimesIcon aria-hidden />
            </Button>
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );


  const topNav = (
    <Flex>
      <FlexItem id="project-selector">
        <Select
          id="typeahead-select"
          isOpen={isProjectSelectorOpen}
          selected={selectedProject}
          onSelect={onProjectSelect}
          onOpenChange={() => {setIsProjectSelectOpen(false);}}
          toggle={toggle}
        >
          <SelectList id="select-typeahead-listbox">
            {(projects.length === 0 && !filterValue) && (
              <SelectOption
                isDisabled={true}
                description={"Ask Ibutsu admins to add you to a project"}>
                No projects available
              </SelectOption>
            )}
            {(projects.length === 0 && !!filterValue) && (
              <SelectOption isDisabled={true}>
                {`No results found for "${filterValue}"`}
              </SelectOption>
            )}
            {filteredProjects.map((project, index) => (
              <SelectOption
                key={project.id || index}
                onClick={() => {setSelectedProject(project)}}
                value={project}
                description={project.name}
                isDisabled={project.isDisabled}>
                {project.title}
              </SelectOption>
            ))}
            {projects.length === 10 && (
              <SelectOption isDisabled>Search for more...</SelectOption>
            )}
          </SelectList>
        </Select>
      </FlexItem>
    </Flex>
  );

  const headerTools = (
    <Toolbar id="toolbar" isFullHeight isStatic style={{paddingLeft: "30px"}}>
      <ToolbarContent>
        <ToolbarGroup variant="filter-group">
          <ToolbarItem>
            {topNav}
          </ToolbarItem>
        </ToolbarGroup>
        <ToolbarGroup
          variant="icon-button-group"
          align={{
            default: 'alignRight'
          }}
          spacer={{
            default: 'spacerNone',
            md: 'spacerMd'
          }}
        >
          <ToolbarItem>
            <Button
              aria-label="About"
              onClick={() => {setIsAboutOpen(!isAboutOpen);}}
              variant={ButtonVariant.plain}
              icon={<QuestionCircleIcon />} />
          </ToolbarItem>
          <ToolbarItem>
            <FileUpload
              className="pf-v5-c-button pf-m-plain"
              name="importFile"
              url={`${Settings.serverUrl}/import`}
              multiple={false}
              beforeUpload={onBeforeUpload}
              afterUpload={onAfterUpload}
              title="Import xUnit XML or Ibutsu Archive"
            ><UploadIcon /> Import</FileUpload>
          </ToolbarItem>
          <ToolbarItem>
            <a
              href={Settings.serverUrl + '/ui/'}
              className="pf-v5-c-button pf-m-plain"
              target="_blank"
              rel="noopener noreferrer"
            ><ServerIcon/> API</a>
          </ToolbarItem>
          <ToolbarItem>
            <Switch
            id="theme-toggle"
            label={<MoonIcon />}
            isChecked={isDarkTheme}
            onChange={(_event, isChecked) => {setIsDarkTheme(isChecked);}} />
          </ToolbarItem>
          <ToolbarItem id="user-dropdown">
            <UserDropdown eventEmitter={props.eventEmitter}/>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  )

  document.title = 'Ibutsu';

  return (
    <React.Fragment>
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => {setIsAboutOpen(!isAboutOpen);}}
        brandImageSrc="/images/ibutsu.svg"
        brandImageAlt="Ibutsu"
        productName="Ibutsu"
        backgroundImageSrc="/images/about-bg.jpg"
        trademark="Copyright (c) 2021 Red Hat, Inc."
      >
        <TextContent>
          <TextList component="dl">
            <TextListItem component="dt">Version</TextListItem>
            <TextListItem component="dd">{version}</TextListItem>
            <TextListItem component="dt">Source code</TextListItem>
            <TextListItem component="dd"><a href="https://github.com/ibutsu/ibutsu-server" target="_blank" rel="noopener noreferrer">github.com/ibutsu/ibutsu-server</a></TextListItem>
            <TextListItem component="dt">Documentation</TextListItem>
            <TextListItem component="dd"><a href="https://docs.ibutsu-project.org/" target="_blank" rel="noopener noreferrer">docs.ibutsu-project.org</a></TextListItem>
            <TextListItem component="dt">Report bugs</TextListItem>
            <TextListItem component="dd"><a href="https://github.com/ibutsu/ibutsu-server/issues/new" target="_blank" rel="noopener noreferrer">Submit an issue</a></TextListItem>
          </TextList>
        </TextContent>
        <p style={{marginTop: "2rem"}}>* Note: artifact files (screenshots, logs) are retained for 3 months</p>
      </AboutModal>
      <Masthead>
        <MastheadToggle>
          <PageToggleButton
            variant="plain"
            aria-label="Global navigation"
            id="vertical-nav-toggle"
          >
            <BarsIcon />
          </PageToggleButton>
        </MastheadToggle>
        <MastheadMain>
          <MastheadBrand href={'/'}>
            <Brand src="/images/ibutsu-wordart-164.png" alt="Ibutsu"/>
          </MastheadBrand>
        </MastheadMain>
        <MastheadContent>
          {headerTools}
        </MastheadContent>
      </Masthead>
    </React.Fragment>
  )
}

IbutsuHeader.propTypes = {
  eventEmitter: PropTypes.object,
};

export default IbutsuHeader;
