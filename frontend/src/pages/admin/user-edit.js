import React from 'react';
import PropTypes from 'prop-types';

import {
  ActionGroup,
  Alert,
  Button,
  Card,
  CardBody,
  Checkbox,
  Chip,
  ChipGroup,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Label,
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

import { TimesIcon } from '@patternfly/react-icons';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { projectToOption } from '../../utilities';


export class UserEdit extends React.Component {
  static propTypes = {
    params: PropTypes.object,
    location: PropTypes.object,
    navigate: PropTypes.func,
  };

  constructor (props) {
    super(props);
    this.state = {
      id: props.params.id,
      user: null,
      filteredProjects: [],
      projects: [],
      userProjects: [],
      isProjectsOpen: false,
      inputValue: '',
    };
  }

  onUserNameChanged = (value) => {
    const { user } = this.state;
    user.name = value;
    this.setState({user});
  };

  onUserEmailChanged = (value) => {
    const { user } = this.state;
    user.email = value;
    this.setState({user});
  };

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
      .then(() => this.props.navigate(-1))
      .catch((error) => console.log(error));
  };

  onProjectsToggle = () => {
    this.setState({isProjectsOpen: !this.state.isProjectsOpen});
  };

  onProjectsSelect = (_event, value) => {
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
      isProjectsOpen: false,
      inputValue: ''
    });
  };

  getUser (userId) {
    HttpClient.get([Settings.serverUrl, 'admin', 'user', userId])
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        return response.json();
      })
      .then(user => this.setState({user: user, userProjects: user.projects.map(projectToOption)}))
      .catch(error => console.error(error));
  }

  getProjects () {
    HttpClient.get([Settings.serverUrl, 'admin', 'project'])
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        return response.json();
      })
      .then(data => this.setState({projects: data.projects, filteredProjects: data.projects}))
      .catch(error => console.error(error));
  }

  saveUser (userId, user) {
    return HttpClient.put([Settings.serverUrl, 'admin', 'user', userId], {}, user)
      .then(response => HttpClient.handleResponse(response, 'response'))
      .then(response => response.json());
  }

  goBack = () => {
    this.props.navigate(-1);
  };

  onTextInputChange = (_event, value) => {
    this.setState({inputValue: value});
  };

  componentDidMount () {
    this.getUser(this.state.id);
    this.getProjects();
  }

  componentDidUpdate (prevProps, prevState) {
    if (
      prevState.inputValue !== this.state.inputValue
    ) {
      let newSelectOptions = this.state.projects;
      if (this.state.inputValue) {
        newSelectOptions = this.state.projects.filter(menuItem =>
          String(menuItem.title).toLowerCase().includes(this.state.inputValue.toLowerCase())
        );

        if (newSelectOptions.length === 0) {
          newSelectOptions = [{
            isDisabled: true,
            value: {},
            title: `No results found for "${this.state.inputValue}"`,
          }];
        }

        if (!this.state.isProjectsOpen) {
          this.setState({ isProjectsOpen: true });
        }
      }

      this.setState({
        filteredProjects: newSelectOptions,
      });
    }
  }

  render () {
    const { projects, inputValue, filteredProjects, user, userProjects } = this.state;

    const toggle = toggleRef => (
      <MenuToggle
        variant="typeahead"
        aria-label="Multi typeahead menu toggle"
        onClick={this.onProjectsToggle}
        innerRef={toggleRef}
        isExpanded={this.state.isProjectsOpen}
        isFullWidth
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={inputValue}
            onClick={this.onProjectsToggle}
            onChange={this.onTextInputChange}
            id="multi-typeahead-select-input"
            autoComplete="off"
            placeholder="Select one or more projects"
            role="combobox"
            isExpanded={this.state.isProjectsOpen}
            aria-controls="select-multi-typeahead-listbox"
          >
            <ChipGroup aria-label="Current selections">
              {userProjects.map((userProject, index) => (
                <Chip
                  key={index}
                  onClick={ev => {
                    ev.stopPropagation();
                    this.onProjectsSelect(ev, userProject);
                  }}
                >
                  {userProject.project.title}
                </Chip>
              ))}
            </ChipGroup>
          </TextInputGroupMain>
          <TextInputGroupUtilities>
            {(userProjects.length > 0 || inputValue !== '') && (
              <Button
                variant="plain"
                onClick={() => {
                  this.onProjectsClear();
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
                <FormGroup label="Name" isRequired fieldId="userName">
                  <TextInput
                    isRequired
                    type="text"
                    id="userName"
                    name="userName"
                    aria-describedby="The user's name"
                    value={user.name}
                    onChange={(_event, value) => this.onUserNameChanged(value)}
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>The user&apos;s name</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label="E-mail" isRequired fieldId="userEmail">
                  <TextInput
                    isRequired
                    type="email"
                    id="userEmail"
                    name="userEmail"
                    aria-describedby="The user's e-mail address"
                    value={user.email}
                    onChange={(_event, value) => this.onUserEmailChanged(value)}
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>The user&apos;s e-mail address</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup fieldId="userStatus" label="User status">
                  <Checkbox
                    label="Is active"
                    id="userIsActive"
                    name="userIsActive"
                    aria-label="User is active"
                    isChecked={user.is_active}
                    onChange={(_event, checked) => this.onIsActiveToggle(checked)}
                  />
                  <Checkbox
                    label="Is administrator"
                    id="userIsAdmin"
                    name="userIsAdmin"
                    aria-label="User is administrator"
                    isChecked={user.is_superadmin}
                    onChange={(_event, checked) => this.onIsAdminToggle(checked)}
                  />
                </FormGroup>
                <FormGroup fieldId="userProjects" label="Projects">
                  <Select
                    id="multi-typeahead-select"
                    isOpen={this.state.isProjectsOpen}
                    selected={userProjects}
                    onSelect={this.onProjectsSelect}
                    onOpenChange={() => this.setState({isProjectsOpen: false})}
                    toggle={toggle}
                  >
                    <SelectList isAriaMultiselectable id="select-multi-typeahead-listbox">
                      {(projects.length === 0 && inputValue === '') && (
                        <SelectOption
                          isDisabled={true}
                          description="To create your first project, navigate to projects and click on 'Add project'"
                        >
                      No projects exists
                        </SelectOption>
                      )}
                      {filteredProjects.map((project, index) => (
                        <SelectOption
                          key={project.id || index}
                          value={projectToOption(project)}
                          description={project.name}
                          isDisabled={project.isDisabled}
                          ref={null}
                        >
                          {project.title}
                        </SelectOption>
                      ))}
                    </SelectList>
                  </Select>
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>The projects to which a user has access</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <ActionGroup>
                  <Button variant="primary" onClick={this.onSubmitClick}>Submit</Button>
                  <Button variant="secondary" onClick={this.goBack}>Cancel</Button>
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
