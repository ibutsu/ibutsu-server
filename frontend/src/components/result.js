import React from 'react';
import PropTypes from 'prop-types';

import {
  Card,
  CardBody,
  CardFooter,
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
import { FileAltIcon, FileImageIcon, InfoCircleIcon, CodeIcon, SearchIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';
import Linkify from 'react-linkify';
import { JSONTree } from 'react-json-tree';
import Editor from '@monaco-editor/react';

import * as http from '../services/http';
import { ClassificationDropdown } from './classification-dropdown';
import { DownloadButton } from './download-button';
import { linkifyDecorator } from './decorators'
import { Settings } from '../settings';
import { getIconForResult, getTheme, round } from '../utilities';
import { TabTitle } from './tabs';
import { TestHistoryTable } from './test-history';

const MockTest = {
  id: null,
  duration: null,
  metadata: {
    durations: {
      setup: null,
      call: null,
      teardown: null
    },
    run: null,
    short_tb: null,
    statuses: {
      setup: [null, null],
      call: [null, null],
      teardown: [null, null]
    }
  },
  params: {},
  result: '',
  source: null,
  start_time: 0,
  test_id: ''
};

export class ResultView extends React.Component {
  static propTypes = {
    testResult: PropTypes.object,
    resultId: PropTypes.string,
    defaultTab: PropTypes.string,
    hideSummary: PropTypes.bool,
    hideTestObject: PropTypes.bool,
    hideTestHistory: PropTypes.bool,
    navigate: PropTypes.func,
    location: PropTypes.object,
    comparisonResults: PropTypes.array,
    hideArtifact: PropTypes.bool
  }

  constructor(props) {
    super(props);
    this.state = {
      testResult: this.props.testResult || MockTest,
      id: this.props.resultId || null,
      artifacts: [],
      activeTab: this.getTabIndex(this.getDefaultTab()),
      artifactTabs: [],
      testHistoryTable: null,
      comparisonResults: this.props.comparisonResults
    };
  }

  getDefaultTab() {
    if (this.props.defaultTab) {
      return this.props.defaultTab;
    }
    else if (!this.props.hideSummary) {
      return 'summary';
    }
    else if (!!this.state && this.state.artifactTabs.length > 0) {
      return this.state.artifactTabs[0].key;
    }
    else {
      return null;
    }
  }

  getTabIndex(defaultValue) {
    defaultValue = defaultValue || null;
    if (!!this.props.location && this.props.location.hash !== '') {
      return this.props.location.hash.substring(1);
    }
    else {
      return defaultValue;
    }
  }

  updateTab(tabIndex) {
    if (tabIndex === 'test-history') {
      this.getTestHistoryTable();
    }
  }

  onTabSelect = (_event, tabIndex) => {
    const loc = this.props.location;
    if (loc) {
      this.props.navigate(`${loc.pathname}${loc.search}#${tabIndex}`)
    }
    this.setState({activeTab: tabIndex});
    this.updateTab(tabIndex);
  };

  getTestHistoryTable = () => {
    if (this.state.comparisonResults !== undefined) {
      this.setState({testHistoryTable: <TestHistoryTable comparisonResults={this.state.comparisonResults} testResult={this.state.testResult}/>});
    } else {
      this.setState({testHistoryTable: <TestHistoryTable testResult={this.state.testResult}/>});
    }

  }

  getTestResult(resultId) {
    http.HttpClient.get([Settings.serverUrl, 'result', resultId])
      .then(response => http.HttpClient.handleResponse(response))
      .then(data => this.setState({testResult: data}));
  }

  getTestArtifacts(resultId) {
    http.HttpClient.get([Settings.serverUrl, 'artifact'], {resultId: resultId})
      .then(response => http.HttpClient.handleResponse(response))
      .then(data => {
        let artifactTabs = [];
        data.artifacts.forEach((artifact) => {
          let downloadUrl = `${Settings.serverUrl}/artifact/${artifact.id}/download`;
          http.HttpClient.get([Settings.serverUrl, 'artifact', artifact.id, 'view'])
            .then(response => {
              let contentType = response.headers.get('Content-Type');
              if (contentType.includes('text')) {
                response.text().then(text => {
                  artifactTabs.push(
                    <Tab key={artifact.id} eventKey={artifact.id} title={<TabTitle icon={FileAltIcon} text={artifact.filename} />}>
                      <Card>
                        <CardBody>
                          <Editor fontFamily="Noto Sans Mono, Hack, monospace" theme="vs-dark" value={text} height="40rem" options={{readOnly: true}} />
                        </CardBody>
                        <CardFooter>
                          <DownloadButton url={downloadUrl} filename={artifact.filename}>Download {artifact.filename}</DownloadButton>
                        </CardFooter>
                      </Card>
                    </Tab>
                  );
                  this.setState({artifactTabs});
                });
              }
              else if (contentType.includes('image')) {
                response.blob().then(blob => {
                  let imageUrl = URL.createObjectURL(blob);
                  artifactTabs.push(
                    <Tab key={artifact.id} eventKey={artifact.id} title={<TabTitle icon={FileImageIcon} text={artifact.filename} />}>
                      <Card>
                        <CardBody>
                          <img src={imageUrl} alt={artifact.filename}/>
                        </CardBody>
                        <CardFooter>
                          <DownloadButton url={downloadUrl} filename={artifact.filename}>Download {artifact.filename}</DownloadButton>
                        </CardFooter>
                      </Card>
                    </Tab>
                  );
                  this.setState({artifactTabs});
                });
              }
            });
        });
      });
  }

  getResult() {
    if (this.state.resultId && !this.state.testResult.id) {
      this.getTestResult(this.state.resultId);
    }
    if (this.state.resultId || (this.state.testResult && this.state.testResult.id)) {
      this.getTestArtifacts(this.state.testResult.id || this.state.resultId || this.state.id);
    }
  }

  componentDidUpdate() {
    if (this.props.testResult !== this.state.testResult) {
      this.setState({testResult: this.props.testResult}, () => this.getResult());
    }
    else if (this.props.resultId !== this.state.resultId) {
      this.setState({resultId: this.props.resultId}, () => this.getResult());
    }
  }

  componentDidMount() {
    this.getResult();
    if (this.state.activeTab === 'test-history') {
      this.getTestHistoryTable();
    }
    window.addEventListener('popstate', this.handlePopState);
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this.handlePopState);
  }

  handlePopState = () => {
    // Handle browser navigation buttons click
    const tabIndex = this.getTabIndex('summary');
    this.setState({activeTab: tabIndex}, () => {
      this.updateTab(tabIndex);
    });
  };

  render() {
    let { testResult, artifactTabs, activeTab, testHistoryTable } = this.state;
    const jsonViewLightThemeOn = getTheme() === 'dark' ? false : true ;
    if (activeTab === null) {
      activeTab = this.getDefaultTab();
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
    const jsonViewTheme = {
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
    return (
      <React.Fragment>
        {this.state.testResult &&
        <Tabs activeKey={activeTab} onSelect={this.onTabSelect} isBox>
          {!this.props.hideSummary &&
          <Tab eventKey="summary" title={<TabTitle icon={InfoCircleIcon} text="Summary" />}>
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
          {!this.props.hideArtifact && artifactTabs}
          {!this.props.hideTestHistory &&
          <Tab eventKey="test-history" title={<TabTitle icon={SearchIcon} text="Test History"/>}>
          {testHistoryTable}
          </Tab>
          }
          {!this.props.hideTestObject &&
          <Tab eventKey="test-object" title={<TabTitle icon={CodeIcon} text="Test Object" />}>
            <Card>
              <CardBody>
                <JSONTree data={testResult} theme={jsonViewTheme} invertTheme={jsonViewLightThemeOn} hideRoot shouldExpandNodeInitially={() => true}/>
              </CardBody>
            </Card>
          </Tab>
          }
        </Tabs>
        }
      </React.Fragment>
    );
  }
}
