import React from 'react';
import PropTypes from 'prop-types';

import {
  AboutModal,
  AlertActionLink,
  Brand,
  Button,
  Flex,
  FlexItem,
  PageHeader,
  Select,
  SelectOption,
  SelectVariant,
  PageHeaderTools,
  PageHeaderToolsGroup,
  PageHeaderToolsItem,
  Switch,
  TextContent,
  TextList,
  TextListItem
} from '@patternfly/react-core';
import { UploadIcon, ServerIcon, QuestionCircleIcon, MoonIcon } from '@patternfly/react-icons';
import { css } from '@patternfly/react-styles';
import accessibleStyles from '@patternfly/patternfly/utilities/Accessibility/accessibility.css';

import { Link, withRouter } from 'react-router-dom';

import { FileUpload, UserDropdown } from '../components';
import { MONITOR_UPLOAD_TIMEOUT } from '../constants';
import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { getActiveProject, getTheme, projectToOption, setTheme } from '../utilities';


export class IbutsuHeader extends React.Component {
  static propTypes = {
    eventEmitter: PropTypes.object,
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
      selectedProject: projectToOption(project),
      searchValue: '',
      projects: [],
      projectsFilter: '',
      isDarkTheme: getTheme() == 'dark',
      version: props.version
    };
  }

  showNotification(type, title, message, action?, timeout?, key?) {
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
    if (this.state.projectsFilter) {
      params['filter'] = ['title%' + this.state.projectsFilter];
    }
    HttpClient.get([Settings.serverUrl, 'project'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({projects: data['projects']}));
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
          if (data.run_id) {
            const RunButton = withRouter(({history}) => (
              <AlertActionLink onClick={() => {history.push('/runs/' + data.run_id)}}>
                Go to Run
              </AlertActionLink>
            ));
            action = <RunButton />;
          }
          this.showNotification('success', 'Import Complete', `${data.filename} has been successfully imported as run ${data.run_id}`, action);
        }
      });
  }

  onProjectToggle = (isOpen) => {
    this.setState({isProjectSelectorOpen: isOpen});
  };

  onProjectSelect = (event, value, isPlaceholder) => {
    if (isPlaceholder) {
      this.onProjectClear();
      return;
    }
    const project = JSON.stringify(value.project);
    localStorage.setItem('project', project);
    this.setState({
      selectedProject: value,
      isProjectSelectorOpen: false
    });
    this.emitProjectChange();
  };

  onProjectClear = () => {
    localStorage.removeItem('project');
    this.setState({
      selectedProject: null,
      isProjectSelectorOpen: false
    });
    this.emitProjectChange();
  }

  onProjectsChanged = (value) => {
    this.setState({projectsFilter: value}, this.getProjects);
  }

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

  render() {
    document.title = 'Ibutsu';
    const apiUiUrl = Settings.serverUrl + '/ui/';
    const uploadParams = {};
    if (this.state.selectedProject && this.state.selectedProject.project) {
      uploadParams['project'] = this.state.selectedProject.project.id;
    }
    const topNav = (
      <Flex>
        <FlexItem id="project-selector">
          <Select
            ariaLabelTypeAhead="Select a project"
            placeholderText="No active project"
            variant={SelectVariant.typeahead}
            isOpen={this.state.isProjectSelectorOpen}
            selections={this.state.selectedProject}
            onToggle={this.onProjectToggle}
            onSelect={this.onProjectSelect}
            onClear={this.onProjectClear}
            onTypeaheadInputChanged={this.onProjectsChanged}
            footer={this.state.projects.length == 10 && "Search for more..."}
          >
            {this.state.projects.map(project => (
              <SelectOption key={project.id} value={projectToOption(project)} description={project.name} />
            ))}
          </Select>
        </FlexItem>
      </Flex>
    );
    const headerTools = (
      <PageHeaderTools>
        <PageHeaderToolsGroup className={css(accessibleStyles.srOnly, accessibleStyles.visibleOnLg)}>
          <PageHeaderToolsItem>
            <Button variant="plain" onClick={this.toggleAbout}><QuestionCircleIcon /></Button>
          </PageHeaderToolsItem>
          <PageHeaderToolsItem>
            <FileUpload component="button" className="pf-c-button pf-m-plain" isUnstyled name="importFile" url={`${Settings.serverUrl}/import`} params={uploadParams} multiple={false} beforeUpload={this.onBeforeUpload} afterUpload={this.onAfterUpload} title="Import xUnit XML or Ibutsu Archive"><UploadIcon /> Import</FileUpload>
          </PageHeaderToolsItem>
          <PageHeaderToolsItem>
            <a href={apiUiUrl} className="pf-c-button pf-m-plain" target="_blank" rel="noopener noreferrer"><ServerIcon/> API</a>
          </PageHeaderToolsItem>
          <PageHeaderToolsItem>
            <Switch id="dark-theme" label={<MoonIcon />} isChecked={this.state.isDarkTheme} onChange={this.onThemeChanged} />
          </PageHeaderToolsItem>
          <PageHeaderToolsItem id="user-dropdown">
            <UserDropdown eventEmitter={this.eventEmitter}/>
          </PageHeaderToolsItem>
        </PageHeaderToolsGroup>
      </PageHeaderTools>
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
        <PageHeader
          logo={<Brand src="/images/ibutsu-wordart-164.png" alt="Ibutsu"/>}
          logoComponent={Link}
          logoProps={{to: '/'}}
          headerTools={headerTools}
          showNavToggle={true}
          topNav={topNav}
        />
      </React.Fragment>
    );
  }
}
