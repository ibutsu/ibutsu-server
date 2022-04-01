import React from 'react';
import PropTypes from 'prop-types';

import {
  ActionGroup,
  Alert,
  Button,
  Card,
  CardBody,
  Checkbox,
  Form,
  FormGroup,
  Label,
  PageSection,
  PageSectionVariants,
  Select,
  SelectVariant,
  SelectOption,
  TextInput,
  Title
} from '@patternfly/react-core';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { projectToOption } from '../../utilities';


export class UserEdit extends React.Component {
  static propTypes = {
    match: PropTypes.object,
    history: PropTypes.object,
    location: PropTypes.object
  };

  constructor(props) {
    super(props);
    this.state = {
      id: props.match.params.id,
      user: null,
      projects: [],
      userProjects: [],
      isProjectsOpen: false
    };
  }

  onUserNameChanged = (value) => {
    const { user } = this.state;
    user.name = value;
    this.setState({user});
  }

  onUserEmailChanged = (value) => {
    const { user } = this.state;
    user.email = value;
    this.setState({user});
  }

  onIsActiveToggle = (checked) => {
    const { user } = this.state;
    user.is_active = checked;
    this.setState({user});
  };

  onIsAdminToggle = (checked) => {
    const { user } = this.state;
    user.is_superadmin = checked;
    this.setState({user});
  };

  onSubmitClick = () => {
    const { user, userProjects } = this.state;
    user.projects = userProjects.map((projectOption) => projectOption.project);
    this.saveUser(user.id, user)
      .then(() => this.props.history.goBack())
      .catch((error) => console.log(error));
  };

  onProjectsToggle = (isOpen) => {
    this.setState({isProjectsOpen: isOpen});
  };

  onProjectsSelect = (event, value) => {
    const { userProjects } = this.state;
    if (userProjects.filter(item => item.compareTo(value)).length !== 0) {
      this.setState(
        prevState => ({userProjects: prevState.userProjects.filter(item => !item.compareTo(value))})
      );
    }
    else {
      this.setState(
        prevState => ({userProjects: [...prevState.userProjects, value]})
      );
    }
  };

  onProjectsClear = () => {
    this.setState({
      userProjects: [],
      isProjectsOpen: false
    });
  }

  getUser(userId) {
    HttpClient.get([Settings.serverUrl, 'admin', 'user', userId])
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        return response.json();
      })
      .then(user => this.setState({user: user, userProjects: user.projects.map(projectToOption)}))
      .catch(error => console.error(error));
  }

  getProjects() {
    HttpClient.get([Settings.serverUrl, 'admin', 'project'])
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        return response.json();
      })
      .then(data => this.setState({projects: data.projects}))
      .catch(error => console.error(error));
  }

  saveUser(userId, user) {
    return HttpClient.put([Settings.serverUrl, 'admin', 'user', userId], {}, user)
      .then(response => HttpClient.handleResponse(response, 'response'))
      .then(response => response.json());
  }

  componentDidMount() {
    this.getUser(this.state.id);
    this.getProjects();
  }

  render() {
    const { user, projects, userProjects } = this.state;
    return (
      <React.Fragment>
        <PageSection variant={PageSectionVariants.light}>
          <Title headingLevel="h1" size='2xl' className="pf-c-title">
            Users / {user && user.name} {' '}
            {user && user.is_superadmin &&
              <Label className="super-admin-label" variant="outline" color="blue">Administrator</Label>
            }
          </Title>
        </PageSection>
        <PageSection>
          {!user && <Alert variant="info" title="Loading..." />}
          {user &&
          <Card>
            <CardBody>
              <Form>
                <FormGroup label="Name" isRequired fieldId="userName" helperText="The user's name">
                  <TextInput
                    isRequired
                    type="text"
                    id="userName"
                    name="userName"
                    aria-describedby="The user's name"
                    value={user.name}
                    onChange={this.onUserNameChanged}
                  />
                </FormGroup>
                <FormGroup label="E-mail" isRequired fieldId="userEmail" helperText="The user's e-mail address">
                  <TextInput
                    isRequired
                    type="email"
                    id="userEmail"
                    name="userEmail"
                    aria-describedby="The user's e-mail address"
                    value={user.email}
                    onChange={this.onUserEmailChanged}
                  />
                </FormGroup>
                <FormGroup fieldId="userStatus" label="User status">
                  <Checkbox
                    label="Is active"
                    id="userIsActive"
                    name="userIsActive"
                    aria-label="User is active"
                    isChecked={user.is_active}
                    onChange={this.onIsActiveToggle}
                  />
                  <Checkbox
                    label="Is administrator"
                    id="userIsAdmin"
                    name="userIsAdmin"
                    aria-label="User is administrator"
                    isChecked={user.is_superadmin}
                    onChange={this.onIsAdminToggle}
                  />
                </FormGroup>
                <FormGroup fieldId="userProjects" label="Projects" helperText="The projects to which a user has access">
                   <Select
                     variant={SelectVariant.typeaheadMulti}
                     typeAheadAriaLabel="Select one or more projects"
                     onToggle={this.onProjectsToggle}
                     onSelect={this.onProjectsSelect}
                     onClear={this.onProjectsClear}
                     selections={userProjects}
                     isOpen={this.state.isProjectsOpen}
                     aria-labelledby="userProjects"
                     placeholderText="Select one or more projects"
                   >
                     {projects.map(project => (
                       <SelectOption key={project.id} value={projectToOption(project)} description={project.name} />
                     ))}
                   </Select>
                </FormGroup>
                <ActionGroup>
                  <Button variant="primary" onClick={this.onSubmitClick}>Submit</Button>
                  <Button variant="secondary" onClick={this.props.history.goBack}>Cancel</Button>
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
