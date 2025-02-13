import React from 'react';
import PropTypes from 'prop-types';

import {
  ActionGroup,
  Alert,
  Button,
  Card,
  CardBody,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  MenuToggle,
  PageSection,
  PageSectionVariants,
  Select,
  SelectList,
  SelectOption,
  TextInput,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Title
} from '@patternfly/react-core';
import { Link } from 'react-router-dom';

import { TimesIcon } from '@patternfly/react-icons';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { dashboardToOption } from '../../utilities.js';


function userToOption (user) {
  if (!user) {
    return '';
  }
  return {
    user: user,
    toString: function () { return this.user.name; },
    compareTo: function (value) {
      if (value.user) {
        return this.user.id === value.user.id;
      }
      return this.user.name.toLowerCase().includes(value.toLowerCase()) ||
        this.user.email.includes(value.toLowerCase());
    }
  };
}

export class ProjectEdit extends React.Component {
  static propTypes = {
    params: PropTypes.object,
    location: PropTypes.object,
    navigate: PropTypes.func,
  };

  constructor (props) {
    super(props);
    this.state = {
      id: props.params.id,
      project: {},
      filteredUsers: [],
      users: [],
      isOwnerOpen: false,
      selectedOwner: {},
      filterValueOwner: '',
      inputValueOwner: '',
      filteredDashboards: [],
      dashboards: [],
      isDashboardOpen: false,
      selectedDashboard: null,
      filterValueDashboard: '',
      inputValueDashboard: '',
    };
  }

  onProjectNameChanged = (value) => {
    const { project } = this.state;
    project.name = value;
    this.setState({project});
  };

  onProjectTitleChanged = (value) => {
    const { project } = this.state;
    project.title = value;
    this.setState({project});
  };

  onSubmitClick = () => {
    const { project, selectedOwner, selectedDashboard } = this.state;
    project.owner_id = selectedOwner ? selectedOwner.id : null;
    project.default_dashboard_id = selectedDashboard ? selectedDashboard.id : null;
    delete project.owner;
    // delete project.defaultDashboard;
    this.saveProject(project.id || null, project)
      .then(() => this.props.navigate(-1))
      .catch((error) => console.error(error));
  };

  onOwnerToggle = () => {
    this.setState({isOwnerOpen: !this.state.isOwnerOpen});
  };

  onDashboardToggle = () => {
    this.setState({isDashboardOpen: !this.state.isDashboardOpen});
  };

  onOwnerInputChange = (_event, value) => {
    this.setState({inputValueOwner: value});
    this.setState({filterValueOwner: value});
  };

  onOwnerSelect = (event, value) => {
    this.setState({
      selectedOwner: value.user,
      isOwnerOpen: false,
      filterValueOwner: '',
      inputValueOwner: value.user.name
    });
  };

  onOwnerClear = () => {
    this.setState({
      selectedOwner: null,
      inputValueOwner: '',
      filterValueOwner: ''
    });
  };

  getProject (projectId) {
    HttpClient.get([Settings.serverUrl, 'admin', 'project', projectId])
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        return response.json();
      })
      .then(project => {
        this.setState({project: project, selectedOwner: project.owner,
          inputValueOwner: project.owner?.name,
          selectedDashboard: project.defaultDashboard,
          inputValueDashboard: project.defaultDashboard?.title});
      })
      .catch(error => console.error(error));
  }

  onDashboardSelect = (event, value) => {
    this.setState({
      selectedDashboard: value.dashboard,
      isDashboardOpen: false,
      filterValueDashboard: '',
      inputValueDashboard: value.dashboard.title
    });
  };

  onDashboardClear = () => {
    this.setState({
      selectedDashboard: null,
      inputValueDashboard: '',
      filterValueDashboard: ''
    });
  };

  onDashboardInputChange = (_event, value) => {
    this.setState({inputValueDashboard: value});
    this.setState({filterValueDashboard: value});
  };

  getDashboards () {
    if (!this.state.id || this.state.id == 'new' || !this.state.project) {
      return;
    }
    let params = {
      'project_id': this.state.id,
      'pageSize': 10
    };
    HttpClient.get([Settings.serverUrl, 'dashboard'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({dashboards: data['dashboards'], filteredDashboards: data['dashboards']}));
  }

  getUsers () {
    HttpClient.get([Settings.serverUrl, 'admin', 'user'])
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        return response.json();
      })
      .then(data => this.setState({users: data.users, filteredUsers: data.users}))
      .catch(error => console.error(error));
  }

  saveProject (projectId, project) {
    let request = null;
    if (!projectId) {
      request = HttpClient.post([Settings.serverUrl, 'admin', 'project'], project);
    }
    else {
      request = HttpClient.put([Settings.serverUrl, 'admin', 'project', projectId], {}, project);
    }
    return request.then(response => HttpClient.handleResponse(response, 'response'))
      .then(response => response.json());
  }

  componentDidMount () {
    if (this.state.id === 'new') {
      this.setState({project: {title: 'New project', name: 'new-project'}});
    }
    else {
      this.getProject(this.state.id);
      this.getDashboards();
    }
    this.getUsers();
  }

  componentDidUpdate (prevProps, prevState) {
    if (
      prevState.filterValueDashboard !== this.state.filterValueDashboard
    ) {
      let newSelectOptionsDashboard = this.state.dashboards;
      if (this.state.inputValueDashboard) {
        newSelectOptionsDashboard = this.state.dashboards.filter(menuItem =>
          String(menuItem.title).toLowerCase().includes(this.state.filterValueDashboard.toLowerCase())
        );
        if (newSelectOptionsDashboard.length === 0) {
          newSelectOptionsDashboard = [{
            isDisabled: true,
            value: {},
            title: `No results found for "${this.state.filterValueDashboard}"`,
          }];
        }

        if (!this.state.isDashboardOpen) {
          this.setState({ isDashboardOpen: true });
        }
      }

      this.setState({
        filteredDashboards: newSelectOptionsDashboard,
      });
    }

    if (
      prevState.filterValueOwner !== this.state.filterValueOwner
    ) {
      let newSelectOptionsUser = this.state.users;
      if (this.state.inputValueOwner) {
        newSelectOptionsUser = this.state.users.filter(menuItem =>
          String(menuItem.name).toLowerCase().includes(this.state.filterValueOwner.toLowerCase())
        );
        if (newSelectOptionsUser.length === 0) {
          newSelectOptionsUser = [{
            isDisabled: true,
            value: {},
            name: `No results found for "${this.state.filterValueOwner}"`,
          }];
        }

        if (!this.state.isOwnerOpen) {
          this.setState({ isOwnerOpen: true });
        }
      }

      this.setState({
        filteredUsers: newSelectOptionsUser,
      });
    }
  }


  render () {
    const { project, filteredUsers, selectedOwner, filteredDashboards, selectedDashboard, inputValueDashboard, inputValueOwner } = this.state;

    const toggleOwner = toggleRef => (
      <MenuToggle
        innerRef={toggleRef}
        variant="typeahead"
        aria-label="Typeahead menu toggle"
        onClick={this.onOwnerToggle}
        isExpanded={this.state.isOwnerOpen}
        isFullWidth
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={inputValueOwner}
            onClick={this.onOwnerToggle}
            onChange={this.onOwnerInputChange}
            id="typeahead-select-input"
            autoComplete="off"
            placeholder="Select project owner"
            role="combobox"
            isExpanded={this.state.isOwnerOpen}
            aria-controls="select-typeahead-listbox"
          />
          <TextInputGroupUtilities>
            {(!!inputValueOwner) && (
              <Button
                variant="plain"
                onClick={() => {
                  this.onOwnerClear();
                }}
                aria-label="Clear input value"
              >
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    );

    const toggleDashboard = toggleRef => (
      <MenuToggle
        innerRef={toggleRef}
        variant="typeahead"
        aria-label="Typeahead menu toggle"
        onClick={this.onDashboardToggle}
        isExpanded={this.state.isDashboardOpen}
        isFullWidth
        isDisabled={filteredDashboards.length === 0 ? true : false }
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={inputValueDashboard}
            onClick={this.onDashboardToggle}
            onChange={this.onDashboardInputChange}
            id="typeahead-select-input"
            autoComplete="off"
            placeholder="Select dashboard"
            role="combobox"
            isExpanded={this.state.isDashboardOpen}
            aria-controls="select-typeahead-listbox"
          />
          <TextInputGroupUtilities>
            {(!!inputValueDashboard) && (
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
    );

    return (
      <React.Fragment>
        <PageSection variant={PageSectionVariants.light}>
          <Title headingLevel="h1" size='2xl' className="pf-v5-c-title">
            Projects / {project && project.title}
          </Title>
        </PageSection>
        <PageSection>
          {!project && <Alert variant="info" title="Loading..." />}
          {project &&
          <Card>
            <CardBody>
              <Form>
                <FormGroup label="Title" isRequired fieldId="projectTitle">
                  <TextInput
                    isRequired
                    type="text"
                    id="projectTitle"
                    name="projectTitle"
                    aria-describedby="The project's friendly name"
                    value={project.title || ''}
                    onChange={(_event, value) => this.onProjectTitleChanged(value)}
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>The project&lsquo;s friendly name</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label="Name" isRequired fieldId="projectName">
                  <TextInput
                    isRequired
                    type="text"
                    id="projectName"
                    name="projectName"
                    aria-describedby="The project's machine name"
                    value={project.name || ''}
                    onChange={(_event, value) => this.onProjectNameChanged(value)}
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>The project&lsquo;s machine name</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup fieldId="owner" label="Owner">
                  <Select
                    id="typeahead-select-owner"
                    isOpen={this.state.isOwnerOpen}
                    selected={selectedOwner}
                    onSelect={this.onOwnerSelect}
                    onOpenChange={() => this.setState({isOwnerOpen: false})}
                    toggle={toggleOwner}
                  >
                    <SelectList id="select-typeahead-listbox">
                      {filteredUsers.map((user, index) => (
                        <SelectOption
                          key={user.id || index}
                          onClick={() => this.setState({selectedOwner: user})}
                          value={userToOption(user)}
                          description={user.email}
                          isDisabled={user.isDisabled}
                          ref={null}
                        >
                          {user.name}
                        </SelectOption>
                      ))}
                    </SelectList>
                  </Select>
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>The user who owns the project</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup fieldId="default-dashboard" label="Default dashboard">
                  <Select
                    id="typeahead-select-dashboard"
                    isOpen={this.state.isDashboardOpen}
                    selected={selectedDashboard}
                    onSelect={this.onDashboardSelect}
                    onOpenChange={() => this.setState({isDashboardOpen: false})}
                    toggle={toggleDashboard}
                  >
                    <SelectList id="select-typeahead-listbox">
                      {filteredDashboards.map((dashboard, index) => (
                        <SelectOption
                          key={dashboard.id || index}
                          onClick={() => this.setState({selectedDashboard: dashboard})}
                          value={dashboardToOption(dashboard)}
                          description={dashboard.description}
                          isDisabled={dashboard.isDisabled}
                          ref={null}
                        >
                          {dashboard.title}
                        </SelectOption>
                      ))}
                    </SelectList>
                  </Select>
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>The default dashboard for the project</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <ActionGroup>
                  <Button
                    variant="primary"
                    ouiaId="admin-project-edit-save"
                    onClick={this.onSubmitClick}
                  >
                    Submit
                  </Button>
                  <Button
                    variant="secondary"
                    ouiaId="admin-project-edit-cancel"
                    component={(props) => <Link {...props} to="/admin/projects" />}
                  >
                    Cancel
                  </Button>
                </ActionGroup>
              </Form>
            </CardBody>
          </Card>
          }
        </PageSection>
      </React.Fragment>
    );
  }
}
