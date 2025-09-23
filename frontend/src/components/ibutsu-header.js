import { useContext, useEffect, useState } from 'react';
import {
  AboutModal,
  Brand,
  Button,
  ButtonVariant,
  Icon,
  Flex,
  FlexItem,
  Masthead,
  MastheadMain,
  MastheadLogo,
  MastheadToggle,
  MastheadBrand,
  MastheadContent,
  PageToggleButton,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  Content,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';

import BarsIcon from '@patternfly/react-icons/dist/esm/icons/bars-icon';
import MoonIcon from '@patternfly/react-icons/dist/esm/icons/moon-icon';
import SunIcon from '@patternfly/react-icons/dist/esm/icons/sun-icon';
import ServerIcon from '@patternfly/react-icons/dist/esm/icons/server-icon';
import TimesIcon from '@patternfly/react-icons/dist/esm/icons/times-icon';
import QuestionCircleIcon from '@patternfly/react-icons/dist/esm/icons/question-circle-icon';

import FileUpload from './file-upload';
import UserDropdown from './user-dropdown';
import { VERSION } from '../constants';
import { HttpClient } from '../utilities/http';
import { Settings } from '../pages/settings';
import { IbutsuContext } from './contexts/ibutsu-context';
import { useNavigate, useParams } from 'react-router-dom';
import { setDocumentDarkTheme } from '../utilities';

const IbutsuHeader = () => {
  // hooks
  const {
    setPrimaryObject,
    setPrimaryType,
    setDefaultDashboard,
    darkTheme,
    setDarkTheme,
  } = useContext(IbutsuContext);
  const params = useParams();
  const navigate = useNavigate();

  // states
  const [isProjectSelectOpen, setIsProjectSelectOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState();
  const [inputValue, setInputValue] = useState();
  const [filterValue, setFilterValue] = useState();
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isAboutOpen, setIsAboutOpen] = useState();
  const [endpoint] = useState('project'); // TODO: portal dashboard

  // values from hooks
  const { project_id } = params;

  useEffect(() => {
    // update projects/portals when the filter input changes
    // TODO: iterate over pages, fix controller filtering behavior to apply pageSize AFTER filter
    const fetchPrimary = async () => {
      let api_params = { pageSize: 20 };
      if (filterValue) {
        api_params['filter'] = [`title%${filterValue}`];
      }
      const response = await HttpClient.get(
        [Settings.serverUrl, endpoint],
        api_params,
      );
      const data = await HttpClient.handleResponse(response);
      setProjects(data[endpoint + 's']);
      setFilteredProjects(data[endpoint + 's']);
    };

    const debouncer = setTimeout(() => {
      fetchPrimary();
    }, 50);
    return () => clearTimeout(debouncer);
  }, [filterValue, endpoint]);

  useEffect(() => {
    setDocumentDarkTheme(darkTheme);
  }, [darkTheme]);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await HttpClient.get([
          Settings.serverUrl,
          '/project/',
          project_id,
        ]);
        const data = await HttpClient.handleResponse(response);
        setPrimaryObject(data);
        setPrimaryType('project');
        setDefaultDashboard(data.default_dashboard_id);
        setSelectedProject(data);
        setFilterValue();
        setInputValue(data.title);
        setIsProjectSelectOpen(false);
      } catch (error) {
        console.error('Error fetching project:', error);
      }
    };

    if (project_id && selectedProject?.id !== project_id) {
      const debouncer = setTimeout(() => {
        fetchProject();
      }, 50);

      return () => clearTimeout(debouncer);
    }
  }, [
    project_id,
    selectedProject,
    setDefaultDashboard,
    setPrimaryObject,
    setPrimaryType,
  ]);

  const onProjectSelect = (_, value) => {
    // update context
    setPrimaryObject(value);
    setPrimaryType('project');
    setDefaultDashboard(value.default_dashboard_id);

    // update state
    setSelectedProject(value);
    setIsProjectSelectOpen(false);
    setInputValue(value?.title);
    setFilterValue('');

    navigate(
      `/project/${value?.id}/dashboard/${value.default_dashboard_id || ''}`,
    );
  };

  const onProjectClear = () => {
    setPrimaryObject();
    setDefaultDashboard();

    setSelectedProject();
    setInputValue('');
    setFilterValue('');
    setIsProjectSelectOpen(false);

    navigate('/project/', { replace: true });
  };

  const onProjectTextInputChange = (_, value) => {
    setInputValue(value);
    setFilterValue(value);
  };

  const toggle = (toggleRef) => (
    <MenuToggle
      variant="typeahead"
      onClick={() => {
        setIsProjectSelectOpen(!isProjectSelectOpen);
      }}
      isExpanded={isProjectSelectOpen}
      isFullWidth
      innerRef={toggleRef}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={inputValue}
          onClick={() => {
            setIsProjectSelectOpen(!isProjectSelectOpen);
          }}
          onChange={onProjectTextInputChange}
          id="typeahead-select-input"
          name="project-select-input-toggle"
          autoComplete="off"
          placeholder="No active project"
          role="combobox"
          isExpanded={isProjectSelectOpen}
          aria-controls="select-typeahead-listbox"
        />
        <TextInputGroupUtilities>
          {!!inputValue && (
            <Button
              icon={<TimesIcon aria-hidden />}
              onClick={onProjectClear}
              aria-label="Clear input value"
            ></Button>
          )}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  const projectSelect = (
    <Flex>
      <FlexItem id="project-selector">
        <Select
          id="typeahead-select"
          isOpen={isProjectSelectOpen}
          selected={selectedProject}
          onSelect={onProjectSelect}
          onOpenChange={(isOpen) => {
            setIsProjectSelectOpen(isOpen);
          }}
          toggle={toggle}
        >
          <SelectList id="select-typeahead-listbox">
            {projects.length === 0 && !filterValue && (
              <SelectOption
                isDisabled={true}
                description="Ask Ibutsu admins to add you to a project"
              >
                No projects available
              </SelectOption>
            )}
            {projects.length === 0 && !!filterValue && (
              <SelectOption isDisabled={true}>
                {`No results found for "${filterValue}"`}
              </SelectOption>
            )}
            {filteredProjects.map((project, index) => (
              <SelectOption
                key={project.id || index}
                onClick={() => {
                  setSelectedProject(project);
                }}
                value={project}
                description={project.name}
                isDisabled={project.isDisabled}
              >
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
    <Toolbar id="toolbar" isFullHeight isStatic style={{ paddingLeft: '30px' }}>
      <ToolbarContent>
        <ToolbarGroup variant="filter-group">
          <ToolbarItem>{projectSelect}</ToolbarItem>
        </ToolbarGroup>
        <ToolbarGroup
          variant="action-group-plain"
          align={{
            default: 'alignEnd',
          }}
        >
          <ToolbarItem gap={{ default: 'gapSm' }}>
            <Button
              aria-label="About"
              onClick={() => {
                setIsAboutOpen(!isAboutOpen);
              }}
              variant={ButtonVariant.plain}
              icon={
                <Icon>
                  <QuestionCircleIcon />
                </Icon>
              }
            />
          </ToolbarItem>
          <ToolbarItem gap={{ default: 'gapSm' }}>
            <FileUpload />
          </ToolbarItem>
          <ToolbarItem gap={{ default: 'gapSm' }}>
            <Button
              component="a"
              href={Settings.serverUrl + '/ui/'}
              variant={ButtonVariant.tertiary}
              target="_blank"
              rel="noopener noreferrer"
              icon={
                <Icon>
                  <ServerIcon />
                </Icon>
              }
            >
              {' '}
              API
            </Button>
          </ToolbarItem>
          <ToolbarItem gap={{ default: 'gapSm' }}>
            <ToggleGroup>
              <ToggleGroupItem
                aria-label="Light theme"
                icon={
                  <Icon>
                    <SunIcon />
                  </Icon>
                }
                buttonId="theme-toggle-light"
                isSelected={!darkTheme}
                onChange={() => {
                  setDarkTheme(false);
                }}
              />
              <ToggleGroupItem
                aria-label="Dark theme"
                icon={
                  <Icon>
                    <MoonIcon />
                  </Icon>
                }
                buttonId="theme-toggle-dark"
                isSelected={darkTheme}
                onChange={() => {
                  setDarkTheme(true);
                }}
              />
            </ToggleGroup>
          </ToolbarItem>
          <ToolbarItem id="user-dropdown">
            <UserDropdown />
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );

  return (
    <>
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => {
          setIsAboutOpen(!isAboutOpen);
        }}
        brandImageSrc="/images/ibutsu.svg"
        brandImageAlt="Ibutsu"
        productName="Ibutsu"
        backgroundImageSrc="/images/about-bg.jpg"
        trademark="Copyright (c) 2021 Red Hat, Inc."
      >
        <Content>
          <Content component="dl">
            <Content component="dt">Version</Content>
            <Content component="dd">{VERSION}</Content>
            <Content component="dt">Source code</Content>
            <Content component="dd">
              <a
                href="https://github.com/ibutsu/ibutsu-server"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/ibutsu/ibutsu-server
              </a>
            </Content>
            <Content component="dt">Documentation</Content>
            <Content component="dd">
              <a
                href="https://docs.ibutsu-project.org/"
                target="_blank"
                rel="noopener noreferrer"
              >
                docs.ibutsu-project.org
              </a>
            </Content>
            <Content component="dt">Report bugs</Content>
            <Content component="dd">
              <a
                href="https://github.com/ibutsu/ibutsu-server/issues/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                Submit an issue
              </a>
            </Content>
          </Content>
        </Content>
        <p style={{ marginTop: '2rem' }}>
          * Note: artifact files (screenshots, logs) are retained for 3 months
        </p>
      </AboutModal>
      <Masthead>
        <MastheadMain>
          <MastheadToggle>
            <PageToggleButton
              variant="control"
              aria-label="Global navigation"
              id="vertical-nav-toggle"
            >
              <Icon>
                <BarsIcon />
              </Icon>
            </PageToggleButton>
          </MastheadToggle>
          <MastheadBrand data-codemods>
            <MastheadLogo data-codemods component="a" href="/">
              <Brand src="/images/ibutsu-wordart-164.png" alt="Ibutsu" />
            </MastheadLogo>
          </MastheadBrand>
        </MastheadMain>
        <MastheadContent>{headerTools}</MastheadContent>
      </Masthead>
    </>
  );
};

export default IbutsuHeader;
