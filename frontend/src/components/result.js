import React, { useState, useEffect, useCallback } from 'react';
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
  Tab
} from '@patternfly/react-core';
import { InfoCircleIcon, CodeIcon, SearchIcon, FileAltIcon } from '@patternfly/react-icons';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Linkify from 'react-linkify';
import { JSONTree } from 'react-json-tree';

import * as http from '../services/http';
import { ClassificationDropdown } from './classification-dropdown';
import { linkifyDecorator } from './decorators';
import { Settings } from '../settings';
import { getIconForResult, getDarkTheme, round } from '../utilities';
import TabTitle from './tabs';
import { TestHistoryTable } from './test-history';
import ArtifactTab from './artifact-tab';

const JSONTHEME = {
  scheme: 'monokai',
  author: 'wimer hazenberg (http://www.monokai.nl)',
  base00: '#272822',
  base01: '#383830',
  base02: '#49483e',
  base03: '#75715e',
  base04: '#a59f85',
  base05: '#f8f8f2',
  base06: '#f5f4f1',
  base07: '#f9f8f5',
  base08: '#f92672',
  base09: '#fd971f',
  base0A: '#f4bf75',
  base0B: '#a6e22e',
  base0C: '#a1efe4',
  base0D: '#66d9ef',
  base0E: '#ae81ff',
  base0F: '#cc6633',
};

const ResultView = (props) => {
  const {
    comparisonResults,
    defaultTab,
    hideArtifact=false,
    hideSummary=false,
    hideTestObject=false,
    hideTestHistory=false,
    testResult
  } = props;

  // State
  const [artifacts, setArtifacts] = useState([]);
  const [artifactTabs, setArtifactTabs] = useState([]);
  const [testHistoryTable, setTestHistoryTable] = useState(null);

  // Hooks
  const navigate = useNavigate();
  const location = useLocation();

  const getDefaultTab = () => {
    if (defaultTab) {
      return defaultTab;
    }
    else if (!hideSummary) {
      return 'summary';
    }
    else if (!!artifactTabs.length > 0) {
      return artifactTabs[0].key;
    }
    else {
      return null;
    }
  };

  const getTabIndex = useCallback((defaultValue) => {
    defaultValue = defaultValue || null;
    if (!!location && location.hash !== '') {
      return location.hash.substring(1);
    }
    else {
      return defaultValue;
    }
  },[location]);

  const getTestHistoryTable = useCallback(() => {
    if (comparisonResults !== undefined) {
      setTestHistoryTable(
        <TestHistoryTable
          comparisonResults={comparisonResults}
          testResult={testResult}
        />);
    } else {
      setTestHistoryTable(
        <TestHistoryTable testResult={testResult}/>);
    }

  }, [setTestHistoryTable, comparisonResults, testResult]);

  const [activeTab, setActiveTab] = useState(getTabIndex(getDefaultTab()));


  useEffect(() => {
    if (activeTab === 'test-history') {
      getTestHistoryTable();
    }
  }, [activeTab, getTestHistoryTable]);

  const handlePopState = useCallback(() => {
    // Handle browser navigation buttons click
    const tabIndex = getTabIndex('summary');
    setActiveTab(tabIndex);
  }, [getTabIndex, setActiveTab]);

  useEffect(()=>{
    if (activeTab === 'test-history') {
      getTestHistoryTable();
    }
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeTab, getTestHistoryTable, handlePopState]);

  const onTabSelect = (_event, tabIndex) => {
    if (location) {
      navigate(`${location.pathname}${location.search}#${tabIndex}`);
    }
    setActiveTab(tabIndex);
  };

  useEffect(() => {
    const artTabs=[];
    artifacts.forEach((art) => {
      artTabs.push(
        <Tab
          key={art.filename}
          eventKey={art.filename}
          title={<TabTitle
            icon={<FileAltIcon/>}
            text={art.filename}/>}><ArtifactTab artifact={art} /></Tab>
      );
    });
    setArtifactTabs(artTabs);
  }, [artifacts]);

  useEffect(() => {
    // Get artifacts when the test result changes
    if (testResult) {
      http.HttpClient.get([Settings.serverUrl, 'artifact'], {resultId: testResult.id})
        .then(response => http.HttpClient.handleResponse(response))
        .then(data => { setArtifacts(data['artifacts']); })
        .catch((error) => console.error(error));
    } else {
      setArtifacts([]);
    }
  }, [testResult]);

  const jsonViewLightThemeOn = !getDarkTheme;
  if (activeTab === null) {
    setActiveTab(getDefaultTab());
  }
  let resultIcon = getIconForResult('pending');
  let startTime = new Date();
  let parameters = <div/>;
  let runLink = '';
  if (testResult) {
    resultIcon = getIconForResult(testResult.result);
    startTime = new Date(testResult.start_time);
    parameters = Object.keys(testResult.params).map((key) => <div key={key}>{key} = {testResult.params[key]}</div>);
    runLink = <Link to={`../runs/${testResult.run_id}`} relative="Path">{testResult.run_id}</Link>;
  }

  return (
    <React.Fragment>
      {testResult &&
      <Tabs activeKey={activeTab} onSelect={onTabSelect} isBox>
        {!hideSummary &&
        <Tab key="summary" eventKey="summary" title={<TabTitle icon={<InfoCircleIcon/>} text="Summary" />}>
          <Card>
            <CardBody style={{padding: 0}}>
              <DataList selectedDataListItemId={null} aria-label="Test Result" style={{borderBottom: 'none', borderTop: 'none'}}>
                <DataListItem isExpanded={false} aria-labelledby="result-label">
                  <DataListItemRow>
                    <DataListItemCells
                      dataListCells={[
                        <DataListCell key="result-label" width={2}><strong>Result:</strong></DataListCell>,
                        <DataListCell key="result-data" width={4}><span className={testResult.result}>{resultIcon} {testResult.result}</span></DataListCell>
                      ]}
                    />
                  </DataListItemRow>
                </DataListItem>
                <DataListItem aria-labelledby="run-label">
                  <DataListItemRow>
                    <DataListItemCells
                      dataListCells={[
                        <DataListCell key="run-label" width={2}><strong>Run:</strong></DataListCell>,
                        <DataListCell key="run-data" width={4}>{runLink}</DataListCell>
                      ]}
                    />
                  </DataListItemRow>
                </DataListItem>
                {testResult.component &&
              <DataListItem aria-labelledby="component-label">
                <DataListItemRow>
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell key="component-label" width={2}><strong>Component:</strong></DataListCell>,
                      <DataListCell key="component-data" width={4}><Link to={`../results?component[eq]=${testResult.component}`} relative="Path">{testResult.component}</Link></DataListCell>
                    ]}
                  />
                </DataListItemRow>
              </DataListItem>
                }
                {testResult.metadata && testResult.metadata.code_link &&
              <DataListItem aria-labelledby="code-link-label">
                <DataListItemRow>
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell key="code-link-label" width={2}><strong>Code Link:</strong></DataListCell>,
                      <DataListCell key="code-link-data" width={4}><Linkify componentDecorator={linkifyDecorator}>{testResult.metadata.code_link}</Linkify></DataListCell>
                    ]}
                  />
                </DataListItemRow>
              </DataListItem>
                }
                {testResult.metadata && testResult.metadata.tags &&
              <DataListItem aria-labelledby="tags-label">
                <DataListItemRow>
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell key="tags-label" width={2}><strong>Tags:</strong></DataListCell>,
                      <DataListCell key="tags-data" width={4}>
                        <Flex>
                          {testResult.metadata.tags.map((tag) => <FlexItem spacer={{ default: 'spacerXs' }} key={tag}><Label color="blue" variant="filled">{tag}</Label></FlexItem>)}
                        </Flex>
                      </DataListCell>
                    ]}
                  />
                </DataListItemRow>
              </DataListItem>
                }
                {testResult.result === 'skipped' && testResult.metadata && testResult.metadata.skip_reason &&
              <DataListItem aria-labelledby="skip-reason-label">
                <DataListItemRow>
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell key="skip-reason-label" width={2}><strong>Reason skipped:</strong></DataListCell>,
                      <DataListCell key="skip-reason-data" width={4}><Linkify componentDecorator={linkifyDecorator}>{testResult.metadata.skip_reason}</Linkify></DataListCell>
                    ]}
                  />
                </DataListItemRow>
              </DataListItem>
                }
                {testResult.result === 'xfailed' && testResult.metadata && testResult.metadata.xfail_reason &&
              <DataListItem aria-labelledby="xfail-reason-label">
                <DataListItemRow>
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell key="xfail-reason-label" width={2}><strong>Reason xfailed:</strong></DataListCell>,
                      <DataListCell key="xfail-reason-data" width={4}><Linkify componentDecorator={linkifyDecorator}>{testResult.metadata.xfail_reason}</Linkify></DataListCell>
                    ]}
                  />
                </DataListItemRow>
              </DataListItem>
                }
                {(testResult.result === 'failed' || testResult.result === 'error' || testResult.result === 'skipped') &&
              <DataListItem aria-labelledby="classification-label">
                <DataListItemRow>
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell key="classification-label" width={2}><strong>Classification:</strong></DataListCell>,
                      <DataListCell key="classification-data" width={4}>
                        <ClassificationDropdown testResult={testResult} />
                      </DataListCell>
                    ]}
                  />
                </DataListItemRow>
              </DataListItem>
                }
                <DataListItem aria-labelledby="duration">
                  <DataListItemRow>
                    <DataListItemCells
                      dataListCells={[
                        <DataListCell key="duration-label" width={2}><strong>Duration:</strong></DataListCell>,
                        <DataListCell key="duration-data" width={4} style={{paddingTop: 0, paddingBottom: 0, marginBottom: '-25px'}}>
                          <DataList selectedDataListItemId={null} aria-label="Durations" style={{borderTop: 'none'}}>
                            {(testResult.start_time ? testResult.start_time : testResult.starttime) > 0 &&
                            <DataListItem className="pf-u-p-0" aria-labelledby="started-label">
                              <DataListItemRow>
                                <DataListItemCells
                                  dataListCells={[
                                    <DataListCell key="started-label" className="pf-u-p-sm">Started at:</DataListCell>,
                                    <DataListCell key="started-data" className="pf-u-p-sm">{startTime.toLocaleString()}</DataListCell>
                                  ]}
                                />
                              </DataListItemRow>
                            </DataListItem>
                            }
                            <DataListItem className="pf-u-p-0" aria-labelledby="total-label">
                              <DataListItemRow>
                                <DataListItemCells
                                  dataListCells={[
                                    <DataListCell key="total-label" className="pf-u-p-sm">Total:</DataListCell>,
                                    <DataListCell key="total-data" className="pf-u-p-sm">{round(testResult.duration)}s</DataListCell>
                                  ]}
                                />
                              </DataListItemRow>
                            </DataListItem>
                            {testResult.metadata && testResult.metadata.durations &&
                            <React.Fragment>
                              {testResult.metadata.durations.setup &&
                                <DataListItem className="pf-u-p-0" aria-labelledby="setup-label">
                                  <DataListItemRow>
                                    <DataListItemCells
                                      dataListCells={[
                                        <DataListCell key="setup-label" className="pf-u-p-sm">Set up:</DataListCell>,
                                        <DataListCell key="setup-data" className="pf-u-p-sm">{round(testResult.metadata.durations.setup)}s</DataListCell>
                                      ]}
                                    />
                                  </DataListItemRow>
                                </DataListItem>
                              }
                              {testResult.metadata.durations.call &&
                                <DataListItem className="pf-u-p-0" aria-labelledby="call-label">
                                  <DataListItemRow>
                                    <DataListItemCells
                                      dataListCells={[
                                        <DataListCell key="call-label" className="pf-u-p-sm">Call:</DataListCell>,
                                        <DataListCell key="call-data" className="pf-u-p-sm">{round(testResult.metadata.durations.call)}s</DataListCell>
                                      ]}
                                    />
                                  </DataListItemRow>
                                </DataListItem>
                              }
                              {testResult.metadata.durations.teardown &&
                                <DataListItem className="pf-u-p-0" aria-labelledby="teardown-label">
                                  <DataListItemRow>
                                    <DataListItemCells
                                      dataListCells={[
                                        <DataListCell key="teardown-label" className="pf-u-p-sm">Tear down:</DataListCell>,
                                        <DataListCell key="teardown-data" className="pf-u-p-sm">{round(testResult.metadata.durations.teardown)}s</DataListCell>
                                      ]}
                                    />
                                  </DataListItemRow>
                                </DataListItem>
                              }
                            </React.Fragment>
                            }
                          </DataList>
                        </DataListCell>
                      ]}
                    />
                  </DataListItemRow>
                </DataListItem>
                {testResult.metadata && testResult.metadata.statuses &&
                <DataListItem aria-labelledby="stages-label">
                  <DataListItemRow>
                    <DataListItemCells
                      dataListCells={[
                        <DataListCell key="stages-label" width={2}><strong>Stages:</strong></DataListCell>,
                        <DataListCell key="stages-data" width={4} style={{paddingBottom: 0, paddingTop: 0, marginBottom: '-25px'}}>
                          <DataList selectedDataListItemId={null} aria-label="Stages" style={{borderTop: 'none'}}>
                            {testResult.metadata.statuses.setup &&
                              <DataListItem className="pf-u-p-0" aria-labelledby="setup-label">
                                <DataListItemRow>
                                  <DataListItemCells
                                    dataListCells={[
                                      <DataListCell key="setup-label" className="pf-u-p-sm">Set up:</DataListCell>,
                                      <DataListCell key="setup-data" className="pf-u-p-sm">{testResult.metadata.statuses.setup[0]} {testResult.metadata.statuses.setup[1] && '(xfail)'}</DataListCell>
                                    ]}
                                  />
                                </DataListItemRow>
                              </DataListItem>
                            }
                            {testResult.metadata.statuses.call &&
                              <DataListItem className="pf-u-p-0" aria-labelledby="call-label">
                                <DataListItemRow>
                                  <DataListItemCells
                                    dataListCells={[
                                      <DataListCell key="call-label" className="pf-u-p-sm">Call:</DataListCell>,
                                      <DataListCell key="call-data" className="pf-u-p-sm">{testResult.metadata.statuses.call[0]} {testResult.metadata.statuses.call[1] && '(xfail)'}</DataListCell>
                                    ]}
                                  />
                                </DataListItemRow>
                              </DataListItem>
                            }
                            {testResult.metadata.statuses.teardown &&
                              <DataListItem className="pf-u-p-0" aria-labelledby="teardown-label">
                                <DataListItemRow>
                                  <DataListItemCells
                                    dataListCells={[
                                      <DataListCell key="teardown-label" className="pf-u-p-sm">Tear down:</DataListCell>,
                                      <DataListCell key="teardown-data" className="pf-u-p-sm">{testResult.metadata.statuses.teardown[0]} {testResult.metadata.statuses.teardown[1] && '(xfail)'}</DataListCell>
                                    ]}
                                  />
                                </DataListItemRow>
                              </DataListItem>
                            }
                          </DataList>
                        </DataListCell>
                      ]}
                    />
                  </DataListItemRow>
                </DataListItem>
                }
                <DataListItem aria-labelledby="source-label">
                  <DataListItemRow>
                    <DataListItemCells
                      dataListCells={[
                        <DataListCell key="source-label" width={2}><strong>Source:</strong></DataListCell>,
                        <DataListCell key="source-data" width={4}><Link to={`../results?source[eq]=${testResult.source}`} relative="Path">{testResult.source}</Link></DataListCell>
                      ]}
                    />
                  </DataListItemRow>
                </DataListItem>
                {parameters.length > 0 &&
                <DataListItem aria-labelledby="params-label">
                  <DataListItemRow>
                    <DataListItemCells
                      dataListCells={[
                        <DataListCell key="params-label" width={2}><strong>Parameters:</strong></DataListCell>,
                        <DataListCell key="params-data" width={4}>{parameters}</DataListCell>
                      ]}
                    />
                  </DataListItemRow>
                </DataListItem>
                }
                {testResult.metadata && Object.prototype.hasOwnProperty.call(testResult, 'short_tb') &&
                <DataListItem aria-labelledby="traceback-label">
                  <DataListItemRow>
                    <DataListItemCells
                      dataListCells={[
                        <DataListCell key="traceback-label" width={2}><strong>Traceback:</strong></DataListCell>,
                        <DataListCell key="traceback-data" width={4}><div style={{overflow: 'scroll', width: '100%'}}><pre><code>{testResult.metadata.short_tb}</code></pre></div></DataListCell>
                      ]}
                    />
                  </DataListItemRow>
                </DataListItem>
                }
              </DataList>
            </CardBody>
          </Card>
        </Tab>
        }
        {!hideArtifact &&
          artifactTabs}
        {!hideTestHistory &&
        <Tab key="test-history" eventKey="test-history" title={<TabTitle icon={<SearchIcon/>} text="Test History"/>}>
          {testHistoryTable}
        </Tab>
        }
        {!hideTestObject &&
        <Tab key="test-object" eventKey="test-object" title={<TabTitle icon={<CodeIcon/>} text="Test Object" />}>
          <Card>
            <CardBody>
              <JSONTree data={testResult} theme={JSONTHEME} invertTheme={jsonViewLightThemeOn} hideRoot shouldExpandNodeInitially={() => true}/>
            </CardBody>
          </Card>
        </Tab>
        }
      </Tabs>
      }
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
};

export default ResultView;
