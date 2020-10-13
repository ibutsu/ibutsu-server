import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
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
import { FileAltIcon, FileImageIcon, InfoCircleIcon, CodeIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';
import Linkify from 'react-linkify';
import ReactJson from 'react-json-view';
import Editor from '@monaco-editor/react';

import { ClassificationDropdown } from './classification-dropdown';
import { linkifyDecorator } from './decorators'
import { Settings } from '../settings';
import { buildUrl, getIconForResult, round } from '../utilities';
import { TabTitle } from './tabs';

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
    hideSummary: PropTypes.bool,
    hideTestObject: PropTypes.bool,
  }

  constructor(props) {
    super(props);
    this.state = {
      testResult: this.props.testResult || MockTest,
      id: this.props.resultId || null,
      artifacts: [],
      artifactsTabKey: 0,
      artifactTabs: []
    };
  }

  handleArtifactsTabClick = (event, tabIndex) => {
    this.setState({
      artifactsTabKey: tabIndex
    });
  };

  getTestResult(resultId) {
    fetch(Settings.serverUrl + '/result/' + resultId)
      .then(response => response.json())
      .then(data => this.setState({testResult: data}));
  }

  getTestArtifacts(resultId) {
    fetch(buildUrl(Settings.serverUrl + '/artifact', {resultId: resultId}))
      .then(response => response.json())
      .then(data => {
        this.setState({artifacts: data.artifacts});
        let tabKey = this.props.hideSummary ? 0 : 1;
        let artifactTabs = [];
        data.artifacts.forEach((artifact) => {
          artifact.tabKey = tabKey;
          tabKey++;
          fetch(Settings.serverUrl + `/artifact/${artifact.id}/view`)
            .then(response => {
              let contentType = response.headers.get('Content-Type');
              if (contentType.includes('text')) {
                response.text().then(text => {
                  artifactTabs.push(
                    <Tab key={artifact.tabKey} eventKey={artifact.tabKey} title={<TabTitle icon={FileAltIcon} text={artifact.filename} />} style={{backgroundColor: "white"}}>
                      <Card>
                        <CardBody>
                          <Editor fontFamily="Hack, monospace" theme="dark" value={text} height="40rem" options={{readOnly: true}} />
                        </CardBody>
                        <CardFooter>
                          <Button component="a" href={`${Settings.serverUrl}/artifact/${artifact.id}/download`}>Download {artifact.filename}</Button>
                        </CardFooter>
                      </Card>
                    </Tab>
                  );
                  this.setState({artifactTabs});
                });
              }
              else if (contentType.includes('image data')) {
                response.blob().then(blob => {
                  let imageUrl = URL.createObjectURL(blob);
                  artifactTabs.push(
                    <Tab key={artifact.tabKey} eventKey={artifact.tabKey} title={<TabTitle icon={FileImageIcon} text={artifact.filename} />} style={{backgroundColor: "white"}}>
                      <Card>
                        <CardBody>
                          <img src={imageUrl} alt={artifact.filename}/>
                        </CardBody>
                        <CardFooter>
                          <Button component="a" href={`${Settings.serverUrl}/artifact/${artifact.id}/download`}>Download {artifact.filename}</Button>
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
    if (this.state.resultId || this.state.testResult.id) {
      this.getTestArtifacts(this.state.testResult.id || this.state.resultId);
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
  }

  render() {
    const testResult = this.state.testResult;
    const artifactTabs = this.state.artifactTabs;
    const resultIcon = getIconForResult(testResult.result);
    const startTime = new Date(testResult.start_time);
    const parameters = Object.keys(testResult.params).map((key) => <div key={key}>{key} = {testResult.params[key]}</div>);
    let runLink = '';
    if (testResult.run_id) {
      runLink = <Link to={`/runs/${testResult.run_id}`}>{testResult.run_id}</Link>;
    }
    return (
      <React.Fragment>
        <Tabs activeKey={this.state.artifactsTabKey} onSelect={this.handleArtifactsTabClick}>
          {!this.props.hideSummary &&
          <Tab eventKey={0} title={<TabTitle icon={InfoCircleIcon} text="Summary" />} style={{backgroundColor: "white"}}>
            <Card>
              <CardBody style={{padding: 0}}>
                <DataList selectedDataListItemId={null} aria-label="Test Result" style={{borderBottom: "none", borderTop: "none"}}>
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
                          <DataListCell key="component-data" width={4}><Link to={`/results?component[eq]=${testResult.component}`}>{testResult.component}</Link></DataListCell>
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
                          <DataListCell key="duration-data" width={4} style={{paddingTop: 0, paddingBottom: 0, marginBottom: "-25px"}}>
                            <DataList selectedDataListItemId={null} aria-label="Durations" style={{borderTop: "none"}}>
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
                            <DataListCell key="stages-data" width={4} style={{paddingBottom: 0, paddingTop: 0, marginBottom: "-25px"}}>
                              <DataList selectedDataListItemId={null} aria-label="Stages" style={{borderTop: "none"}}>
                                {testResult.metadata.statuses.setup &&
                                  <DataListItem className="pf-u-p-0" aria-labelledby="setup-label">
                                    <DataListItemRow>
                                      <DataListItemCells
                                        dataListCells={[
                                          <DataListCell key="setup-label" className="pf-u-p-sm">Set up:</DataListCell>,
                                          <DataListCell key="setup-data" className="pf-u-p-sm">{testResult.metadata.statuses.setup[0]} {testResult.metadata.statuses.setup[1] && "(xfail)"}</DataListCell>
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
                                          <DataListCell key="call-data" className="pf-u-p-sm">{testResult.metadata.statuses.call[0]} {testResult.metadata.statuses.call[1] && "(xfail)"}</DataListCell>
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
                                          <DataListCell key="teardown-data" className="pf-u-p-sm">{testResult.metadata.statuses.teardown[0]} {testResult.metadata.statuses.teardown[1] && "(xfail)"}</DataListCell>
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
                          <DataListCell key="source-data" width={4}><Link to={`/results?source[eq]=${testResult.source}`}>{testResult.source}</Link></DataListCell>
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
                              <DataListCell key="traceback-data" width={4}><div style={{overflow: "scroll", width: "100%"}}><pre><code>{testResult.metadata.short_tb}</code></pre></div></DataListCell>
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
          {artifactTabs}
          {!this.props.hideTestObject &&
          <Tab eventKey={99} title={<TabTitle icon={CodeIcon} text="Test Object" />} style={{backgroundColor: "white"}}>
            <Card>
              <CardBody>
                <ReactJson src={testResult} name={null} iconStyle={"triangle"} collapseStringsAfterLength={120} enableClipboard={false} displayDataTypes={false} />
              </CardBody>
            </Card>
          </Tab>
          }
        </Tabs>
      </React.Fragment>
    );
  }
}
