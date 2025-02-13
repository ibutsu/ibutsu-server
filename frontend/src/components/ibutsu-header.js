import React from 'react';
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
import  packageJson from '../../package.json';
import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { getDateString, getTheme, setTheme } from '../utilities';
import { IbutsuContext } from '../services/context';


export class IbutsuHeader extends React.Component {
  // TODO: convert to functional
  static contextType = IbutsuContext;
  static propTypes = {
    eventEmitter: PropTypes.object,
    navigate: PropTypes.func,
    version: PropTypes.string,
    params: PropTypes.object,
  };

  constructor (props) {
    super(props);
    this.eventEmitter = props.eventEmitter;
    this.versionCheckId = '';

    this.state = {
      // version
      version: packageJson.version,
      // upload state
      uploadFileName: '',
      importId: '',
      monitorUploadId: null,
      // project state
      isProjectSelectorOpen: false,
      selectedProject: '',
      inputValue: '',
      filterValue: '',
      projects: [],
      filteredProjects: [],
      // misc
      isAboutOpen: false,
      isDarkTheme: getTheme() === 'dark',
    };
  }

  sync_context = () => {
    // Primary object
    const { primaryObject, setPrimaryObject, setPrimaryType } = this.context;
    const { selectedProject } = this.state;
    const paramProject = this.props.params?.project_id;
    let updatedPrimary = undefined;

    // API fetch and set the context
    if (paramProject && primaryObject?.id !== paramProject) {
      HttpClient.get([Settings.serverUrl, 'project', paramProject])
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          updatedPrimary = data;
          setPrimaryObject(data);
          setPrimaryType('project');
          // update state
          this.setState({
            selectedProject: data,
            isProjectSelectorOpen: false,
            inputValue: data?.title,
            filterValue: ''
          });
        });
    }

    // update selector state
    if (updatedPrimary && !selectedProject) {
      this.setState({
        selectedProject: updatedPrimary,
        inputValue: updatedPrimary.title
      });
    }

    if ( updatedPrimary ) {
      this.emitProjectChange(updatedPrimary);
    }
  };

  showNotification (type, title, message, action = null, timeout = null, key = null) {
    if (!this.eventEmitter) {
      return;
    }
    this.eventEmitter.emit('showNotification', type, title, message, action, timeout, key);
  }

  checkVersion () {
    const frontendUrl = window.location.origin;
    HttpClient.get([frontendUrl, 'version.json'], {'v': getDateString()})
      .then(response => HttpClient.handleResponse(response))
      .then((data) => {
        if (data && data.version && (data.version !== this.state.version)) {
          const action = <AlertActionLink onClick={() => { window.location.reload(); }}>Reload</AlertActionLink>;
          this.showNotification(
            'info',
            'Ibutsu has been updated',
            'A newer version of Ibutsu is available, click reload to get it.',
            action,
            true,
            'check-version');
        }
      });
  }

  emitProjectChange (value = null) {
    if (!this.eventEmitter) {
      return;
    }
    this.eventEmitter.emit('projectChange', value);
  }

  getSelectorOptions = (endpoint = 'project') => {
    // adding s here seems dumb, but this scope is small, it's only abstracted for 2 things
    // TODO: iterate over pages, fix controller filtering behavior to apply pageSize AFTER filter
    const pluralEndpoint = endpoint+'s';
    const params = {pageSize: 20};
    if (this.state.filterValue) {
      params['filter'] = ['title%' + this.state.filterValue];
    }
    HttpClient.get([Settings.serverUrl, endpoint], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        this.setState(
          {
            projects: data[pluralEndpoint],
            filteredProjects: data[pluralEndpoint],
          });
      }
      );
  };

  // TODO: separate functional upload component from ibutsu-header
  onBeforeUpload = (files) => {
    for (var i = 0; i < files.length; i++) {
      this.showNotification('info', 'File Uploaded', files[i].name + ' has been uploaded, importing will start momentarily.');
    }
  };

  onAfterUpload = (response) => {
    response = HttpClient.handleResponse(response, 'response');
    if (response.status >= 200 && response.status < 400) {
      response.json().then((importObject) => {
        this.showNotification('info', 'Import Starting', importObject.filename + ' is being imported...');
        this.setState({importId: importObject['id']}, () => {
          let monitorUploadId = setInterval(this.monitorUpload, MONITOR_UPLOAD_TIMEOUT);
          this.setState({monitorUploadId});
        });
      });
    }
    else {
      this.showNotification('danger', 'Import Error', 'There was a problem importing your file');
    }
  };

  monitorUpload = () => {
    const { primaryObject } = this.context;
    HttpClient.get([Settings.serverUrl, 'import', this.state.importId])
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        if (data['status'] === 'done') {
          clearInterval(this.state.monitorUploadId);
          this.setState({monitorUploadId: null});
          let action = null;
          if (data.metadata.run_id) {
            const RunButton = () => (
              <AlertActionLink onClick={() => {this.props.navigate('/project/' + (data.metadata.project_id || primaryObject.id) + '/runs/' + data.metadata.run_id);}}>
                Go to Run
              </AlertActionLink>
            );
            action = <RunButton />;
          }
          this.showNotification('success', 'Import Complete', `${data.filename} has been successfully imported as run ${data.metadata.run_id}`, action);
        }
      });
  };

  onProjectToggle = () => {
    this.setState({isProjectSelectorOpen: !this.state.isProjectSelectorOpen});
  };

  onProjectSelect = (_event, value) => {
    const { primaryObject, setPrimaryObject, setPrimaryType } = this.context;
    if (primaryObject?.id === value?.id) {
      this.setState({
        isProjectSelectorOpen: false,
        inputValue: value.title,
        filterValue: ''
      });
      return;
    }
    // update context
    setPrimaryObject(value);
    setPrimaryType('project');
    // update state
    this.setState({
      selectedProject: value,
      isProjectSelectorOpen: false,
      inputValue: value?.title,
      filterValue: ''
    });
    // Consider whether the location should be changed within the emit hooks?
    let dash_path = '';
    if (value?.default_dashboard_id != null) {dash_path = '/dashboard/' + value?.default_dashboard_id;}
    this.props.navigate('/project/' + value?.id + dash_path);

    // useEffect with dependency on functional component to remove passing value, handlers don't see updated context
    this.emitProjectChange(value);
  };

  onProjectClear = () => {
    const { setPrimaryObject } = this.context;

    this.setState({
      selectedProject: '',
      isProjectSelectorOpen: false,
      inputValue: '',
      filterValue: ''
    });
    setPrimaryObject();

    this.props.navigate('/project');

    this.emitProjectChange();
  };

  onProjectTextInputChange = (_event, value) => {
    this.setState({
      inputValue: value,
      filterValue: value
    }, this.getSelectorOptions('project'));
  };

  toggleAbout = () => {
    this.setState({isAboutOpen: !this.state.isAboutOpen});
  };

  onThemeChanged = (isChecked) => {
    setTheme(isChecked ? 'dark' : 'light');
    this.setState({isDarkTheme: isChecked});
  };

  componentWillUnmount () {
    if (this.state.monitorUploadId) {
      clearInterval(this.state.monitorUploadId);
    }
    if (this.versionCheckId) {
      clearInterval(this.versionCheckId);
    }
  }

  componentDidMount () {
    this.getSelectorOptions('project');
    this.sync_context();
    this.checkVersion();
    this.versionCheckId = setInterval(() => this.checkVersion(), VERSION_CHECK_TIMEOUT);
  }

  componentDidUpdate (prevProps, prevState) {
    if (
      prevState.filterValue !== this.state.filterValue
    ) {
      let newSelectOptionsProject = this.state.projects;
      if (this.state.inputValue) {
        newSelectOptionsProject = this.state.projects.filter(menuItem =>
          String(menuItem.title).toLowerCase().includes(this.state.filterValue.toLowerCase())
        );

        if (!this.state.isProjectSelectorOpen) {
          this.setState({ isProjectSelectorOpen: true });
        }
      }

      this.setState({
        filteredProjects: newSelectOptionsProject,
      });
    }
  }

  toggle = toggleRef => (
    <MenuToggle
      variant="typeahead"
      onClick={this.onProjectToggle}
      isExpanded={this.state.isProjectSelectorOpen}
      isFullWidth
      innerRef={toggleRef}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={this.state.inputValue}
          onClick={this.onProjectToggle}
          onChange={this.onProjectTextInputChange}
          id="typeahead-select-input"
          autoComplete="off"
          placeholder="No active project"
          role="combobox"
          isExpanded={this.state.isProjectSelectorOpen}
          aria-controls="select-typeahead-listbox"
        />
        <TextInputGroupUtilities>
          {!!this.state.inputValue && (
            <Button variant="plain" onClick={() => {
              this.onProjectClear();
            }} aria-label="Clear input value">
              <TimesIcon aria-hidden />
            </Button>
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  render () {
    document.title = 'Ibutsu';
    const apiUiUrl = Settings.serverUrl + '/ui/';
    const {
      selectedProject,
      projects,
      filteredProjects,
      filterValue,
    } = this.state;

    const topNav = (
      <Flex>
        <FlexItem id="project-selector">
          <Select
            id="typeahead-select"
            isOpen={this.state.isProjectSelectorOpen}
            selected={selectedProject}
            onSelect={this.onProjectSelect}
            onOpenChange={() => {
              this.setState({isProjectSelectorOpen: false});
            }}
            toggle={this.toggle}
          >
            <SelectList id="select-typeahead-listbox">
              {(projects.length === 0 && !filterValue) && (
                <SelectOption
                  isDisabled={true}
                  description="Ask Ibutsu admins to add you to a project">
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
                  onClick={() => this.setState({selectedProject: project})}
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
      <Toolbar id="toolbar" isFullHeight isStatic style={{paddingLeft: '30px'}}>
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
                onClick={this.toggleAbout}
                variant={ButtonVariant.plain}
                icon={<QuestionCircleIcon />} />
            </ToolbarItem>
            <ToolbarItem>
              <FileUpload
                className="pf-v5-c-button pf-m-plain"
                name="importFile"
                url={`${Settings.serverUrl}/import`}
                multiple={false}
                beforeUpload={this.onBeforeUpload}
                afterUpload={this.onAfterUpload}
                title="Import xUnit XML or Ibutsu Archive"
              ><UploadIcon /> Import</FileUpload>
            </ToolbarItem>
            <ToolbarItem>
              <a
                href={apiUiUrl}
                className="pf-v5-c-button pf-m-plain"
                target="_blank"
                rel="noopener noreferrer"
              ><ServerIcon/> API</a>
            </ToolbarItem>
            <ToolbarItem>
              <Switch
                id="theme-toggle"
                label={<MoonIcon />}
                isChecked={this.state.isDarkTheme}
                onChange={(_event, isChecked) => this.onThemeChanged(isChecked)} />
            </ToolbarItem>
            <ToolbarItem id="user-dropdown">
              <UserDropdown eventEmitter={this.eventEmitter}/>
            </ToolbarItem>
          </ToolbarGroup>
        </ToolbarContent>
      </Toolbar>
    );
    return (
      <React.Fragment>
        <AboutModal
          isOpen={this.state.isAboutOpen}
          onClose={this.toggleAbout}
          brandImageSrc="/images/ibutsu.svg"
          brandImageAlt="Ibutsu"
          productName="Ibutsu"
          backgroundImageSrc="/images/about-bg.jpg"
          trademark="Copyright (c) 2021 Red Hat, Inc."
        >
          <TextContent>
            <TextList component="dl">
              <TextListItem component="dt">Version</TextListItem>
              <TextListItem component="dd">{this.state.version}</TextListItem>
              <TextListItem component="dt">Source code</TextListItem>
              <TextListItem component="dd"><a href="https://github.com/ibutsu/ibutsu-server" target="_blank" rel="noopener noreferrer">github.com/ibutsu/ibutsu-server</a></TextListItem>
              <TextListItem component="dt">Documentation</TextListItem>
              <TextListItem component="dd"><a href="https://docs.ibutsu-project.org/" target="_blank" rel="noopener noreferrer">docs.ibutsu-project.org</a></TextListItem>
              <TextListItem component="dt">Report bugs</TextListItem>
              <TextListItem component="dd"><a href="https://github.com/ibutsu/ibutsu-server/issues/new" target="_blank" rel="noopener noreferrer">Submit an issue</a></TextListItem>
            </TextList>
          </TextContent>
          <p style={{marginTop: '2rem'}}>* Note: artifact files (screenshots, logs) are retained for 3 months</p>
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
            <MastheadBrand href="/">
              <Brand src="/images/ibutsu-wordart-164.png" alt="Ibutsu"/>
            </MastheadBrand>
          </MastheadMain>
          <MastheadContent>
            {headerTools}
          </MastheadContent>
        </Masthead>
      </React.Fragment>
    );
  }
}
