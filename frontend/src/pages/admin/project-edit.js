import React, { useContext, useEffect, useState } from 'react';

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
  Select,
  SelectList,
  SelectOption,
  TextInput,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Title,
  ValidatedOptions,
} from '@patternfly/react-core';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { nanoid } from 'nanoid/non-secure';

import { TimesIcon } from '@patternfly/react-icons';

import { HttpClient } from '../../utilities/http';
import { Settings } from '../settings';
import { dashboardToOption, filtersToAPIParams } from '../../utilities';
import { FilterContext } from '../../components/contexts/filter-context';
import AdminFilter from '../../components/filtering/admin-filter';

const userToOption = (user) => {
  if (!user) {
    return '';
  }
  return {
    user: user,
    toString: () => user.name,
    compareTo: (value) => {
      if (value.user) {
        return user.id === value.user.id;
      }
      return (
        user.name.toLowerCase().includes(value.toLowerCase()) ||
        user.email.includes(value.toLowerCase())
      );
    },
  };
};

const ProjectEdit = () => {
  const params = useParams();
  const navigate = useNavigate();

  // is project new or existing
  const [isNewProject, setIsNewProject] = useState(false);

  // project title and name states, required
  const [id, setId] = useState();
  const [title, setTitle] = useState('');
  const [crumbTitle, setCrumbTitle] = useState('');
  const [titleValid, setTitleValid] = useState(false);
  const [name, setName] = useState('');
  const [nameValid, setNameValid] = useState(false);

  // owner selection state
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isOwnerOpen, setIsOwnerOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState({});

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
    setIsNewProject(params.id === 'new');
  }, [params]);

  const onSubmitClick = async () => {
    let project = {
      title: title,
      name: name,
      owner_id: selectedOwner?.id || null,
      default_dashboard_id: selectedDashboard?.id || null,
    };

    let request = null;
    try {
      if (isNewProject) {
        request = await HttpClient.post(
          [Settings.serverUrl, 'admin', 'project'],
          project,
        );
      } else {
        request = await HttpClient.put(
          [Settings.serverUrl, 'admin', 'project', id],
          {},
          project,
        );
      }
      await HttpClient.handleResponse(request);
    } catch (error) {
      console.error('Failed to POST/PUT project: ', error);
    }
    navigate('/admin/projects', { replace: true });
  };

  const onOwnerSelect = (_, value) => {
    setSelectedOwner(value.user);
    setIsOwnerOpen(false);
  };

  const onDashboardSelect = (_, value) => {
    setSelectedDashboard(value.dashboard);
    setIsDashboardOpen(false);
    setFilterValueDashboard(value.dashboard.title);
    setInputValueDashboard(value.dashboard.title);
  };

  const onDashboardClear = () => {
    setSelectedDashboard(null);
    setInputValueDashboard('');
    setFilterValueDashboard('');
  };

  const onDashboardInputChange = (_, value) => {
    setInputValueDashboard(value);
    setFilterValueDashboard(value);
  };

  const { activeFilters } = useContext(FilterContext);

  // fetch the admin users with the active filter
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'admin', 'user'],
          {
            ...(Object.keys(activeFilters)?.length === 0
              ? {}
              : { filter: filtersToAPIParams(activeFilters) }),
          },
        );
        const data = await HttpClient.handleResponse(response);
        setFilteredUsers(data.users);
      } catch (error) {
        console.error('Failed to fetch users: ', error);
      }
    };

    const debouncer = setTimeout(() => {
      fetchUsers();
    }, 100);
    return () => {
      clearTimeout(debouncer);
    };
  }, [activeFilters]);

  // fetch the project if needed
  useEffect(() => {
    const fetchProjectAdmin = async () => {
      try {
        const response = await HttpClient.get([
          Settings.serverUrl,
          'admin',
          'project',
          id,
        ]);
        const data = await HttpClient.handleResponse(response);
        setTitle(data.title);
        setCrumbTitle(data.title);
        setName(data.name);
        setSelectedOwner(data.owner);
        setSelectedDashboard(data.defaultDashboard);
        setInputValueDashboard(data.defaultDashboard?.title);
      } catch (error) {
        console.error('Failed to fetch project: ', error);
        navigate('/admin/projects');
      }
    };
    // if the project is new, set the title and name
    if (id === 'new') {
      setTitle('New project');
      setName(`new-project-${nanoid(6)}`);
    } else if (id) {
      fetchProjectAdmin();
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
    const fetchDashboards = async () => {
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'dashboard'],
          { project_id: id },
        );
        const data = await HttpClient.handleResponse(response);
        setDashboards(data['dashboards']);
        setFilteredDashboards(data['dashboards']);
      } catch (error) {
        console.error('Failed to fetch dashboards: ', error);
      }
    };

    if (id && id !== 'new') {
      const debouncer = setTimeout(() => {
        fetchDashboards();
      }, 100);
      return () => {
        clearTimeout(debouncer);
      };
    }
  }, [id]);

  // update dashboard filtering and selection items
  useEffect(() => {
    let newSelectOptionsDashboard = [...dashboards];
    if (inputValueDashboard) {
      newSelectOptionsDashboard = dashboards.filter((menuItem) =>
        String(menuItem.title)
          .toLowerCase()
          .includes(filterValueDashboard.toLowerCase()),
      );
      if (newSelectOptionsDashboard.length === 0) {
        newSelectOptionsDashboard = [
          {
            isDisabled: true,
            value: {},
            title: `No results found for "${filterValueDashboard}"`,
          },
        ];
      }
    }
    setFilteredDashboards(newSelectOptionsDashboard);
  }, [dashboards, filterValueDashboard, inputValueDashboard, isDashboardOpen]);

  const toggleOwner = (toggleRef) => (
    <MenuToggle
      innerRef={toggleRef}
      variant="secondary"
      aria-label="Owner selection toggle"
      onClick={() => {
        setIsOwnerOpen(!isOwnerOpen);
      }}
      isExpanded={isOwnerOpen}
      isDisabled={isNewProject}
    >
      {selectedOwner?.name ||
        selectedOwner?.email ||
        'Use a filter to select an owner'}
    </MenuToggle>
  );

  const toggleDashboard = (toggleRef) => (
    <MenuToggle
      innerRef={toggleRef}
      variant="typeahead"
      aria-label="Typeahead menu toggle"
      onClick={() => {
        setIsDashboardOpen(!isDashboardOpen);
      }}
      isExpanded={isDashboardOpen}
      isDisabled={filteredDashboards.length === 0 ? true : false}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={inputValueDashboard}
          onClick={() => {
            setIsDashboardOpen(!isDashboardOpen);
          }}
          onChange={onDashboardInputChange}
          id="typeahead-select-input"
          autoComplete="off"
          placeholder="Select dashboard"
          role="combobox"
          isExpanded={isDashboardOpen}
          aria-controls="select-typeahead-listbox"
        />
        <TextInputGroupUtilities>
          {!!inputValueDashboard && (
            <Button
              icon={<TimesIcon aria-hidden />}
              variant="plain"
              onClick={onDashboardClear}
              aria-label="Clear input value"
            />
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <React.Fragment>
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel="h1" size="2xl">
          {isNewProject ? 'Add Project' : 'Projects / ' + crumbTitle}
        </Title>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
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
                  onChange={(_, value) => setTitle(value)}
                  validated={
                    titleValid
                      ? ValidatedOptions.default
                      : ValidatedOptions.error
                  }
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
                  onChange={(_, value) => setName(value)}
                  validated={
                    nameValid
                      ? ValidatedOptions.default
                      : ValidatedOptions.error
                  }
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>The project machine name</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <FormGroup fieldId="owner" label="Owner">
                <Select
                  id="projectOwner"
                  ouiaId="project-edit-owner-select"
                  isOpen={isOwnerOpen}
                  selected={selectedOwner}
                  onSelect={onOwnerSelect}
                  onOpenChange={() => setIsOwnerOpen(false)}
                  toggle={toggleOwner}
                  isScrollable={true}
                  variant="default"
                >
                  <SelectList>
                    {filteredUsers?.map((user, index) => (
                      <SelectOption
                        key={user.id || index}
                        onClick={() => setSelectedOwner(user)}
                        value={userToOption(user)}
                        description={user.email}
                        isDisabled={user.isDisabled}
                        ref={null}
                      >
                        {user.name || user.email}
                      </SelectOption>
                    ))}
                  </SelectList>
                </Select>
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>
                      {isNewProject
                        ? 'Owner of the new project is set to the user who created it. This can be changed later by editing the project.'
                        : 'The user who owns the project. Use the filter to narrow the selection options above.'}
                      {!isNewProject && <AdminFilter />}
                    </HelperTextItem>
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
                  isScrollable={true}
                  variant="typeahead"
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
                    <HelperTextItem>
                      The default dashboard for the project
                    </HelperTextItem>
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
                  component={(props) => (
                    <Link {...props} to="/admin/projects" />
                  )}
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
