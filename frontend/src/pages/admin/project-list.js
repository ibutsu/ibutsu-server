import { useContext, useEffect, useState } from 'react';

import {
  Button,
  Flex,
  FlexItem,
  PageSection,
  Content,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core';
import {
  PencilAltIcon,
  PlusCircleIcon,
  TrashIcon,
} from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

import { HttpClient } from '../../utilities/http';
import { Settings } from '../settings';
import FilterTable from '../../components/filtering/filtered-table-card';
import EmptyObject from '../../components/empty-object';
import usePagination from '../../components/hooks/use-pagination';
import { FilterContext } from '../../components/contexts/filter-context';
import AdminFilter from '../../components/filtering/admin-filter';
import { filtersToAPIParams } from '../../utilities';

const COLUMNS = ['Title', 'Name', 'Owner', ''];

const ProjectList = () => {
  const {
    page,
    setPage,
    onSetPage,
    pageSize,
    setPageSize,
    onSetPageSize,
    totalItems,
    setTotalItems,
  } = usePagination({});

  const [anyProjects, setAnyProjects] = useState(true);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState();

  const [isError, setIsError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { activeFilters, clearFilters } = useContext(FilterContext);

  const projectToRow = (project) => ({
    id: project.id,
    cells: [
      project.title,
      project.name,
      project.owner?.name || project.owner?.email,
      <div style={{ textAlign: 'right' }} key="actions">
        <Button
          icon={<PencilAltIcon />}
          variant="primary"
          ouiaId={`admin-projects-edit-${project.id}`}
          component={(props) => (
            <Link {...props} to={`/admin/projects/${project.id}`} />
          )}
          size="sm"
        ></Button>
        &nbsp;
        <Button
          icon={<TrashIcon />}
          variant="danger"
          ouiaId={`admin-projects-delete-${project.id}`}
          onClick={() => {
            setSelectedProject(project);
            setIsDeleteModalOpen(true);
          }}
          size="sm"
        ></Button>
      </div>,
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

  // Fetch projects data from the API
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const filters = filtersToAPIParams(activeFilters);
        const apiParams = {
          page: page,
          pageSize: pageSize,
        };
        if (filters.length > 0) {
          apiParams.filter = filters.join(',');
        }
        const response = await HttpClient.get(
          [Settings.serverUrl, 'admin', 'project'],
          apiParams,
        );
        const data = await HttpClient.handleResponse(response);
        setIsError(false);
        if (data?.projects) {
          if (activeFilters?.length === 0) {
            // set total projects boolean only if we fetched with no filters
            setAnyProjects(data.projects.length > 0);
          }
          setFilteredProjects(
            data.projects.map((project) => projectToRow(project)),
          );
          setPage(data.pagination.page);
          setPageSize(data.pagination.pageSize);
          setTotalItems(data.pagination.totalItems);
        }
      } catch (error) {
        console.error('Error fetching projects data:', error);
        setFilteredProjects([]);
        setIsError(true);
      }
    };

    const debouncer = setTimeout(() => {
      fetchProjects();
    }, 100);
    return () => clearTimeout(debouncer);
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
    <>
      <PageSection hasBodyWrapper={false} id="page">
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <Flex>
            <FlexItem spacer={{ default: 'spacerLg' }}>
              <Content>
                <Content
                  className="title"
                  component="h1"
                  ouiaId="admin-projects"
                >
                  Projects
                </Content>
              </Content>
            </FlexItem>
          </Flex>
          <Flex>
            <FlexItem>
              <Button
                icon={<PlusCircleIcon />}
                aria-label="Add project"
                variant="secondary"
                title="Add project"
                ouiaId="admin-projects-add"
                component={(props) => (
                  <Link {...props} to="/admin/projects/new" />
                )}
              >
                Add Project
              </Button>
            </FlexItem>
          </Flex>
        </Flex>
      </PageSection>
      <PageSection hasBodyWrapper={false} className="pf-v6-u-pb-0">
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
            onSetPage={onSetPage}
            onSetPageSize={onSetPageSize}
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
        variant={ModalVariant.medium}
        isOpen={isDeleteModalOpen}
        onClose={onDeleteClose}
      >
        <ModalHeader title="Confirm Delete" />
        <ModalBody>
          Are you sure you want to delete &ldquo;
          {selectedProject && selectedProject.title}&rdquo;? This cannot be
          undone!
        </ModalBody>
        <ModalFooter>
          <Button
            variant="danger"
            ouiaId="admin-projects-modal-delete"
            isLoading={isDeleting}
            isDisabled={isDeleting}
            onClick={onModalDeleteClick}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
          <Button
            variant="secondary"
            ouiaId="admin-projects-modal-cancel"
            isDisabled={isDeleting}
            onClick={onDeleteClose}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

ProjectList.propTypes = {};

export default ProjectList;
