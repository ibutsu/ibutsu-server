import React, { useEffect, useState } from 'react';

import {
  Button,
  Card,
  CardBody,
  Flex,
  FlexItem,
  Modal,
  PageSection,
  PageSectionVariants,
  Text,
  TextContent,
  TextInput
} from '@patternfly/react-core';
import { PencilAltIcon, PlusCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import { getSpinnerRow } from '../../utilities';
import { FilterTable } from '../../components/filtertable';
import { EmptyObject } from '../../components';

const COLUMNS = ['Title', 'Name', 'Owner', ''];

const ProjectList = () => {
  const [filterText, setFilterText] = useState('');
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [activeFilters, setActiveFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [projects, setProjects] = useState([]);

  const [totalItems, setTotalItems] = useState(0);
  const [isError, setIsError] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [selectedProject, setSelectedProject] = useState();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const projectToRow = (project) => {
    const shutupEslint = {'cells': [
      {title: project.title},
      {title: project.name},
      {title: project.owner && project.owner.name},
      {
        title: (
          <div style={{textAlign: 'right'}}>
            <Button
              variant="primary"
              ouiaId={`admin-projects-edit-${project.id}`}
              component={(props) => <Link {...props} to={`/admin/projects/${project.id}`} />}
              size="sm"
            >
              <PencilAltIcon />
            </Button>
            &nbsp;
            <Button
              variant="danger"
              ouiaId={`admin-projects-delete-${project.id}`}
              onClick={() => {
                setSelectedProject(project);
                setIsDeleteModalOpen(true);
              }}
              size="sm"
            >
              <TrashIcon />
            </Button>
          </div>
        )
      }
    ]};
    return(shutupEslint);
  };

  const onModalDeleteClick = () => {
    setIsDeleting(true);
    HttpClient.delete([Settings.serverUrl, 'admin', 'project', selectedProject.id])
      .then(response => HttpClient.handleResponse(response))
      .then(() => {
        setIsDeleteModalOpen(false);
        setIsDeleting(false);

      });
  };

  useEffect(() => {
    // handle input value changing for project filter
    let newProjects = projects;
    if (filterText && projects) {
      newProjects = projects.filter(p =>
        String(p.title).toLowerCase().includes(filterText.toLowerCase())
      );

      if (newProjects.length === 0) {
        newProjects = [{
          isDisabled: true,
          value: {},
          title: `No results found for "${filterText}"`,
        }];
      }
    }
    setFilteredProjects(newProjects);
  }, [filterText, projects]);

  useEffect(() => {
    HttpClient.get([Settings.serverUrl, 'admin', 'project'], {page: page, pageSize: pageSize})
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        setIsError(false);
        if (data?.projects) {
          setIsEmpty(false);
          setProjects(data.projects);
          setPage(data.pagination.page);
          setPageSize(data.pagination.pageSize);
          setTotalItems(data.pagination.totalItems);
          setIsEmpty(data.pagination.totalItems === 0);
        } else {
          setIsEmpty(true);
        }
      })
      .catch((error) => {
        console.error('Error fetching projects data:', error);
        setFilteredProjects([]);
        setIsError(true);
      });
  }, [page, pageSize, isDeleting]); // isDeleteing so the projects fetch after delete

  const onFilterChange = (_event, value) => {
    setFilterText(value);
    setActiveFilters(value ? {'title': value} : {});
  };

  const onDeleteClose = () => {
    setIsDeleteModalOpen(false);
  };

  document.title = 'Projects - Administration | Ibutsu';
  return (
    <React.Fragment>
      <PageSection id="page" variant={PageSectionVariants.light}>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <Flex>
            <FlexItem spacer={{ default: 'spacerLg' }}>
              <TextContent>
                <Text className="title" component="h1" ouiaId="admin-projects">Projects</Text>
              </TextContent>
            </FlexItem>
          </Flex>
          <Flex>
            <FlexItem>
              <Button
                aria-label="Add project"
                variant="secondary"
                title="Add project"
                ouiaId="admin-projects-add"
                component={(props) => <Link {...props} to="/admin/projects/new" />}
              >
                <PlusCircleIcon /> Add Project
              </Button>
            </FlexItem>
          </Flex>
        </Flex>
      </PageSection>
      <PageSection className="pf-u-pb-0">
        {!isEmpty &&
        <Card>
          <CardBody className="pf-u-p-0">
            <FilterTable
              columns={COLUMNS}
              rows={filteredProjects ? filteredProjects.map((p) => projectToRow(p)) : [getSpinnerRow(4)]}
              activeFilters={activeFilters}
              filters={[
                <TextInput
                  type="text"
                  id="filter"
                  placeholder="Search for project..."
                  value={filterText}
                  onChange={onFilterChange}
                  style={{height: 'inherit'}}
                  key="filterText"
                />
              ]}
              pagination={{
                pageSize: pageSize,
                page: page,
                totalItems: totalItems
              }}
              isEmpty={isEmpty}
              isError={isError}
              onSetPage={(_event, value) => {setPage(value);}}
              onSetPageSize={(_event, value) => {setPageSize(value);}}
            />
          </CardBody>
        </Card>
        }
        {isEmpty && !filterText && <EmptyObject headingText='No Projects found' bodyText='Create your first project' returnLink='/admin/projects/new' returnLinkText='Add Project'/>}
      </PageSection>
      <Modal
        title="Confirm Delete"
        variant="small"
        isOpen={isDeleteModalOpen}
        onClose={onDeleteClose}
        actions={[
          <Button
            key="delete"
            variant="danger"
            ouiaId="admin-projects-modal-delete"
            isLoading={isDeleting}
            isDisabled={isDeleting}
            onClick={onModalDeleteClick}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>,
          <Button
            key="cancel"
            variant="secondary"
            ouiaId="admin-projects-modal-cancel"
            isDisabled={isDeleting}
            onClick={onDeleteClose}
          >
            Cancel
          </Button>
        ]}
      >
        Are you sure you want to delete &ldquo;{selectedProject && selectedProject.title}&rdquo;? This cannot be undone!
      </Modal>
    </React.Fragment>
  );
};

ProjectList.propTypes = {};

export default ProjectList;
