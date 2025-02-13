import React, { useEffect, useState } from 'react';

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
  Title,
  ValidatedOptions
} from '@patternfly/react-core';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { TimesIcon } from '@patternfly/react-icons';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { dashboardToOption } from '../../utilities.js';


const userToOption = (user) => {
  if (!user) {
    return '';
  }
  return {
    user: user,
    toString: function () { return user.name; },
    compareTo: function (value) {
      if (value.user) {
        return user.id === value.user.id;
      }
      return user.name.toLowerCase().includes(value.toLowerCase()) ||
        user.email.includes(value.toLowerCase());
    }
  };
};

const ProjectEdit = () => {

  const params = useParams();
  const navigate = useNavigate();

  // project title and name states, required
  const [id, setId] = useState();
  const [title, setTitle] = useState('');
  const [crumbTitle, setCrumbTitle] = useState('');
  const [titleValid, setTitleValid] = useState(false);
  const [name, setName] = useState('');
  const [nameValid, setNameValid] = useState(false);


  // owner selection state
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [isOwnerOpen, setIsOwnerOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState({});
  const [filterValueOwner, setFilterValueOwner] = useState('');
  const [inputValueOwner, setInputValueOwner] = useState('');

  // dashboard selection state
  const [filteredDashboards, setFilteredDashboards] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState();
  const [filterValueDashboard, setFilterValueDashboard] = useState('');
  const [inputValueDashboard, setInputValueDashboard] = useState('');

  // sync URL and the state
  useEffect(() => {
    setId(params.id);
  }, [params]);

  const onSubmitClick = () => {
    let project = {
      title: title,
      name: name,
      owner_id: selectedOwner ? selectedOwner.id : null,
      default_dashboard_id: selectedDashboard ? selectedDashboard.id : null,
    };

    let request = null;
    if (id === 'new') {
      request = HttpClient.post([Settings.serverUrl, 'admin', 'project'], project);
    }
    else {
      request = HttpClient.put([Settings.serverUrl, 'admin', 'project', id], {}, project);
    }
    request.then(response => HttpClient.handleResponse(response))
      .then(() => navigate(-1))
      .catch((error) => console.error(error));
  };

  const onOwnerInputChange = (_event, value) => {
    setInputValueOwner(value);
    setFilterValueOwner(value);
  };

  const onOwnerSelect = (event, value) => {
    setSelectedOwner(value.user);
    setIsOwnerOpen(false);
    setFilterValueOwner('');
    setInputValueOwner(value.user.name);
  };

  const onOwnerClear = () => {
    setSelectedOwner(null);
    setFilterValueOwner('');
    setInputValueOwner('');
  };

  const onDashboardSelect = (event, value) => {
    setSelectedDashboard(value.dashboard);
    setIsDashboardOpen(false);
    setFilterValueDashboard('');
    setInputValueDashboard(value.dashboard.title);
  };

  const onDashboardClear = () => {
    setSelectedDashboard(null);
    setInputValueDashboard('');
    setFilterValueDashboard('');
  };

  const onDashboardInputChange = (_event, value) => {
    setInputValueDashboard(value);
    setFilterValueDashboard(value);
  };

  // fetch the admin users once
  useEffect(() => {
    HttpClient.get([Settings.serverUrl, 'admin', 'user'])
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        setUsers(data.users);
        setFilteredUsers(data.users);
      })
      .catch(error => console.error(error));
  }, []);

  // fetch the project if needed
  useEffect(() => {
    if (id === 'new') {
      setTitle('New project');
      setName('new-project');
    } else if (id) {
      HttpClient.get([Settings.serverUrl, 'admin', 'project', id])
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          setTitle(data.title);
          setCrumbTitle(data.title);
          setName(data.name);
          setSelectedOwner(data.owner);
          setInputValueOwner(data.owner?.name);
          setSelectedDashboard(data.defaultDashboard);
          setInputValueDashboard(data.defaultDashboard?.title);
        })
        .catch(error => {
          console.error(error);
          navigate('/admin/projects');
        });
    }
  }, [id, navigate]);

  // validate Title
  useEffect(() => {
    setTitleValid(title !== '');
  }, [title]);

  // validate Name
  useEffect(() => {
    setNameValid(name !== '');
  }, [name]);

  // get dashboards for the project
  useEffect(() => {
    if (id && id !== 'new') {
      HttpClient.get([Settings.serverUrl, 'dashboard'], {
        'project_id': id,
        'pageSize': 10
      })
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          setDashboards(data['dashboards']);
          setFilteredDashboards(data['dashboards']);
        })
        .catch(error => console.error(error));
    }
  }, [id]);

  // update dashboard filtering and selection items
  useEffect(() => {
    let newSelectOptionsDashboard = [...dashboards];
    if (inputValueDashboard) {
      newSelectOptionsDashboard = dashboards.filter(menuItem =>
        String(menuItem.title).toLowerCase().includes(filterValueDashboard.toLowerCase())
      );
      if (newSelectOptionsDashboard.length === 0) {
        newSelectOptionsDashboard = [{
          isDisabled: true,
          value: {},
          title: `No results found for "${filterValueDashboard}"`,
        }];
      }
    }
    setFilteredDashboards(newSelectOptionsDashboard);
  }, [dashboards, filterValueDashboard, inputValueDashboard, isDashboardOpen]);

  // update owner filtering and selection items
  useEffect(() => {
    let newSelectOptionsUser = [...users];
    if (inputValueOwner) {
      newSelectOptionsUser = users.filter(menuItem =>
        String(menuItem.name).toLowerCase().includes(filterValueOwner.toLowerCase())
      );
      if (newSelectOptionsUser.length === 0) {
        newSelectOptionsUser = [{
          isDisabled: true,
          value: {},
          name: `No results found for "${filterValueOwner}"`,
        }];
      }
    }
    setFilteredUsers(newSelectOptionsUser);
  }, [filterValueOwner, inputValueOwner, isOwnerOpen, users]);

  const toggleOwner = (toggleRef) => (
    <MenuToggle
      innerRef={toggleRef}
      variant="typeahead"
      aria-label="Typeahead menu toggle"
      onClick={() => {setIsOwnerOpen(!isOwnerOpen);}}
      isExpanded={isOwnerOpen}
      isFullWidth
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={inputValueOwner}
          onClick={() => {setIsOwnerOpen(!isOwnerOpen);}}
          onChange={onOwnerInputChange}
          id="typeahead-select-input"
          autoComplete="off"
          placeholder="Select project owner"
          role="combobox"
          isExpanded={isOwnerOpen}
          aria-controls="select-typeahead-listbox"
        />
        <TextInputGroupUtilities>
          {(!!inputValueOwner) && (
            <Button
              variant="plain"
              onClick={onOwnerClear}
              aria-label="Clear input value"
            >
              <TimesIcon aria-hidden />
            </Button>
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  const toggleDashboard = (toggleRef) => (
    <MenuToggle
      innerRef={toggleRef}
      variant="typeahead"
      aria-label="Typeahead menu toggle"
      onClick={() => {setIsDashboardOpen(!isDashboardOpen);}}
      isExpanded={isDashboardOpen}
      isFullWidth
      isDisabled={filteredDashboards.length === 0 ? true : false }
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={inputValueDashboard}
          onClick={() => {setIsDashboardOpen(!isDashboardOpen);}}
          onChange={onDashboardInputChange}
          id="typeahead-select-input"
          autoComplete="off"
          placeholder="Select dashboard"
          role="combobox"
          isExpanded={isDashboardOpen}
          aria-controls="select-typeahead-listbox"
        />
        <TextInputGroupUtilities>
          {(!!inputValueDashboard) && (
            <Button
              variant="plain"
              onClick={onDashboardClear}
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
          Projects / {crumbTitle}
        </Title>
      </PageSection>
      <PageSection>
        {!title && <Alert variant="info" title="Loading..." />}
        <Card>
          <CardBody>
            <Form>
              <FormGroup label="Title" isRequired fieldId="projectTitle">
                <TextInput
                  isRequired
                  type="text"
                  id="projectTitle"
                  name="projectTitle"
                  aria-describedby="The project display name"
                  value={title}
                  onChange={(_event, value) => setTitle(value)}
                  validated={titleValid ? ValidatedOptions.default : ValidatedOptions.error}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>The project display name</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <FormGroup label="Name" isRequired fieldId="projectName">
                <TextInput
                  isRequired
                  type="text"
                  id="projectName"
                  name="projectName"
                  aria-describedby="The project machine name"
                  value={name}
                  onChange={(_event, value) => setName(value)}
                  validated={nameValid ? ValidatedOptions.default : ValidatedOptions.error}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>The project machine name</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <FormGroup fieldId="owner" label="Owner">
                <Select
                  id="typeahead-select-owner"
                  isOpen={isOwnerOpen}
                  selected={selectedOwner}
                  onSelect={onOwnerSelect}
                  onOpenChange={() => setIsOwnerOpen(false)}
                  toggle={toggleOwner}
                >
                  <SelectList id="select-typeahead-listbox">
                    {filteredUsers?.map((user, index) => (
                      <SelectOption
                        key={user.id || index}
                        onClick={() => setSelectedOwner(user)}
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
                  isOpen={isDashboardOpen}
                  selected={selectedDashboard}
                  onSelect={onDashboardSelect}
                  onOpenChange={() => setIsDashboardOpen(false)}
                  toggle={toggleDashboard}
                >
                  <SelectList id="select-typeahead-listbox">
                    {filteredDashboards.map((dashboard, index) => (
                      <SelectOption
                        key={dashboard.id || index}
                        onClick={() => setSelectedDashboard(dashboard)}
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
                  onClick={onSubmitClick}
                  disabled={titleValid && nameValid}
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
      </PageSection>
    </React.Fragment>
  );
};

ProjectEdit.propTypes = {};

export default ProjectEdit;
