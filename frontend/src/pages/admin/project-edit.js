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
  PageSection,
  PageSectionVariants,
  Select,
  SelectVariant,
  SelectOption,
  TextInput,
  Title
} from '@patternfly/react-core';
import { Link } from 'react-router-dom';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { dashboardToOption } from '../../utilities.js';


function userToOption(user) {
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
    match: PropTypes.object,
    history: PropTypes.object,
    location: PropTypes.object
  };

  constructor(props) {
    super(props);
    this.state = {
      id: props.match.params.id,
      project: null,
      users: [],
      owner: null,
      isOwnerOpen: false,
      userFilter: '',
      dashboards: [],
      isDashboardOpen: false,
      selectedDashboard: null,
      dashboardFilter: ''
    };
  }

  onProjectNameChanged = (value) => {
    const { project } = this.state;
    project.name = value;
    this.setState({project});
  }

  onProjectTitleChanged = (value) => {
    const { project } = this.state;
    project.title = value;
    this.setState({project});
  }

  onSubmitClick = () => {
    const { project, owner, selectedDashboard } = this.state;
    project.owner_id = owner && owner.user ? owner.user.id : null;
    project.default_dashboard_id = selectedDashboard && selectedDashboard.dashboard ?
      selectedDashboard.dashboard.id : null;
    delete project.owner;
    // delete project.defaultDashboard;
    this.saveProject(project.id || null, project)
      .then(() => this.props.history.goBack())
      .catch((error) => console.error(error));
  };

  onOwnerToggle = (isOpen) => {
    this.setState({isOwnerOpen: isOpen});
  };

  onOwnerSelect = (event, value, isPlaceholder) => {
    if (isPlaceholder) {
      this.onOwnerClear();
    }
    else {
      this.setState({owner: value, isOwnerOpen: false});
    }
  };

  onOwnerClear = () => {
    this.setState({
      owner: null,
      isOwnerOpen: false
    });
  }

  onOwnerChanged = (value) => {
    this.setState({userFilter: value}, this.getUsers);
  }

  getProject(projectId) {
    HttpClient.get([Settings.serverUrl, 'admin', 'project', projectId])
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        return response.json();
      })
      .then(project => {
        this.setState({project: project, owner: userToOption(project.owner),
                       selectedDashboard: dashboardToOption(project.defaultDashboard)});
      })
      .catch(error => console.error(error));
  }

  onDashboardToggle = (isOpen) => {
    this.setState({isDashboardOpen: isOpen});
  };

  onDashboardSelect = (event, value, isPlaceholder) => {
    if (isPlaceholder) {
      this.onDashboardClear();
      return;
    }
    this.setState({
      selectedDashboard: value,
      isDashboardOpen: false
    });
  };

  onDashboardClear = () => {
    this.setState({
      selectedDashboard: null,
      isDashboardOpen: false
    });
  }

  onDashboardChanged = (value) => {
    this.setState({dashboardFilter: value}, this.getDashboards);
  }

  getDashboards() {
    let params = {
      'project_id': this.state.id,
      'pageSize': 10
    };
    if (this.state.dashboardFilter) {
      params['filter'] = ['title%' + this.state.dashboardFilter];
    }
    HttpClient.get([Settings.serverUrl, 'dashboard'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({dashboards: data['dashboards']}));
  }

  getUsers() {
    const params = {};
    if (this.state.userFilter) {
      params['filter'] = ['name%' + this.state.userFilter];
    }
    HttpClient.get([Settings.serverUrl, 'admin', 'user'], params)
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        return response.json();
      })
      .then(data => this.setState({users: data.users}))
      .catch(error => console.error(error));
  }

  saveProject(projectId, project) {
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

  componentDidMount() {
    if (this.state.id === 'new') {
      this.setState({project: {title: 'New project', name: 'new-project'}});
    }
    else {
      this.getProject(this.state.id);
    }
    this.getDashboards();
    this.getUsers();
  }

  render() {
    const { project, users, owner, dashboards, selectedDashboard } = this.state;
    return (
      <React.Fragment>
        <PageSection variant={PageSectionVariants.light}>
          <Title headingLevel="h1" size='2xl' className="pf-c-title">
            Projects / {project && project.title}
          </Title>
        </PageSection>
        <PageSection>
          {!project && <Alert variant="info" title="Loading..." />}
          {project &&
          <Card>
            <CardBody>
              <Form>
                <FormGroup label="Title" isRequired fieldId="projectTitle" helperText="The project's friendly name">
                  <TextInput
                    isRequired
                    type="text"
                    id="projectTitle"
                    name="projectTitle"
                    aria-describedby="The project's friendly name"
                    value={project.title}
                    onChange={this.onProjectTitleChanged}
                  />
                </FormGroup>
                <FormGroup label="Name" isRequired fieldId="projectName" helperText="The project's machine name">
                  <TextInput
                    isRequired
                    type="text"
                    id="projectName"
                    name="projectName"
                    aria-describedby="The project's machine name"
                    value={project.name}
                    onChange={this.onProjectNameChanged}
                  />
                </FormGroup>
                <FormGroup fieldId="owner" label="Owner" helperText="The user who owns the project">
                   <Select
                     variant={SelectVariant.typeahead}
                     typeAheadAriaLabel="Select user"
                     onToggle={this.onOwnerToggle}
                     onSelect={this.onOwnerSelect}
                     onClear={this.onOwnerClear}
                     onTypeaheadInputChanged={this.onOwnerChanged}
                     selections={owner}
                     isOpen={this.state.isOwnerOpen}
                     aria-labelledby="owner"
                     placeholderText="Select user"
                   >
                     {users.map(user => (
                       <SelectOption key={user.id} value={userToOption(user)} description={user.email} />
                     ))}
                   </Select>
                </FormGroup>
                <FormGroup fieldId="default-dashboard" label="Default dashboard" helperText="The default dashboard for the project">
                   <Select
                     variant={SelectVariant.typeahead}
                     typeAheadAriaLabel="Select dashboard"
                     onToggle={this.onDashboardToggle}
                     onSelect={this.onDashboardSelect}
                     onClear={this.onDashboardClear}
                     onTypeaheadInputChanged={this.onDashboardChanged}
                     selections={selectedDashboard}
                     isOpen={this.state.isDashboardOpen}
                     aria-labelledby="default-dashboard"
                     placeholderText="Select dashboard"
                   >
                     {dashboards.map(dashboard => (
                       <SelectOption key={dashboard.id} value={dashboardToOption(dashboard)} description={dashboard.description} />
                     ))}
                   </Select>
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
                    component={(props: any) => <Link {...props} to="/admin/projects" />}
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
