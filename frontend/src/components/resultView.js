import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
} from 'react';
import PropTypes from 'prop-types';

import {
  Card,
  CardBody,
  DataList,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  DataListCell,
  Flex,
  FlexItem,
  Label,
  Tabs,
  Tab,
  Button,
} from '@patternfly/react-core';
import {
  InfoCircleIcon,
  CodeIcon,
  SearchIcon,
  FileAltIcon,
} from '@patternfly/react-icons';
import { CodeEditor, Language } from '@patternfly/react-code-editor';

import { Link, useParams } from 'react-router-dom';
import Linkify from 'react-linkify';

import { HttpClient } from '../services/http';
import { ClassificationDropdown } from './classification-dropdown';
import { linkifyDecorator } from './decorators';
import { Settings } from '../settings';
import { filtersToSearchParams, toTitleCase } from '../utilities';
import { ICON_RESULT_MAP } from '../constants';

import TabTitle from './tabs';
import TestHistoryTable from './test-history';
import ArtifactTab from './artifact-tab';
import { IbutsuContext } from '../components/contexts/ibutsuContext';
import { useTabHook } from './hooks/useTab';

const ResultView = ({
  comparisonResults,
  testResult,
  defaultTab = 'summary',
  hideArtifact = false,
  hideSummary = false,
  hideTestObject = false,
  hideTestHistory = false,
  skipHash = false,
}) => {
  const { darkTheme } = useContext(IbutsuContext);
  const { project_id } = useParams();

  // State
  const [artifacts, setArtifacts] = useState([]);

  const artifactTabs = useMemo(
    () =>
      artifacts.map((art) => (
        <Tab
          key={art.filename}
          eventKey={art.filename}
          title={<TabTitle icon={<FileAltIcon />} text={art.filename} />}
        >
          <ArtifactTab artifact={art} />
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
      'testHistory',
      'testObject',
      ...artifactKeys(),
    ],
    defaultTab: defaultTab,
    skipHash: skipHash,
  });

  useEffect(() => {
    // Get artifacts when the test result changes
    const fetchArtifacts = async () => {
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'artifact'],
          {
            resultId: testResult.id,
          },
        );
        const data = await HttpClient.handleResponse(response);
        setArtifacts(data['artifacts']);
      } catch (error) {
        console.error('Error fetching artifacts:', error);
      }
    };

    if (testResult && testResult.id) {
      const debouncer = setTimeout(() => {
        fetchArtifacts();
      }, 100);
      return () => {
        clearTimeout(debouncer);
      };
    }
  }, [testResult]);

  const resultIcon = useMemo(() => {
    return testResult?.result
      ? ICON_RESULT_MAP[testResult.result]
      : ICON_RESULT_MAP.pending;
  }, [testResult]);

  const runLink = useMemo(() => {
    return testResult.run_id ? (
      <Link to={`../runs/${testResult.run_id}#summary`} relative="Path">
        {testResult.run_id}
      </Link>
    ) : (
      <Button disabled variant="link">
        No run_id
      </Button>
    );
  }, [testResult]);

  const componentLink = useMemo(() => {
    const componentSearch = filtersToSearchParams([
      {
        field: 'component',
        operator: 'eq',
        value: testResult.component,
      },
    ]);
    return testResult.component ? (
      <Link
        to={{
          pathname: `/project/${project_id}/results`,
          search: componentSearch.toString(),
        }}
      >
        {testResult.component}
      </Link>
    ) : (
      <Button disabled variant="link">
        No component
      </Button>
    );
  }, [testResult, project_id]);

  const sourceLink = useMemo(() => {
    const sourceSearch = filtersToSearchParams([
      {
        field: 'source',
        operator: 'eq',
        value: testResult.source,
      },
    ]);
    return testResult.source ? (
      <Link
        to={{
          pathname: `/project/${project_id}/results`,
          search: sourceSearch.toString(),
        }}
        relative="Path"
      >
        {testResult.source}
      </Link>
    ) : (
      <Button disabled variant="link">
        No source
      </Button>
    );
  }, [testResult, project_id]);

  const resultParameters = useMemo(() => {
    return testResult.params?.length ? (
      Object.keys(testResult.params).map((key) => (
        <div key={key}>
          {key} = {testResult.params[key]}
        </div>
      ))
    ) : (
      <div />
    );
  }, [testResult]);

  const startTime = useMemo(() => {
    return testResult.start_time
      ? new Date(testResult.start_time)
      : testResult.startTime
        ? new Date(testResult.startTime)
        : new Date();
  }, [testResult]);

  const testJson = useMemo(
    () => JSON.stringify(testResult, null, '\t'),
    [testResult],
  );

  return (
    <React.Fragment>
      {testResult && (
        <Tabs activeKey={activeTab} onSelect={onTabSelect} isBox>
          {!hideSummary && (
            <Tab
              key="summary"
              eventKey="summary"
              title={<TabTitle icon={<InfoCircleIcon />} text="Summary" />}
            >
              <Card>
                <CardBody style={{ padding: 0 }}>
                  <DataList
                    selectedDataListItemId={null}
                    aria-label="Test Result"
                    style={{ borderBottom: 'none', borderTop: 'none' }}
                  >
                    <DataListItem
                      isExpanded={false}
                      aria-labelledby="result-label"
                    >
                      <DataListItemRow>
                        <DataListItemCells
                          dataListCells={[
                            <DataListCell key="result-label" width={2}>
                              <strong>Result:</strong>
                            </DataListCell>,
                            <DataListCell key="result-data" width={4}>
                              <Label
                                key="result-icon"
                                variant="filled"
                                title={testResult.result}
                                icon={resultIcon}
                              >
                                {toTitleCase(testResult.result)}
                              </Label>
                            </DataListCell>,
                          ]}
                        />
                      </DataListItemRow>
                    </DataListItem>
                    <DataListItem aria-labelledby="run-label">
                      <DataListItemRow>
                        <DataListItemCells
                          dataListCells={[
                            <DataListCell key="run-label" width={2}>
                              <strong>Run:</strong>
                            </DataListCell>,
                            <DataListCell key="run-data" width={4}>
                              {runLink}
                            </DataListCell>,
                          ]}
                        />
                      </DataListItemRow>
                    </DataListItem>
                    {testResult.component && (
                      <DataListItem aria-labelledby="component-label">
                        <DataListItemRow>
                          <DataListItemCells
                            dataListCells={[
                              <DataListCell key="component-label" width={2}>
                                <strong>Component:</strong>
                              </DataListCell>,
                              <DataListCell key="component-data" width={4}>
                                {componentLink}
                              </DataListCell>,
                            ]}
                          />
                        </DataListItemRow>
                      </DataListItem>
                    )}
                    {testResult.metadata && testResult.metadata.code_link && (
                      <DataListItem aria-labelledby="code-link-label">
                        <DataListItemRow>
                          <DataListItemCells
                            dataListCells={[
                              <DataListCell key="code-link-label" width={2}>
                                <strong>Code Link:</strong>
                              </DataListCell>,
                              <DataListCell key="code-link-data" width={4}>
                                <Linkify componentDecorator={linkifyDecorator}>
                                  {testResult.metadata.code_link}
                                </Linkify>
                              </DataListCell>,
                            ]}
                          />
                        </DataListItemRow>
                      </DataListItem>
                    )}
                    {testResult.metadata && testResult.metadata.tags && (
                      <DataListItem aria-labelledby="tags-label">
                        <DataListItemRow>
                          <DataListItemCells
                            dataListCells={[
                              <DataListCell key="tags-label" width={2}>
                                <strong>Tags:</strong>
                              </DataListCell>,
                              <DataListCell key="tags-data" width={4}>
                                <Flex>
                                  {testResult.metadata.tags.map((tag) => (
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
                    {testResult.result === 'skipped' &&
                      testResult.metadata &&
                      testResult.metadata.skip_reason && (
                        <DataListItem aria-labelledby="skip-reason-label">
                          <DataListItemRow>
                            <DataListItemCells
                              dataListCells={[
                                <DataListCell key="skip-reason-label" width={2}>
                                  <strong>Reason skipped:</strong>
                                </DataListCell>,
                                <DataListCell key="skip-reason-data" width={4}>
                                  <Linkify
                                    componentDecorator={linkifyDecorator}
                                  >
                                    {testResult.metadata.skip_reason}
                                  </Linkify>
                                </DataListCell>,
                              ]}
                            />
                          </DataListItemRow>
                        </DataListItem>
                      )}
                    {testResult.result === 'xfailed' &&
                      testResult.metadata &&
                      testResult.metadata.xfail_reason && (
                        <DataListItem aria-labelledby="xfail-reason-label">
                          <DataListItemRow>
                            <DataListItemCells
                              dataListCells={[
                                <DataListCell
                                  key="xfail-reason-label"
                                  width={2}
                                >
                                  <strong>Reason xfailed:</strong>
                                </DataListCell>,
                                <DataListCell key="xfail-reason-data" width={4}>
                                  <Linkify
                                    componentDecorator={linkifyDecorator}
                                  >
                                    {testResult.metadata.xfail_reason}
                                  </Linkify>
                                </DataListCell>,
                              ]}
                            />
                          </DataListItemRow>
                        </DataListItem>
                      )}
                    {(testResult.result === 'failed' ||
                      testResult.result === 'error' ||
                      testResult.result === 'skipped') && (
                      <DataListItem aria-labelledby="classification-label">
                        <DataListItemRow>
                          <DataListItemCells
                            dataListCells={[
                              <DataListCell
                                key="classification-label"
                                width={2}
                              >
                                <strong>Classification:</strong>
                              </DataListCell>,
                              <DataListCell key="classification-data" width={4}>
                                <ClassificationDropdown
                                  testResult={testResult}
                                />
                              </DataListCell>,
                            ]}
                          />
                        </DataListItemRow>
                      </DataListItem>
                    )}
                    <DataListItem aria-labelledby="duration">
                      <DataListItemRow>
                        <DataListItemCells
                          dataListCells={[
                            <DataListCell key="duration-label" width={2}>
                              <strong>Duration:</strong>
                            </DataListCell>,
                            <DataListCell
                              key="duration-data"
                              width={4}
                              style={{
                                paddingTop: 0,
                                paddingBottom: 0,
                                marginBottom: '-25px',
                              }}
                            >
                              <DataList
                                selectedDataListItemId={null}
                                aria-label="Durations"
                                style={{ borderTop: 'none' }}
                              >
                                {(testResult.start_time ||
                                  testResult.starttime) > 0 && (
                                  <DataListItem
                                    className="pf-v6-u-p-0"
                                    aria-labelledby="started-label"
                                  >
                                    <DataListItemRow>
                                      <DataListItemCells
                                        dataListCells={[
                                          <DataListCell
                                            key="started-label"
                                            className="pf-v6-u-p-sm"
                                          >
                                            Started at:
                                          </DataListCell>,
                                          <DataListCell
                                            key="started-data"
                                            className="pf-v6-u-p-sm"
                                          >
                                            {startTime.toLocaleString()}
                                          </DataListCell>,
                                        ]}
                                      />
                                    </DataListItemRow>
                                  </DataListItem>
                                )}
                                <DataListItem
                                  className="pf-v6-u-p-0"
                                  aria-labelledby="total-label"
                                >
                                  <DataListItemRow>
                                    <DataListItemCells
                                      dataListCells={[
                                        <DataListCell
                                          key="total-label"
                                          className="pf-v6-u-p-sm"
                                        >
                                          Total:
                                        </DataListCell>,
                                        <DataListCell
                                          key="total-data"
                                          className="pf-v6-u-p-sm"
                                        >
                                          {Math.ceil(testResult.duration)}s
                                        </DataListCell>,
                                      ]}
                                    />
                                  </DataListItemRow>
                                </DataListItem>
                                {testResult.metadata &&
                                  testResult.metadata.durations && (
                                    <React.Fragment>
                                      {testResult.metadata.durations.setup && (
                                        <DataListItem
                                          className="pf-v6-u-p-0"
                                          aria-labelledby="setup-label"
                                        >
                                          <DataListItemRow>
                                            <DataListItemCells
                                              dataListCells={[
                                                <DataListCell
                                                  key="setup-label"
                                                  className="pf-v6-u-p-sm"
                                                >
                                                  Set up:
                                                </DataListCell>,
                                                <DataListCell
                                                  key="setup-data"
                                                  className="pf-v6-u-p-sm"
                                                >
                                                  {Math.ceil(
                                                    testResult.metadata
                                                      .durations.setup,
                                                  )}
                                                  s
                                                </DataListCell>,
                                              ]}
                                            />
                                          </DataListItemRow>
                                        </DataListItem>
                                      )}
                                      {testResult.metadata.durations.call && (
                                        <DataListItem
                                          className="pf-v6-u-p-0"
                                          aria-labelledby="call-label"
                                        >
                                          <DataListItemRow>
                                            <DataListItemCells
                                              dataListCells={[
                                                <DataListCell
                                                  key="call-label"
                                                  className="pf-v6-u-p-sm"
                                                >
                                                  Call:
                                                </DataListCell>,
                                                <DataListCell
                                                  key="call-data"
                                                  className="pf-v6-u-p-sm"
                                                >
                                                  {Math.ceil(
                                                    testResult.metadata
                                                      .durations.call,
                                                  )}
                                                  s
                                                </DataListCell>,
                                              ]}
                                            />
                                          </DataListItemRow>
                                        </DataListItem>
                                      )}
                                      {testResult.metadata.durations
                                        .teardown && (
                                        <DataListItem
                                          className="pf-v6-u-p-0"
                                          aria-labelledby="teardown-label"
                                        >
                                          <DataListItemRow>
                                            <DataListItemCells
                                              dataListCells={[
                                                <DataListCell
                                                  key="teardown-label"
                                                  className="pf-v6-u-p-sm"
                                                >
                                                  Tear down:
                                                </DataListCell>,
                                                <DataListCell
                                                  key="teardown-data"
                                                  className="pf-v6-u-p-sm"
                                                >
                                                  {Math.ceil(
                                                    testResult.metadata
                                                      .durations.teardown,
                                                  )}
                                                  s
                                                </DataListCell>,
                                              ]}
                                            />
                                          </DataListItemRow>
                                        </DataListItem>
                                      )}
                                    </React.Fragment>
                                  )}
                              </DataList>
                            </DataListCell>,
                          ]}
                        />
                      </DataListItemRow>
                    </DataListItem>
                    {testResult.metadata && testResult.metadata.statuses && (
                      <DataListItem aria-labelledby="stages-label">
                        <DataListItemRow>
                          <DataListItemCells
                            dataListCells={[
                              <DataListCell key="stages-label" width={2}>
                                <strong>Stages:</strong>
                              </DataListCell>,
                              <DataListCell
                                key="stages-data"
                                width={4}
                                style={{
                                  paddingBottom: 0,
                                  paddingTop: 0,
                                  marginBottom: '-25px',
                                }}
                              >
                                <DataList
                                  selectedDataListItemId={null}
                                  aria-label="Stages"
                                  style={{ borderTop: 'none' }}
                                >
                                  {testResult.metadata.statuses.setup && (
                                    <DataListItem
                                      className="pf-v6-u-p-0"
                                      aria-labelledby="setup-label"
                                    >
                                      <DataListItemRow>
                                        <DataListItemCells
                                          dataListCells={[
                                            <DataListCell
                                              key="setup-label"
                                              className="pf-v6-u-p-sm"
                                            >
                                              Set up:
                                            </DataListCell>,
                                            <DataListCell
                                              key="setup-data"
                                              className="pf-v6-u-p-sm"
                                            >
                                              {
                                                testResult.metadata.statuses
                                                  .setup[0]
                                              }{' '}
                                              {testResult.metadata.statuses
                                                .setup[1] && '(xfail)'}
                                            </DataListCell>,
                                          ]}
                                        />
                                      </DataListItemRow>
                                    </DataListItem>
                                  )}
                                  {testResult.metadata.statuses.call && (
                                    <DataListItem
                                      className="pf-v6-u-p-0"
                                      aria-labelledby="call-label"
                                    >
                                      <DataListItemRow>
                                        <DataListItemCells
                                          dataListCells={[
                                            <DataListCell
                                              key="call-label"
                                              className="pf-v6-u-p-sm"
                                            >
                                              Call:
                                            </DataListCell>,
                                            <DataListCell
                                              key="call-data"
                                              className="pf-v6-u-p-sm"
                                            >
                                              {
                                                testResult.metadata.statuses
                                                  .call[0]
                                              }{' '}
                                              {testResult.metadata.statuses
                                                .call[1] && '(xfail)'}
                                            </DataListCell>,
                                          ]}
                                        />
                                      </DataListItemRow>
                                    </DataListItem>
                                  )}
                                  {testResult.metadata.statuses.teardown && (
                                    <DataListItem
                                      className="pf-v6-u-p-0"
                                      aria-labelledby="teardown-label"
                                    >
                                      <DataListItemRow>
                                        <DataListItemCells
                                          dataListCells={[
                                            <DataListCell
                                              key="teardown-label"
                                              className="pf-v6-u-p-sm"
                                            >
                                              Tear down:
                                            </DataListCell>,
                                            <DataListCell
                                              key="teardown-data"
                                              className="pf-v6-u-p-sm"
                                            >
                                              {
                                                testResult.metadata.statuses
                                                  .teardown[0]
                                              }{' '}
                                              {testResult.metadata.statuses
                                                .teardown[1] && '(xfail)'}
                                            </DataListCell>,
                                          ]}
                                        />
                                      </DataListItemRow>
                                    </DataListItem>
                                  )}
                                </DataList>
                              </DataListCell>,
                            ]}
                          />
                        </DataListItemRow>
                      </DataListItem>
                    )}
                    <DataListItem aria-labelledby="source-label">
                      <DataListItemRow>
                        <DataListItemCells
                          dataListCells={[
                            <DataListCell key="source-label" width={2}>
                              <strong>Source:</strong>
                            </DataListCell>,
                            <DataListCell key="source-data" width={4}>
                              {sourceLink}
                            </DataListCell>,
                          ]}
                        />
                      </DataListItemRow>
                    </DataListItem>
                    {resultParameters.length > 0 && (
                      <DataListItem aria-labelledby="params-label">
                        <DataListItemRow>
                          <DataListItemCells
                            dataListCells={[
                              <DataListCell key="params-label" width={2}>
                                <strong>Parameters:</strong>
                              </DataListCell>,
                              <DataListCell key="params-data" width={4}>
                                {resultParameters}
                              </DataListCell>,
                            ]}
                          />
                        </DataListItemRow>
                      </DataListItem>
                    )}
                    {testResult.metadata &&
                      Object.prototype.hasOwnProperty.call(
                        testResult,
                        'short_tb',
                      ) && (
                        <DataListItem aria-labelledby="traceback-label">
                          <DataListItemRow>
                            <DataListItemCells
                              dataListCells={[
                                <DataListCell key="traceback-label" width={2}>
                                  <strong>Traceback:</strong>
                                </DataListCell>,
                                <DataListCell key="traceback-data" width={4}>
                                  <div
                                    style={{
                                      overflow: 'scroll',
                                      width: '100%',
                                    }}
                                  >
                                    <pre>
                                      <code>
                                        {testResult.metadata.short_tb}
                                      </code>
                                    </pre>
                                  </div>
                                </DataListCell>,
                              ]}
                            />
                          </DataListItemRow>
                        </DataListItem>
                      )}
                  </DataList>
                </CardBody>
              </Card>
            </Tab>
          )}
          {!hideTestHistory && (
            <Tab
              key="testHistory"
              eventKey="testHistory"
              title={<TabTitle icon={<SearchIcon />} text="Test History" />}
            >
              <TestHistoryTable
                comparisonResults={comparisonResults}
                testResult={testResult}
              />
            </Tab>
          )}
          {!hideArtifact && artifactTabs && artifactTabs.length > 0
            ? artifactTabs
            : null}
          {!hideTestObject && testJson && (
            <Tab
              key="testObject"
              eventKey="testObject"
              title={<TabTitle icon={<CodeIcon />} text="Test Object" />}
            >
              <Card>
                <CardBody id="object-card-body">
                  <CodeEditor
                    isReadOnly={true}
                    isDarkTheme={darkTheme}
                    language={Language.json}
                    code={testJson}
                    height="1200px" // use sizeToFit when tab navigation is fixed
                  />
                </CardBody>
              </Card>
            </Tab>
          )}
        </Tabs>
      )}
    </React.Fragment>
  );
};

ResultView.propTypes = {
  comparisonResults: PropTypes.array,
  defaultTab: PropTypes.string,
  hideArtifact: PropTypes.bool,
  hideSummary: PropTypes.bool,
  hideTestObject: PropTypes.bool,
  hideTestHistory: PropTypes.bool,
  testResult: PropTypes.object,
  skipHash: PropTypes.bool,
};

export default ResultView;
