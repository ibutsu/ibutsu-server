import React, { useContext, useEffect, useState } from 'react';

import {
  Button,
  Flex,
  FlexItem,
  Modal,
  PageSection,
  PageSectionVariants,
  Text,
  TextContent,
} from '@patternfly/react-core';
import {
  PencilAltIcon,
  PlusCircleIcon,
  TrashIcon,
} from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import { HttpClient } from '../../services/http';
import { Settings } from '../../settings';
import FilterTable from '../../components/filtering/filtered-table-card';
import EmptyObject from '../../components/empty-object';
import usePagination from '../../components/hooks/usePagination';
import { FilterContext } from '../../components/contexts/filterContext';
import AdminFilter from '../../components/filtering/admin-filter';
import { filtersToAPIParams } from '../../utilities';

const COLUMNS = ['Title', 'Name', 'Owner', ''];

const ProjectList = () => {
  const { page, setPage, pageSize, setPageSize, totalItems, setTotalItems } =
    usePagination({});

  const [anyProjects, setAnyProjects] = useState(true);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState();

  const [isError, setIsError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { activeFilters, clearFilters } = useContext(FilterContext);

  const projectToRow = (project) => ({
    cells: [
      { title: project.title },
      { title: project.name },
      { title: project.owner?.name || project.owner?.email },
      {
        title: (
          <div style={{ textAlign: 'right' }}>
            <Button
              variant="primary"
              ouiaId={`admin-projects-edit-${project.id}`}
              component={(props) => (
                <Link {...props} to={`/admin/projects/${project.id}`} />
              )}
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
        ),
      },
    ],
  });

  const onModalDeleteClick = () => {
    setIsDeleting(true);
    HttpClient.delete([
      Settings.serverUrl,
      'admin',
      'project',
      selectedProject.id,
    ])
      .then((response) => HttpClient.handleResponse(response))
      .then(() => {
        setIsDeleteModalOpen(false);
        setIsDeleting(false);
      });
  };

  useEffect(() => {
    const apiParams = {
      page: page,
      pageSize: pageSize,
      filter: filtersToAPIParams(activeFilters),
    };
    HttpClient.get([Settings.serverUrl, 'admin', 'project'], apiParams)
      .then((response) => HttpClient.handleResponse(response))
      .then((data) => {
        setIsError(false);
        if (data?.projects) {
          if (activeFilters?.length === 0) {
            // set total projects boolean only if we fetched with no filters
            setAnyProjects(true);
          }
          setFilteredProjects(
            data.projects.map((project) => projectToRow(project)),
          );
          setPage(data.pagination.page.toString());
          setPageSize(data.pagination.pageSize.toString());
          setTotalItems(data.pagination.totalItems);
        }
      })
      .catch((error) => {
        console.error('Error fetching projects data:', error);
        setFilteredProjects([]);
        setIsError(true);
      });
  }, [
    page,
    pageSize,
    isDeleting,
    setPage,
    setPageSize,
    setTotalItems,
    activeFilters,
  ]); // isDeleteing so the projects fetch after delete

  const onDeleteClose = () => {
    setIsDeleteModalOpen(false);
  };

  useEffect(() => {
    document.title = 'Projects - Administration | Ibutsu';
  }, []);

  return (
    <React.Fragment>
      <PageSection id="page" variant={PageSectionVariants.light}>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <Flex>
            <FlexItem spacer={{ default: 'spacerLg' }}>
              <TextContent>
                <Text className="title" component="h1" ouiaId="admin-projects">
                  Projects
                </Text>
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
                component={(props) => (
                  <Link {...props} to="/admin/projects/new" />
                )}
              >
                <PlusCircleIcon /> Add Project
              </Button>
            </FlexItem>
          </Flex>
        </Flex>
      </PageSection>
      <PageSection className="pf-u-pb-0">
        {anyProjects && (
          <FilterTable
            columns={COLUMNS}
            rows={filteredProjects}
            filters={<AdminFilter />}
            pageSize={pageSize}
            page={page}
            totalItems={totalItems}
            isError={isError}
            onClearFilters={clearFilters}
            onSetPage={setPage}
            onSetPageSize={setPageSize}
          />
        )}
        {!anyProjects && (
          <EmptyObject
            headingText="No Projects found"
            bodyText="Create your first project"
            returnLink="/admin/projects/new"
            returnLinkText="Add Project"
          />
        )}
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
          </Button>,
        ]}
      >
        Are you sure you want to delete &ldquo;
        {selectedProject && selectedProject.title}&rdquo;? This cannot be
        undone!
      </Modal>
    </React.Fragment>
  );
};

ProjectList.propTypes = {};

export default ProjectList;
