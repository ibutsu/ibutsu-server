import React, { useState, useEffect, useCallback } from 'react';

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
  TextInput,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Title,
  Select,
  SelectOption,
} from '@patternfly/react-core';

import { TimesIcon } from '@patternfly/react-icons';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { projectToOption } from '../../utilities';
import { useNavigate, useParams } from 'react-router-dom';

const UserEdit = () => {
  const params = useParams();
  const navigate = useNavigate();

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formActive, setFormActive] = useState(false);
  const [formAdmin, setFormAdmin] = useState(false);
  const [formProjects, setFormProjects] = useState([]);

  const [userLoaded, setUserLoaded] = useState(false);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const onSubmitClick = useCallback(() => {
    const submitCall = async () => {
      try {
        await HttpClient.put(
          [Settings.serverUrl, 'admin', 'user', params?.id],
          {},
          {
            name: formName,
            email: formEmail,
            is_active: formActive,
            is_superadmin: formAdmin,
            projects: formProjects?.map(
              (projectOption) => projectOption.project,
            ),
          },
        );
        navigate('/admin/users', { replace: true });
      } catch (error) {
        console.error('Error updating user: ', error);
      }
    };

    submitCall();
  }, [
    formActive,
    formAdmin,
    formEmail,
    formName,
    formProjects,
    navigate,
    params?.id,
  ]);

  const onProjectsSelect = useCallback(
    (_, value) => {
      // compareTo comes from the object from ProjecttoOption utility
      if (formProjects?.find((item) => item.compareTo(value))) {
        setFormProjects((prevProjects) =>
          prevProjects.filter((item) => !item.compareTo(value)),
        );
      } else {
        setFormProjects((prevProjects) => [...prevProjects, value]);
      }
    },
    [formProjects],
  );

  const onProjectsClear = useCallback(() => {
    setFormProjects([]);
    setIsProjectsOpen(false);
    setInputValue('');
  }, []);

  useEffect(() => {
    // get user once
    const getUser = async () => {
      try {
        const response = await HttpClient.get([
          Settings.serverUrl,
          'admin',
          'user',
          params?.id,
        ]);
        const data = await HttpClient.handleResponse(response);
        if (data) {
          setFormName(data.name || '');
          setFormEmail(data.email || '');
          setFormActive(data.is_active);
          setFormAdmin(data.is_superadmin);
          setFormProjects(data.projects?.map(projectToOption) || []);
          setUserLoaded(true);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setUserLoaded(false);
      }
    };
    if (params?.id) {
      getUser();
    }
  }, [params.id]);

  useEffect(() => {
    // fetch projects once
    const fetchProjects = async () => {
      try {
        const response = await HttpClient.get([
          Settings.serverUrl,
          'admin',
          'project',
        ]);
        const data = await HttpClient.handleResponse(response);
        if (data && data.projects) {
          setProjects(data.projects);
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
        setProjects([]);
      }
    };

    const debouncer = setTimeout(() => {
      fetchProjects();
    }, 100);
    return () => clearTimeout(debouncer);
  }, []);

  useEffect(() => {
    // handle input value changing for project filter
    let newProjectOptions = projects;
    if (inputValue) {
      newProjectOptions = projects?.filter((menuItem) =>
        String(menuItem.title).toLowerCase().includes(inputValue.toLowerCase()),
      );

      if (newProjectOptions.length === 0) {
        newProjectOptions = [
          {
            isDisabled: true,
            value: {},
            title: `No results found for "${inputValue}"`,
          },
        ];
      }

      if (!isProjectsOpen) {
        setIsProjectsOpen(true);
      }
    }
    setFilteredProjects(newProjectOptions);
  }, [inputValue, projects, isProjectsOpen]);

  const toggle = useCallback(
    (toggleRef) => (
      <MenuToggle
        variant="typeahead"
        aria-label="Multi typeahead menu toggle"
        onClick={() => setIsProjectsOpen(!isProjectsOpen)}
        innerRef={toggleRef}
        isExpanded={isProjectsOpen}
        isFullWidth
      >
        <TextInputGroup isPlain>
          <TextInputGroupMain
            value={inputValue}
            onClick={() => setIsProjectsOpen(!isProjectsOpen)}
            onChange={(_, value) => setInputValue(value)}
            id="multi-typeahead-select-input"
            autoComplete="off"
            placeholder="Select one or more projects"
            role="combobox"
            isExpanded={isProjectsOpen}
            aria-controls="select-multi-typeahead-listbox"
          >
            <ChipGroup aria-label="Current selections">
              {formProjects?.map((userProject, index) => (
                <Chip
                  key={index}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onProjectsSelect(ev, userProject);
                  }}
                >
                  {userProject.project.title}
                </Chip>
              ))}
            </ChipGroup>
          </TextInputGroupMain>
          <TextInputGroupUtilities>
            {(formProjects?.length > 0 || inputValue !== '') && (
              <Button
                variant="plain"
                onClick={onProjectsClear}
                aria-label="Clear input value"
              >
                <TimesIcon aria-hidden />
              </Button>
            )}
          </TextInputGroupUtilities>
        </TextInputGroup>
      </MenuToggle>
    ),
    [
      formProjects,
      inputValue,
      isProjectsOpen,
      onProjectsClear,
      onProjectsSelect,
    ],
  );

  const handleProjectClick = (value) => {
    setIsProjectsOpen(value);
  };

  return (
    <React.Fragment>
      <PageSection variant={PageSectionVariants.light}>
        <Title headingLevel="h1" size="2xl" className="pf-v5-c-title">
          Users / {formName}{' '}
          {formAdmin && (
            <Label className="super-admin-label" variant="outline" color="blue">
              Administrator
            </Label>
          )}
        </Title>
      </PageSection>
      <PageSection>
        {!userLoaded && <Alert variant="info" title="Loading..." />}
        {userLoaded && (
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
                    value={formName}
                    onChange={(_, value) => setFormName(value)}
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
                    value={formEmail}
                    onChange={(_, value) => setFormEmail(value)}
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>
                        The user&apos;s e-mail address
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label="User status" fieldId="userStatus">
                  <Checkbox
                    label="Is active"
                    id="userIsActive"
                    name="userIsActive"
                    aria-label="User is active"
                    isChecked={formActive}
                    onChange={(_, checked) => setFormActive(checked)}
                  />
                  <Checkbox
                    label="Is administrator"
                    id="userIsAdmin"
                    name="userIsAdmin"
                    aria-label="User is administrator"
                    isChecked={formAdmin}
                    onChange={(_, checked) => setFormAdmin(checked)}
                  />
                </FormGroup>
                <FormGroup label="Projects" fieldId="userProjects">
                  <Select
                    id="projectSelect"
                    isOpen={isProjectsOpen}
                    selected={formProjects}
                    onSelect={onProjectsSelect}
                    onOpenChange={handleProjectClick}
                    toggle={toggle}
                    variant="multi-typeahead-select"
                  >
                    {projects?.length === 0 && inputValue === '' && (
                      <SelectOption
                        isDisabled={true}
                        description="To create your first project, navigate to projects and click on 'Add project'"
                      >
                        No projects exists
                      </SelectOption>
                    )}
                    {filteredProjects?.map((project, index) => (
                      <SelectOption
                        key={index}
                        value={projectToOption(project)}
                        description={project.name}
                        isDisabled={project.isDisabled}
                        ref={null}
                      >
                        {project.title}
                      </SelectOption>
                    ))}
                  </Select>
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>
                        The projects to which a user has access
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <ActionGroup>
                  <Button variant="primary" onClick={onSubmitClick}>
                    Submit
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate('/admin/users')}
                  >
                    Cancel
                  </Button>
                </ActionGroup>
              </Form>
            </CardBody>
          </Card>
        )}
      </PageSection>
    </React.Fragment>
  );
};

export default UserEdit;
