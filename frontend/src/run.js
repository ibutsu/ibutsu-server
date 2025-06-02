import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
} from 'react';
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
  PageSectionVariants,
  Spinner,
  Tab,
  Tabs,
  TextContent,
  Text,
  TreeView,
} from '@patternfly/react-core';
import {
  CatalogIcon,
  ChevronRightIcon,
  CodeIcon,
  FileAltIcon,
  FolderIcon,
  FolderOpenIcon,
  InfoCircleIcon,
  MessagesIcon,
  RepositoryIcon,
} from '@patternfly/react-icons';
import { CodeEditor, Language } from '@patternfly/react-code-editor';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import {
  resultToRow,
  round,
  buildResultsTree,
  filtersToAPIParams,
} from './utilities';
import EmptyObject from './components/empty-object';
import FilterTable from './components/filtering/filtered-table-card';
import ResultView from './components/resultView';
import TabTitle from './components/tabs';
import ClassifyFailuresTable from './components/classify-failures';
import ArtifactTab from './components/artifact-tab';
import { IbutsuContext } from './components/contexts/ibutsuContext';
import { useTabHook } from './components/hooks/useTab';
import usePagination from './components/hooks/usePagination';
import PropTypes from 'prop-types';
import { RESULT_FIELDS, RUN_RESULTS_COLUMNS } from './constants';
import FilterProvider from './components/contexts/filterContext';

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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, run_id]);

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
          eventKey={artifact.id}
          title={<TabTitle icon={<FileAltIcon />} text={artifact.filename} />}
        >
          <ArtifactTab artifact={artifact} />
        </Tab>
      )),
    [artifacts],
  );

  const artifactKeys = useCallback(() => {
    if (artifactTabs && artifactTabs?.length !== 0) {
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
    <React.Fragment>
      <PageSection variant={PageSectionVariants.light}>
        <TextContent>
          <Text component="h1" className="pf-v5-c-title">
            Run {run.id}
          </Text>
        </TextContent>
      </PageSection>
      <PageSection>
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
                                  {round(run.duration)}s
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
                                    <DataListItem aria-labelledby="Passed">
                                      <DataListItemRow>
                                        <DataListItemCells
                                          dataListCells={[
                                            <DataListCell key={1}>
                                              Passed:
                                            </DataListCell>,
                                            <DataListCell key={2}>
                                              {passed}
                                            </DataListCell>,
                                          ]}
                                        />
                                      </DataListItemRow>
                                    </DataListItem>
                                    <DataListItem aria-labelledby="Failed">
                                      <DataListItemRow>
                                        <DataListItemCells
                                          dataListCells={[
                                            <DataListCell key={1}>
                                              Failed:
                                            </DataListCell>,
                                            <DataListCell key={2}>
                                              {failed}
                                            </DataListCell>,
                                          ]}
                                        />
                                      </DataListItemRow>
                                    </DataListItem>
                                    <DataListItem aria-labelledby="Error">
                                      <DataListItemRow>
                                        <DataListItemCells
                                          dataListCells={[
                                            <DataListCell key={1}>
                                              Error:
                                            </DataListCell>,
                                            <DataListCell key={2}>
                                              {errors}
                                            </DataListCell>,
                                          ]}
                                        />
                                      </DataListItemRow>
                                    </DataListItem>
                                    <DataListItem aria-labelledby="Xfailed">
                                      <DataListItemRow>
                                        <DataListItemCells
                                          dataListCells={[
                                            <DataListCell key={1}>
                                              Xfailed:
                                            </DataListCell>,
                                            <DataListCell key={2}>
                                              {xfailed}
                                            </DataListCell>,
                                          ]}
                                        />
                                      </DataListItemRow>
                                    </DataListItem>
                                    <DataListItem aria-labelledby="Xpassed">
                                      <DataListItemRow>
                                        <DataListItemCells
                                          dataListCells={[
                                            <DataListCell key={1}>
                                              Xpassed:
                                            </DataListCell>,
                                            <DataListCell key={2}>
                                              {xpassed}
                                            </DataListCell>,
                                          ]}
                                        />
                                      </DataListItemRow>
                                    </DataListItem>
                                    <DataListItem aria-labelledby="Skipped">
                                      <DataListItemRow>
                                        <DataListItemCells
                                          dataListCells={[
                                            <DataListCell key={1}>
                                              Skipped:
                                            </DataListCell>,
                                            <DataListCell key={2}>
                                              {skipped}
                                            </DataListCell>,
                                          ]}
                                        />
                                      </DataListItemRow>
                                    </DataListItem>
                                    <DataListItem aria-labelledby="Not Run">
                                      <DataListItemRow>
                                        <DataListItemCells
                                          dataListCells={[
                                            <DataListCell key={1}>
                                              Not Run:
                                            </DataListCell>,
                                            <DataListCell key={2}>
                                              {not_run}
                                            </DataListCell>,
                                          ]}
                                        />
                                      </DataListItemRow>
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
              <Card className="pf-u-mt-lg">
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
                      <React.Fragment>
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
                                    'var(--pf-v5-c-card--BackgroundColor)',
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
                      </React.Fragment>
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
            {artifactTabs}
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
    </React.Fragment>
  );
};

Run.propTypes = {
  defaultTab: PropTypes.string,
};

export default Run;
