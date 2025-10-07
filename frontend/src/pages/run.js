import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

import {
  Badge,
  Bullseye,
  Card,
  CardHeader,
  CardBody,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  Flex,
  FlexItem,
  Grid,
  GridItem,
  Label,
  PageSection,
  Spinner,
  Tab,
  Tabs,
  Content,
  TreeView,
} from '@patternfly/react-core';
import {
  CatalogIcon,
  ChevronRightIcon,
  CodeIcon,
  FileAltIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  InfoCircleIcon,
  MessagesIcon,
  RepositoryIcon,
} from '@patternfly/react-icons';
import { CodeEditor, Language } from '@patternfly/react-code-editor';

import { HttpClient } from '../utilities/http';
import { Settings } from './settings';
import {
  resultToRow,
  filtersToAPIParams,
  filtersToSearchParams,
  processPyTestPath,
  cleanPath,
} from '../utilities';
import EmptyObject from '../components/empty-object';
import FilterTable from '../components/filtering/filtered-table-card';
import ResultView from '../components/result-view';
import TabTitle from '../components/tab-title';
import ClassifyFailuresTable from '../components/classify-failures';
import ArtifactTab from '../components/artifact-tab';
import { IbutsuContext } from '../components/contexts/ibutsu-context';
import { useTabHook } from '../components/hooks/use-tab';
import usePagination from '../components/hooks/use-pagination';
import PropTypes from 'prop-types';
import {
  ICON_RESULT_MAP,
  RESULT_FIELDS,
  RUN_RESULTS_COLUMNS,
} from '../constants';
import FilterProvider from '../components/contexts/filter-context';

const RUN_BLOCK = ['run_id', 'result'];
const CLASSIFY_FIELDS = RESULT_FIELDS.filter(
  (field) => !RUN_BLOCK.includes(field.value),
);
const MAX_PAGE = 300;

const Run = ({ defaultTab = 'summary' }) => {
  const { run_id } = useParams();

  const { darkTheme, primaryObject } = useContext(IbutsuContext);
  const { project_id } = useParams();

  const [run, setRun] = useState({});
  const [testResult, setTestResult] = useState(null);
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
  } = usePagination({ setParams: false });

  const [isRunValid, setIsRunValid] = useState(true);
  const [isError, setIsError] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [resultsTree, setResultsTree] = useState([]);
  const [activeItems, setActiveItems] = useState([]);

  const [artifacts, setArtifacts] = useState([]);

  const onTreeItemSelect = (_, treeItem) => {
    if (treeItem && !treeItem.children) {
      setActiveItems([treeItem]);
      setTestResult(treeItem._testResult);
    }
  };

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setIsError(false);
        setFetching(true);
        const filterParams = filtersToAPIParams([
          {
            field: 'run_id',
            operator: 'eq',
            value: run_id,
          },
        ]);
        const response = await HttpClient.get([Settings.serverUrl, 'result'], {
          filter: filterParams,
          pageSize: pageSize,
          page: page,
        });
        const data = await HttpClient.handleResponse(response);
        setRows(data.results.map((result) => resultToRow(result)));
        setPage(data.pagination.page);
        setPageSize(data.pagination.pageSize);
        setTotalItems(data.pagination.totalItems);
        setFetching(false);
      } catch (error) {
        console.error('Error fetching result data:', error);
        setRows([]);
        setIsError(true);
        setFetching(false);
      }
    };

    if (run_id) {
      const debouncer = setTimeout(() => {
        fetchResults();
      }, 50);
      return () => clearTimeout(debouncer);
    }
  }, [page, pageSize, run_id, setPage, setPageSize, setTotalItems]);

  useEffect(() => {
    const fetchRun = async () => {
      try {
        const response = await HttpClient.get([
          Settings.serverUrl,
          'run',
          run_id,
        ]);
        const data = await HttpClient.handleResponse(response);

        setRun(data);
        setArtifacts(data.artifacts);
      } catch (error) {
        console.error(error);
        setIsRunValid(false);
      }
    };
    if (run_id) {
      const debouncer = setTimeout(() => {
        fetchRun();
      }, 50);
      return () => clearTimeout(debouncer);
    }
  }, [run_id]);

  const artifactTabs = useMemo(
    () =>
      artifacts?.map((artifact) => (
        <Tab
          key={artifact.id}
          label={artifact.filename}
          eventKey={artifact.id}
          title={<TabTitle icon={<FileAltIcon />} text={artifact.filename} />}
        >
          <ArtifactTab artifact={artifact} />
        </Tab>
      )),
    [artifacts],
  );

  const artifactKeys = useCallback(() => {
    if (artifactTabs && artifactTabs.length > 0) {
      return artifactTabs.map((tab) => tab.key);
    } else {
      return [];
    }
  }, [artifactTabs]);

  // Tab state and navigation hooks/effects
  const { activeTab, onTabSelect } = useTabHook({
    validTabIndicies: [
      'summary',
      'results-list',
      'results-tree',
      'classify-failures',
      'run-object',
      ...artifactKeys(),
    ],
    defaultTab: defaultTab,
    skipHash: false,
  });

  const buildResultsTree = (treeResults) => {
    const getPassPercent = (stats) => {
      let percent = 'N/A';
      if (stats.count > 0) {
        percent = Math.round(
          ((stats.passed + stats.xfailed) / stats.count) * 100,
        );
      }
      return percent;
    };

    const getBadgeClass = (passPercent) => {
      let className = 'failed';
      if (passPercent > 75) {
        className = 'error';
      }
      if (passPercent > 90) {
        className = 'passed';
      }
      return className;
    };

    let treeStructure = [];
    treeResults.forEach((testResult) => {
      const pathParts = processPyTestPath(
        cleanPath(testResult.metadata.fspath),
      );
      let children = treeStructure;
      pathParts.forEach((dirName) => {
        let child = children.find((item) => item.name == dirName);
        if (!child) {
          child = {
            name: dirName,
            id: dirName,
            children: [],
            hasBadge: true,
            _stats: {
              count: 0,
              passed: 0,
              failed: 0,
              skipped: 0,
              error: 0,
              xpassed: 0,
              xfailed: 0,
            },
          };
          if (dirName.endsWith('.py')) {
            child.icon = <FileIcon />;
            child.expandedIcon = <FileIcon />;
          }
          children.push(child);
        }
        child._stats[testResult.result] += 1;
        child._stats.count += 1;
        const passPercent = getPassPercent(child._stats);
        const className = getBadgeClass(passPercent);
        child.customBadgeContent = `${passPercent}%`;
        child.badgeProps = { className: className };
        children = child.children;
      });

      children.push({
        id: testResult.id,
        name: testResult.test_id,
        icon: ICON_RESULT_MAP[testResult.result],
        _testResult: testResult,
      });
    });
    return treeStructure;
  };

  useEffect(() => {
    let fetchedResults = [];
    const getResultsForTree = (treePage = 1) => {
      const fetchResults = async () => {
        try {
          const response = await HttpClient.get(
            [Settings.serverUrl, 'result'],
            {
              filter: `run_id=${run_id}`,
              pageSize: MAX_PAGE,
              page: treePage,
            },
          );
          const data = await HttpClient.handleResponse(response);
          fetchedResults = [...fetchedResults, ...data.results];
          if (data.results.length === MAX_PAGE) {
            // recursively fetch the next page
            getResultsForTree(treePage + 1);
          } else {
            setResultsTree(buildResultsTree(fetchedResults));
          }
        } catch (error) {
          console.error('Error fetching results for tree:', error);
        }
      };

      const debouncer = setTimeout(() => {
        fetchResults();
      }, 50);
      return () => clearTimeout(debouncer);
    };

    if (activeTab === 'results-tree') {
      getResultsForTree();
    }
  }, [activeTab, run_id]);

  let passed = 0,
    failed = 0,
    errors = 0,
    xfailed = 0,
    xpassed = 0,
    skipped = 0,
    not_run = 0;
  let created = 0;
  let calculatePasses = true;

  if (run.start_time) {
    created = new Date(run.start_time);
  } else {
    created = new Date(run.created);
  }
  if (run?.summary) {
    if (run.summary.passes) {
      passed = run.summary.passes;
      calculatePasses = false;
    }
    if (run.summary.tests && calculatePasses) {
      passed = run.summary.tests;
    }
    if (run.summary.failures) {
      passed -= calculatePasses ? run.summary.failures : 0;
      failed = run.summary.failures;
    }
    if (run.summary.errors) {
      passed -= calculatePasses ? run.summary.errors : 0;
      errors = run.summary.errors;
    }
    if (run.summary.xfailures) {
      passed -= calculatePasses ? run.summary.xfailures : 0;
      xfailed = run.summary.xfailures;
    }
    if (run.summary.xpasses) {
      passed -= calculatePasses ? run.summary.xpasses : 0;
      xpassed = run.summary.xpasses;
    }
    if (run.summary.skips) {
      passed -= calculatePasses ? run.summary.skips : 0;
      skipped = run.summary.skips;
    }
    if (run.summary.not_run) {
      not_run = run.summary.not_run;
    } else if (run.summary.collected) {
      not_run = run.summary.collected - run.summary.tests;
    }
  }

  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Content>
          <Content component="h1">Run {run.id}</Content>
        </Content>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        {!isRunValid && (
          <EmptyObject
            headingText="Run not found"
            returnLink="runs"
            returnLinkText="Return to runs list"
          />
        )}
        {isRunValid && (
          <Tabs activeKey={activeTab} onSelect={onTabSelect} isBox>
            <Tab
              key="summary"
              eventKey="summary"
              title={<TabTitle icon={<InfoCircleIcon />} text="Summary" />}
            >
              <Card>
                <CardBody style={{ padding: 0 }} id="run-detail">
                  <Grid>
                    <GridItem span={6}>
                      <DataList
                        selectedDataListItemId={null}
                        aria-label="Run properties"
                        style={{ borderBottom: 'none', borderTop: 'none' }}
                      >
                        <DataListItem aria-labelledby="Duration">
                          <DataListItemRow>
                            <DataListItemCells
                              dataListCells={[
                                <DataListCell key={1} width={2}>
                                  <strong>Duration:</strong>
                                </DataListCell>,
                                <DataListCell key={2} width={4}>
                                  {Math.ceil(run.duration)}s
                                </DataListCell>,
                              ]}
                            />
                          </DataListItemRow>
                        </DataListItem>
                        <DataListItem aria-labelledby="Started">
                          <DataListItemRow>
                            <DataListItemCells
                              dataListCells={[
                                <DataListCell key={1} width={2}>
                                  <strong>Started:</strong>
                                </DataListCell>,
                                <DataListCell key={2} width={4}>
                                  {created.toLocaleString()}
                                </DataListCell>,
                              ]}
                            />
                          </DataListItemRow>
                        </DataListItem>
                        {run.metadata && run.metadata.component && (
                          <DataListItem aria-labelledby="Component">
                            <DataListItemRow>
                              <DataListItemCells
                                dataListCells={[
                                  <DataListCell key={1} width={2}>
                                    <strong>Component:</strong>
                                  </DataListCell>,
                                  <DataListCell key={2} width={4}>
                                    {run.metadata.component}
                                  </DataListCell>,
                                ]}
                              />
                            </DataListItemRow>
                          </DataListItem>
                        )}
                        {run.metadata && run.metadata.env && (
                          <DataListItem aria-labelledby="Environment">
                            <DataListItemRow>
                              <DataListItemCells
                                dataListCells={[
                                  <DataListCell key={1} width={2}>
                                    <strong>Environment:</strong>
                                  </DataListCell>,
                                  <DataListCell key={2} width={4}>
                                    {run.metadata.env}
                                  </DataListCell>,
                                ]}
                              />
                            </DataListItemRow>
                          </DataListItem>
                        )}
                        {run.metadata && run.metadata.tags && (
                          <DataListItem aria-labelledby="tags-label">
                            <DataListItemRow>
                              <DataListItemCells
                                dataListCells={[
                                  <DataListCell key="tags-label" width={2}>
                                    <strong>Tags:</strong>
                                  </DataListCell>,
                                  <DataListCell key="tags-data" width={4}>
                                    <Flex>
                                      {run.metadata.tags.map((tag) => (
                                        <FlexItem
                                          spacer={{ default: 'spacerXs' }}
                                          key={tag}
                                        >
                                          <Label color="blue" variant="filled">
                                            {tag}
                                          </Label>
                                        </FlexItem>
                                      ))}
                                    </Flex>
                                  </DataListCell>,
                                ]}
                              />
                            </DataListItemRow>
                          </DataListItem>
                        )}
                        {run.metadata &&
                          run.metadata.jenkins &&
                          run.metadata.jenkins.job_name && (
                            <DataListItem aria-labelledby="Jenkins Job Name">
                              <DataListItemRow>
                                <DataListItemCells
                                  dataListCells={[
                                    <DataListCell key={1} width={2}>
                                      <strong>Jenkins Job Name:</strong>
                                    </DataListCell>,
                                    <DataListCell key={2} width={4}>
                                      {run.metadata.jenkins.job_name}
                                    </DataListCell>,
                                  ]}
                                />
                              </DataListItemRow>
                            </DataListItem>
                          )}
                        {run.source && (
                          <DataListItem aria-labelledby="Source">
                            <DataListItemRow>
                              <DataListItemCells
                                dataListCells={[
                                  <DataListCell key={1} width={2}>
                                    <strong>Source:</strong>
                                  </DataListCell>,
                                  <DataListCell key={2} width={4}>
                                    {run.source}
                                  </DataListCell>,
                                ]}
                              />
                            </DataListItemRow>
                          </DataListItem>
                        )}
                      </DataList>
                    </GridItem>
                    <GridItem span={6}>
                      <DataList
                        selectedDataListItemId={null}
                        aria-label="Summary properties"
                        style={{ borderBottom: 0, borderTop: 0 }}
                      >
                        <DataListItem aria-labelledby="Summary">
                          <DataListItemRow>
                            <DataListItemCells
                              style={{ paddingBottom: 0 }}
                              dataListCells={[
                                <DataListCell key={1} width={2}>
                                  <strong>Summary:</strong>
                                </DataListCell>,
                                <DataListCell
                                  key={2}
                                  width={4}
                                  style={{ paddingTop: 0 }}
                                >
                                  <DataList
                                    selectedDataListItemId={null}
                                    aria-label="Summary"
                                    style={{ borderBottom: 0, borderTop: 0 }}
                                  >
                                    <DataListItem aria-labelledby="Total">
                                      <DataListItemRow>
                                        <DataListItemCells
                                          dataListCells={[
                                            <DataListCell key={1}>
                                              Total:
                                            </DataListCell>,
                                            <DataListCell key={2}>
                                              {run?.summary?.collected ||
                                                run?.summary?.tests ||
                                                'Summary Error'}
                                            </DataListCell>,
                                          ]}
                                        />
                                      </DataListItemRow>
                                    </DataListItem>
                                    <DataListItem
                                      aria-labelledby="Passed"
                                      class="pf-v6-c-data-list__item pf-m-clickable"
                                    >
                                      <Link
                                        to={{
                                          pathname: `/project/${primaryObject?.id || project_id}/results`,
                                          search: filtersToSearchParams([
                                            {
                                              field: 'run_id',
                                              operator: 'eq',
                                              value: run.id,
                                            },
                                            {
                                              field: 'result',
                                              operator: 'eq',
                                              value: 'passed',
                                            },
                                          ]).toString(),
                                        }}
                                      >
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>
                                                <Label
                                                  variant="filled"
                                                  icon={ICON_RESULT_MAP.passed}
                                                  title="Passed"
                                                >
                                                  Passed
                                                </Label>
                                              </DataListCell>,
                                              <DataListCell key={2}>
                                                {passed}
                                              </DataListCell>,
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </Link>
                                    </DataListItem>
                                    <DataListItem
                                      aria-labelledby="Failed"
                                      class="pf-v6-c-data-list__item pf-m-clickable"
                                    >
                                      <Link
                                        to={{
                                          pathname: `/project/${primaryObject?.id || project_id}/results`,
                                          search: filtersToSearchParams([
                                            {
                                              field: 'run_id',
                                              operator: 'eq',
                                              value: run.id,
                                            },
                                            {
                                              field: 'result',
                                              operator: 'eq',
                                              value: 'failed',
                                            },
                                          ]).toString(),
                                        }}
                                      >
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>
                                                <Label
                                                  variant="filled"
                                                  icon={ICON_RESULT_MAP.failed}
                                                  title="Failed"
                                                >
                                                  Failed
                                                </Label>
                                              </DataListCell>,
                                              <DataListCell key={2}>
                                                {failed}
                                              </DataListCell>,
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </Link>
                                    </DataListItem>
                                    <DataListItem
                                      aria-labelledby="Error"
                                      class="pf-v6-c-data-list__item pf-m-clickable"
                                    >
                                      <Link
                                        to={{
                                          pathname: `/project/${primaryObject?.id || project_id}/results`,
                                          search: filtersToSearchParams([
                                            {
                                              field: 'run_id',
                                              operator: 'eq',
                                              value: run.id,
                                            },
                                            {
                                              field: 'result',
                                              operator: 'eq',
                                              value: 'error',
                                            },
                                          ]).toString(),
                                        }}
                                      >
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>
                                                <Label
                                                  variant="filled"
                                                  icon={ICON_RESULT_MAP.error}
                                                  title="Error"
                                                >
                                                  Error
                                                </Label>
                                              </DataListCell>,
                                              <DataListCell key={2}>
                                                {errors}
                                              </DataListCell>,
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </Link>
                                    </DataListItem>
                                    <DataListItem
                                      aria-labelledby="Xfailed"
                                      class="pf-v6-c-data-list__item pf-m-clickable"
                                    >
                                      <Link
                                        to={{
                                          pathname: `/project/${primaryObject?.id || project_id}/results`,
                                          search: filtersToSearchParams([
                                            {
                                              field: 'run_id',
                                              operator: 'eq',
                                              value: run.id,
                                            },
                                            {
                                              field: 'result',
                                              operator: 'eq',
                                              value: 'xfailed',
                                            },
                                          ]).toString(),
                                        }}
                                      >
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>
                                                <Label
                                                  variant="filled"
                                                  icon={ICON_RESULT_MAP.xfailed}
                                                  title="Xfailed"
                                                >
                                                  Xfailed
                                                </Label>
                                              </DataListCell>,
                                              <DataListCell key={2}>
                                                {xfailed}
                                              </DataListCell>,
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </Link>
                                    </DataListItem>
                                    <DataListItem
                                      aria-labelledby="Xpassed"
                                      class="pf-v6-c-data-list__item pf-m-clickable"
                                    >
                                      <Link
                                        to={{
                                          pathname: `/project/${primaryObject?.id || project_id}/results`,
                                          search: filtersToSearchParams([
                                            {
                                              field: 'run_id',
                                              operator: 'eq',
                                              value: run.id,
                                            },
                                            {
                                              field: 'result',
                                              operator: 'eq',
                                              value: 'xpassed',
                                            },
                                          ]).toString(),
                                        }}
                                      >
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>
                                                <Label
                                                  variant="filled"
                                                  icon={ICON_RESULT_MAP.xpassed}
                                                  title="Xpassed"
                                                >
                                                  Xpassed
                                                </Label>
                                              </DataListCell>,
                                              <DataListCell key={2}>
                                                {xpassed}
                                              </DataListCell>,
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </Link>
                                    </DataListItem>
                                    <DataListItem
                                      aria-labelledby="Skipped"
                                      class="pf-v6-c-data-list__item pf-m-clickable"
                                    >
                                      <Link
                                        to={{
                                          pathname: `/project/${primaryObject?.id || project_id}/results`,
                                          search: filtersToSearchParams([
                                            {
                                              field: 'run_id',
                                              operator: 'eq',
                                              value: run.id,
                                            },
                                            {
                                              field: 'result',
                                              operator: 'eq',
                                              value: 'skipped',
                                            },
                                          ]).toString(),
                                        }}
                                      >
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>
                                                <Label
                                                  variant="filled"
                                                  icon={ICON_RESULT_MAP.skipped}
                                                  title="Skipped"
                                                >
                                                  Skipped
                                                </Label>
                                              </DataListCell>,
                                              <DataListCell key={2}>
                                                {skipped}
                                              </DataListCell>,
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </Link>
                                    </DataListItem>
                                    <DataListItem
                                      aria-labelledby="Not Run"
                                      class="pf-v6-c-data-list__item pf-m-clickable"
                                    >
                                      <Link
                                        to={{
                                          pathname: `/project/${primaryObject?.id || project_id}/results`,
                                          search: filtersToSearchParams([
                                            {
                                              field: 'run_id',
                                              operator: 'eq',
                                              value: run.id,
                                            },
                                            {
                                              field: 'result',
                                              operator: 'eq',
                                              value: 'manual',
                                            },
                                          ]).toString(),
                                        }}
                                      >
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>
                                                <Label
                                                  variant="filled"
                                                  icon={ICON_RESULT_MAP.manual}
                                                  title="Not Run / Manual"
                                                >
                                                  Not Run / Manual
                                                </Label>
                                              </DataListCell>,
                                              <DataListCell key={2}>
                                                {not_run}
                                              </DataListCell>,
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </Link>
                                    </DataListItem>
                                  </DataList>
                                </DataListCell>,
                              ]}
                            />
                          </DataListItemRow>
                        </DataListItem>
                      </DataList>
                    </GridItem>
                  </Grid>
                </CardBody>
              </Card>
            </Tab>
            <Tab
              key="results-list"
              eventKey="results-list"
              title={<TabTitle icon={<CatalogIcon />} text="Results List" />}
            >
              <FilterTable
                headerChildren={
                  <Flex style={{ width: '100%' }}>
                    <FlexItem>
                      <Link
                        to={{
                          pathname: `/project/${primaryObject?.id || project_id}/results`,
                          search: new URLSearchParams({
                            run_id: `[eq]${run.id}`,
                          }).toString(),
                        }}
                        style={{ marginLeft: '2px' }}
                      >
                        Apply more filters on the Test Results page
                        <ChevronRightIcon />
                      </Link>
                    </FlexItem>
                  </Flex>
                }
                fetching={fetching}
                columns={RUN_RESULTS_COLUMNS}
                rows={rows}
                pageSize={pageSize}
                page={page}
                totalItems={totalItems}
                isError={isError}
                onSetPage={onSetPage}
                onSetPageSize={onSetPageSize}
              />
            </Tab>
            <Tab
              eventKey="results-tree"
              title={<TabTitle icon={<RepositoryIcon />} text="Results Tree" />}
            >
              <Card className="pf-v6-u-mt-lg">
                <CardBody>
                  <Grid gutter="sm">
                    {resultsTree.length === 0 && (
                      <GridItem span={12}>
                        <Bullseye>
                          <center>
                            <Spinner size="xl" />
                          </center>
                        </Bullseye>
                      </GridItem>
                    )}
                    {resultsTree.length !== 0 && (
                      <>
                        <GridItem span={5}>
                          <TreeView
                            data={resultsTree}
                            activeItems={activeItems}
                            onSelect={onTreeItemSelect}
                            icon={<FolderIcon />}
                            expandedIcon={<FolderOpenIcon />}
                          />
                        </GridItem>
                        <GridItem span={7}>
                          {testResult && (
                            <Card className={testResult.result}>
                              <CardHeader>
                                {testResult.test_id}
                                {testResult.metadata.markers && (
                                  <div style={{ float: 'right' }}>
                                    {testResult.metadata.markers.map(
                                      (marker) => (
                                        <Badge isRead key={marker}>
                                          {marker}
                                        </Badge>
                                      ),
                                    )}
                                  </div>
                                )}
                              </CardHeader>
                              <CardBody
                                style={{
                                  backgroundColor:
                                    'var(--pf-t--global--background--color--primary--default)',
                                  paddingTop: '1.2em',
                                }}
                              >
                                <ResultView
                                  testResult={testResult}
                                  skipHash={true}
                                />
                              </CardBody>
                            </Card>
                          )}
                        </GridItem>
                      </>
                    )}
                  </Grid>
                </CardBody>
              </Card>
            </Tab>
            <Tab
              eventKey="classify-failures"
              title={
                <TabTitle icon={<MessagesIcon />} text="Classify Failures" />
              }
            >
              <FilterProvider
                key="run"
                blockRemove={RUN_BLOCK}
                fieldOptions={CLASSIFY_FIELDS}
              >
                <ClassifyFailuresTable run_id={run_id} />
              </FilterProvider>
            </Tab>
            {artifactTabs && artifactTabs.length > 0 ? artifactTabs : null}
            <Tab
              eventKey="run-object"
              title={<TabTitle icon={<CodeIcon />} text="Run Object" />}
            >
              <Card>
                <CardBody id="object-card-body">
                  <CodeEditor
                    isReadOnly={true}
                    isDarkTheme={darkTheme}
                    language={Language.json}
                    code={JSON.stringify(run, null, '\t')}
                    height="1200px" // use sizeToFit when tab navigation is fixed
                  />
                </CardBody>
              </Card>
            </Tab>
          </Tabs>
        )}
      </PageSection>
    </>
  );
};

Run.propTypes = {
  defaultTab: PropTypes.string,
};

export default Run;
