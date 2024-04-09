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
import { MONITOR_UPLOAD_TIMEOUT } from '../constants';
import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { getActiveProject, getTheme, setTheme } from '../utilities';


export class IbutsuHeader extends React.Component {
  static propTypes = {
    eventEmitter: PropTypes.object,
    navigate: PropTypes.func,
    version: PropTypes.string
  }

  constructor(props) {
    super(props);
    let project = getActiveProject();
    this.eventEmitter = props.eventEmitter;

    this.state = {
      uploadFileName: '',
      importId: '',
      monitorUploadId: null,
      isAboutOpen: false,
      isProjectSelectorOpen: false,
      selectedProject: project || '',
      inputValue: project?.title || '',
      filterValue: '',
      projects: [],
      filteredProjects: [],
      isDarkTheme: getTheme() === 'dark',
      version: props.version
    };
  }

  showNotification(type, title, message, action = null, timeout = null, key = null) {
    if (!this.eventEmitter) {
      return;
    }
    this.eventEmitter.emit('showNotification', type, title, message, action, timeout, key);
  }

  emitProjectChange() {
    if (!this.eventEmitter) {
      return;
    }
    this.eventEmitter.emit('projectChange');
  }

  emitThemeChange() {
    if (!this.eventEmitter) {
      return;
    }
    this.eventEmitter.emit('themeChange');
  }

  getProjects() {
    const params = {pageSize: 10};
    if (this.state.filterValue) {
      params['filter'] = ['title%' + this.state.filterValue];
    }
    HttpClient.get([Settings.serverUrl, 'project'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({projects: data['projects'], filteredProjects: data['projects']}));
  }

  onBeforeUpload = (files) => {
    for (var i = 0; i < files.length; i++) {
      this.showNotification('info', 'File Uploaded', files[i].name + ' has been uploaded, importing will start momentarily.');
    }
  }

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
  }

  monitorUpload = () => {
    HttpClient.get([Settings.serverUrl, 'import', this.state.importId])
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        if (data['status'] === 'done') {
          clearInterval(this.state.monitorUploadId);
          this.setState({monitorUploadId: null});
          let action = null;
          if (data.metadata.run_id) {
            const RunButton = () => (
              <AlertActionLink onClick={() => {this.props.navigate('/runs/' + data.metadata.run_id)}}>
                Go to Run
              </AlertActionLink>
            )
            action = <RunButton />;
          }
          this.showNotification('success', 'Import Complete', `${data.filename} has been successfully imported as run ${data.metadata.run_id}`, action);
        }
      });
  }

  onProjectToggle = () => {
    this.setState({isProjectSelectorOpen: !this.state.isProjectSelectorOpen});
  };

  onProjectSelect = (_event, value) => {
    const activeProject = getActiveProject();
    if (activeProject && activeProject.id === value.id) {
      this.setState({
        isProjectSelectorOpen: false,
        inputValue: value.title,
        filterValue: ''
      });
      return;
    }

    const project = JSON.stringify(value);
    localStorage.setItem('project', project);
    this.setState({
      selectedProject: value,
      isProjectSelectorOpen: false,
      inputValue: value.title,
      filterValue: ''
    });
    this.emitProjectChange();
  };

  onProjectClear = () => {
    localStorage.removeItem('project');
    this.setState({
      selectedProject: '',
      isProjectSelectorOpen: false,
      inputValue: '',
      filterValue: ''
    }, this.getProjects);
    this.emitProjectChange();
  }

  onTextInputChange = (_event, value) => {
    this.setState({
      inputValue: value,
      filterValue: value
    }, this.getProjects);
  };

  toggleAbout = () => {
    this.setState({isAboutOpen: !this.state.isAboutOpen});
  };

  onThemeChanged = (isChecked) => {
    setTheme(isChecked ? 'dark' : 'light');
    this.setState({isDarkTheme: isChecked}, this.emitThemeChange);
  }

  componentWillUnmount() {
    if (this.state.monitorUploadId) {
      clearInterval(this.state.monitorUploadId);
    }
  }

  componentDidMount() {
    this.getProjects();
  }

  componentDidUpdate(prevProps, prevState) {
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
          onChange={this.onTextInputChange}
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
              this.onProjectClear()
            }} aria-label="Clear input value">
              <TimesIcon aria-hidden />
            </Button>
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  render() {
    document.title = 'Ibutsu';
    const apiUiUrl = Settings.serverUrl + '/ui/';
    const uploadParams = {};
    const {
      selectedProject,
      projects,
      filteredProjects,
      filterValue,
    } = this.state;

    if (selectedProject) {
      uploadParams['project'] = selectedProject.id;
    }
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
              <Button aria-label="About" onClick={this.toggleAbout} variant={ButtonVariant.plain} icon={<QuestionCircleIcon />} />
            </ToolbarItem>
            <ToolbarItem>
              <FileUpload component="button" className="pf-v5-c-button pf-m-plain" isUnstyled name="importFile" url={`${Settings.serverUrl}/import`} params={uploadParams} multiple={false} beforeUpload={this.onBeforeUpload} afterUpload={this.onAfterUpload} title="Import xUnit XML or Ibutsu Archive"><UploadIcon /> Import</FileUpload>
            </ToolbarItem>
            <ToolbarItem>
              <a href={apiUiUrl} className="pf-v5-c-button pf-m-plain" target="_blank" rel="noopener noreferrer"><ServerIcon/> API</a>
            </ToolbarItem>
            <ToolbarItem>
              <Switch id="dark-theme" label={<MoonIcon />} isChecked={this.state.isDarkTheme} onChange={(_event, isChecked) => this.onThemeChanged(isChecked)} />
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
    );
  }
}
