import { useCallback, useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { ChevronRightIcon } from '@patternfly/react-icons';

import { Link, useParams } from 'react-router-dom';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { filtersToAPIParams, filtersToSearchParams } from '../utilities';

import FilterTable from '../components/filtering/filtered-table-card';
import RunSummary from '../components/runsummary';
import { IbutsuContext } from '../components/contexts/ibutsuContext';
import usePagination from '../components/hooks/usePagination';
import ActiveFilters from '../components/filtering/active-filters';
import { FilterContext } from '../components/contexts/filterContext';

const COLUMNS = [
  'Job name',
  'Build number',
  'Summary',
  'Source',
  'Env',
  'Started',
  '',
];
const HIDE = ['project_id'];

const JenkinsJobView = ({ view }) => {
  const { primaryObject } = useContext(IbutsuContext);
  const { project_id } = useParams();
  const [analysisViewId, setAnalysisViewId] = useState();

  const [fetching, setFetching] = useState(true);
  const [isError, setIsError] = useState(false);

  const [rows, setRows] = useState([]);

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

  const { activeFilters } = useContext(FilterContext);

  useEffect(() => {
    const getViewId = async () => {
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'widget-config'],
          {
            filter: 'widget=jenkins-analysis-view',
          },
        );
        const data = await HttpClient.handleResponse(response);

        if (!data.widgets[0]?.id) {
          console.error(
            'No analysis view ID found for jenkins-analysis-view widget',
          );
        } else {
          setAnalysisViewId(data.widgets[0]?.id);
        }
      } catch (error) {
        console.error('Error fetching analysis view ID:', error);
      }
    };
    getViewId();
  }, []);

  const jobToRow = useCallback(
    (job) => {
      const runFilters = [
        {
          field: 'metadata.jenkins.job_name',
          operator: 'eq',
          value: job.job_name,
        },
        {
          field: 'metadata.jenkins.build_number',
          operator: 'eq',
          value: job.build_number,
        },
      ];
      const searchString = new URLSearchParams(
        filtersToSearchParams([
          {
            field: 'job_name',
            operator: 'eq',
            value: job.job_name,
          },
        ]),
      ).toString();
      return {
        cells: [
          analysisViewId
            ? {
                title: (
                  <Link
                    to={{
                      pathname: `../view/${analysisViewId}`,
                      search: searchString,
                    }}
                    relative="Path"
                  >
                    {job.job_name}
                  </Link>
                ),
              }
            : job.job_name,
          {
            title: (
              <a href={job.build_url} target="_blank" rel="noopener noreferrer">
                {job.build_number}
              </a>
            ),
          },
          { title: <RunSummary summary={job.summary} /> },
          job.source,
          job.env,
          new Date(job.start_time).toLocaleString(),
          {
            title: (
              <Link
                to={{
                  pathname: `/project/${project_id}/runs`,
                  search: `${filtersToSearchParams(runFilters)}`,
                }}
              >
                See runs <ChevronRightIcon />
              </Link>
            ),
          },
        ],
      };
    },
    [project_id, analysisViewId],
  );

  useEffect(() => {
    const fetchData = async () => {
      let params = {
        ...view.params,
        page: page,
        page_size: pageSize,
        filter: filtersToAPIParams(activeFilters),
      };
      setIsError(false);

      if (primaryObject) {
        params['project'] = primaryObject.id;
      } else {
        delete params['project'];
      }

      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'widget', view.widget],
          params,
        );
        const data = await HttpClient.handleResponse(response);
        if (!data?.jobs) {
          throw new Error('No jobs found in response');
        }
        setRows(data.jobs.map((job) => jobToRow(job)));
        setTotalItems(data.pagination.totalItems);
        setPage(data.pagination.page);
        setPageSize(data.pagination.pageSize);
      } catch (error) {
        console.error('Error fetching Jenkins data:', error);
        setIsError(true);
        setRows([]);
      }
      setFetching(false);
    };

    if (view && activeFilters?.length) {
      fetchData();
    }
  }, [
    activeFilters,
    page,
    pageSize,
    primaryObject,
    view,
    jobToRow,
    setTotalItems,
    setPage,
    setPageSize,
  ]);

  return (
    <FilterTable
      fetching={fetching}
      columns={COLUMNS}
      rows={rows}
      filters={
        <ActiveFilters activeFilters={activeFilters} hideFilters={HIDE} />
      }
      pageSize={pageSize}
      page={page}
      totalItems={totalItems}
      isError={isError}
      onSetPage={onSetPage}
      onSetPageSize={onSetPageSize}
    />
  );
};

JenkinsJobView.propTypes = {
  view: PropTypes.object,
};

export default JenkinsJobView;
