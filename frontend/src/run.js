import React from 'react';
import PropTypes from 'prop-types';

import {
  Badge,
  Bullseye,
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
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
  TextInput
} from '@patternfly/react-core';
import {
  CatalogIcon,
  ChevronRightIcon,
  CodeIcon,
  FileAltIcon,
  FileImageIcon,
  InfoCircleIcon,
  MessagesIcon,
  RepositoryIcon
} from '@patternfly/react-icons';

import { Link } from 'react-router-dom';
import ReactJson from 'react-json-view';
import Editor from '@monaco-editor/react';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import {
  cleanPath,
  convertDate,
  getSpinnerRow,
  getTheme,
  processPyTestPath,
  resultToRow,
  round
} from './utilities';
import {
  DownloadButton,
  EmptyObject,
  FilterTable,
  ClassifyFailuresTable,
  ResultView,
  TabTitle
} from './components';
import TreeView from 'react-simple-jstree';

const MockRun = {
  id: null,
  duration: null,
  summary: {
    failures: 0,
    errors: 0,
    skips: 0,
    xfailures: 0,
    xpasses: 0,
    tests: 0
  }
};

const colors = {
  'failed': 'rgb(201, 8, 19)',
  'error': 'rgb(223, 169, 78)',
  'passed': 'rgb(92, 183, 92)',
  'skipped': 'rgb(28, 172, 233)',
  'xfailed': 'rgb(132, 118, 209)',
  'xpassed': 'rgb(31, 0, 102)',
};

const icons = {
  'failed': 'pf-icon-error-circle-o',
  'error': 'pf-icon-warning-triangle',
  'passed': 'pf-icon-ok',
  'skipped': 'pf-icon-off',
  'xfailed': 'pf-icon-ok',
  'xpassed': 'pf-icon-error-circle-o',
};

const match = (node, text) => {
  return node.name.toLowerCase().indexOf(text.toLowerCase()) !== -1;
};

const findNode = (node, text) => {
  return match(node, text) || (
    node.children && node.children.length && !!node.children.find(child => findNode(child, text))
  );
};

const searchTree = (node, text) => {
  if (match(node, text) || !node.children) {
    return node;
  }
  const filtered = node.children
    .filter(child => findNode(child, text))
    .map(child => searchTree(child, text));
  return Object.assign({}, node, {children: filtered});
};

export class Run extends React.Component {
  static propTypes = {
    match: PropTypes.object,
    history: PropTypes.object,
    location: PropTypes.object
  };

  constructor(props) {
    super(props);
    this.state = {
      run: MockRun,
      id: props.match.params.id,
      testResult: null,
      columns: ['Test', 'Run', 'Result', 'Duration', 'Started'],
      rows: [getSpinnerRow(5)],
      results: [],
      selectedResults: [],
      cursor: null,
      filteredTree: {},
      activeTab: this.getTabIndex('summary'),
      treeSearch: '',
      pageSize: 10,
      page: 1,
      totalItems: 0,
      totalPages: 0,
      isRunValid: false,
      isEmpty: false,
      isError: false,
      resultsTree: {core: {data: []}},
      treeData: [],
      artifacts: [],
      artifactTabs: []
    };
    // Watch the history to update tabs
    this.unlisten = this.props.history.listen(() => {
      const tabIndex = this.getTabIndex('summary');
      this.setState({activeTab: tabIndex}, () => {
        this.updateTab(tabIndex);
      });
    });
  }

  getTabIndex(defaultValue) {
    defaultValue = defaultValue || null;
    return this.props.location.hash !== '' ? this.props.location.hash.substring(1) : defaultValue;
  }

  buildTree(results) {
    let tests = {
      '_sub': {
      },
      '_stats': {
        'count': 0,
        'passed': 0,
        'failed': 0,
        'skipped': 0,
        'error': 0,
        'xpassed': 0,
        'xfailed': 0
      },
      '_duration': 0.0
    };
    results.forEach((testResult) => {
      this.buildTreeObject(cleanPath(testResult.metadata.fspath) + '/' + testResult.test_id, tests, testResult);
    });
    let cloud = [];
    this.buildJSTreeStructure(tests, cloud);
    return {core: {data: cloud}};
  }

  buildTreeObject(path, container, data) {
    let segs;
    if (!Array.isArray(path)) {
      segs = processPyTestPath(path);
    }
    else {
      segs = path;
    }
    let head = segs[0];
    let end = segs.slice(1);
    if (end.length === 0) {
      container['_sub'][head] = data;
      if (Object.prototype.hasOwnProperty.call(container['_stats'], data['result'])) {
        container['_stats'][data['result']] += 1;
      }
      else {
        container['_stats']['failed'] += 1;
      }
      container['_stats']['count'] += 1;
      container['_duration'] += data['duration'] || 0.0;
      container['_test_result'] = data;
    }
    else {
      if (Object.prototype.hasOwnProperty.call(container['_sub'], head) === false) {
        container['_sub'][head] = {
          '_sub': {},
          '_stats': {
            'count': 0,
            'passed': 0,
            'failed': 0,
            'skipped': 0,
            'error': 0,
            'xpassed': 0,
            'xfailed': 0
          },
          '_duration': 0.0
        };
      }
      this.buildTreeObject(end, container['_sub'][head], data);
      if (Object.prototype.hasOwnProperty.call(container['_stats'], data['result'])) {
        container['_stats'][data['result']] += 1;
      }
      else {
        container['_stats']['failed'] += 1;
      }
      container['_stats']['count'] += 1;
      container['_duration'] += data['duration'] || 0.0;
    }
  }

  buildJSTreeStructure(container, dest){
    Object.keys(container['_sub']).forEach(key => {
      let testResult = container['_sub'][key];
      if (Object.prototype.hasOwnProperty.call(testResult, '_sub')) {
        let children = [];
        let percent = '';
        if (testResult['_stats']['count'] !== 0) {
          percent = Math.round(((testResult['_stats']['passed'] + testResult['_stats']['xfailed']) / testResult['_stats']['count']) * 100);
        }
        else {
          percent = 'N/A';
        }
        let status = 'failed';
        if (percent > 75) {
          status = 'error';
        }
        if (percent > 90) {
          status = 'passed';
        }
        let percentString = '<span name="mod_lev" class="pf-c-label pf-m-compact" style="padding: 3px; margin:2px; background-color:' + colors[status] + '">' + percent + '%</span>';
        let durationString = '<span style="color:#aaa"><em>' + convertDate(testResult['_duration']) + '</em></span>';
        dest.push({
          text: key + ' ' + percentString + durationString,
          children: children,
          state: {"opened": key.includes(".py") ? false : true}  // expand to the level of the test file
        });
        this.buildJSTreeStructure(testResult, children)
      }
      else if (Object.prototype.hasOwnProperty.call(testResult, 'test_id')) {
        let color = colors[testResult['result']];
        let durationString = '<span style="color:#aaa"><em>' + convertDate(testResult['duration'] || 0) + '</em></span>';
        let icon = '<span style="color:' + color + '";"><i class="pf-icon ' + icons[testResult['result']] + '"></i></span>&nbsp;';
        dest.push({
          text: icon + testResult['test_id'] + durationString,
          data: testResult,
          id: testResult['id'],
          icon: false,
          testResult: testResult
        });
      }
    });
  }

  getRunArtifacts() {
    HttpClient.get([Settings.serverUrl, 'artifact'], {runId: this.state.id})
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        let artifactTabs = [];
        data.artifacts.forEach((artifact) => {
          let downloadUrl = `${Settings.serverUrl}/artifact/${artifact.id}/download`;
          HttpClient.get([Settings.serverUrl, 'artifact', artifact.id, 'view'])
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

  updateTab(tabIndex) {
    if (tabIndex === 'results-list') {
      this.getResultsForTable();
    }
    else if (tabIndex === 'results-tree') {
      this.getResultsForTree(1);
    }
    else if (tabIndex === 'classify-failures') {
      this.getClassificationTable();
    }
  }

  onSearch = (value) => {
    this.setState({treeSearch: value}, this.setFilteredTree);
  }

  onTabSelect = (event, tabIndex) => {
    const loc = this.props.history.location;
    this.props.history.push({
      pathname: loc.pathname,
      search: loc.search,
      hash: '#' + tabIndex
    });
    this.setState({activeTab: tabIndex});
    this.updateTab(tabIndex);
  }

  getClassificationTable = () => {
    this.setState({classificationTable: <ClassifyFailuresTable run_id={this.state.id}/>});
  }

  onToggle = (node) => {
    if (node.result) {
      this.setState({currentTest: node.result}, () => {
        if (!this.state.currentTest.artifacts) {
          HttpClient.get([Settings.serverUrl, 'artifact'], {resultId: this.state.currentTest.id})
            .then(response => HttpClient.handleResponse(response))
            .then(data => {
              let { currentTest } = this.state;
              currentTest.artifacts = data.artifacts;
              this.setState({currentTest})
            });
        }
      });
    }
  }

  setFilteredTree() {
    if (!this.state.treeSearch) {
      this.setState({filteredTree: this.state.resultsTree});
    }
    else {
      this.setState({filteredTree: searchTree(this.state.resultsTree, this.state.treeSearch)});
    }
  }

  setPage = (_event, pageNumber) => {
    this.setState({page: pageNumber}, () => {
      this.getResultsForTable();
    });
  }

  pageSizeSelect = (_event, perPage) => {
    this.setState({pageSize: perPage}, () => {
      this.getResultsForTable();
    });
  }

  refreshResults = () => {
    this.getResultsForTable();
  }

  getRun() {
    HttpClient.get([Settings.serverUrl, 'run', this.state.id])
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        if (response.ok) {
          this.setState({"isRunValid": true});
        } else {
          throw new Error("Failed with HTTP code " + response.status);
        }
        return response.json();
      })
      .then(data => this.setState({run: data}, () => {
        this.getRunArtifacts();
        this.updateTab(this.state.activeTab);
      }))
      .catch(error => console.log(error));
  }

  getResultsForTable() {
    this.setState({rows: [getSpinnerRow(5)], isEmpty: false, isError: false});
    let params = {filter: 'run_id=' + this.state.id};
    params['pageSize'] = this.state.pageSize;
    params['page'] = this.state.page;
    this.setState({rows: [['Loading...', '', '', '']]});
    HttpClient.get([Settings.serverUrl, 'result'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({
          results: data.results,
          rows: data.results.map((result) => resultToRow(result)),
          page: data.pagination.page,
          pageSize: data.pagination.pageSize,
          totalItems: data.pagination.totalItems,
          totalPages: data.pagination.totalPages,
          isEmpty: data.pagination.totalItems === 0
      }))
      .catch((error) => {
        console.error('Error fetching result data:', error);
        this.setState({rows: [], isEmpty: false, isError: true});
      });
  }

  getResultsForTree(page) {
    let params = {filter: 'run_id=' + this.state.id};
    params['pageSize'] = 500;
    params['page'] = page;
    HttpClient.get([Settings.serverUrl, 'result'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        let treeData = [];
        if (page !== 1) {
          // only send the results
          treeData = [...this.state.treeData];
        }
        treeData = [...treeData, ...data.results];
        this.setState({treeData}, () => {
          if (data.results.length === 500) {
            this.getResultsForTree(page + 1);
          }
          else {
            this.setState({resultsTree: this.buildTree(this.state.treeData)});
          }
        });
      })
      .catch((error) => {
        console.error('Error fetching result data:', error);
      });
  }

  componentDidMount() {
    this.getRun();
  }

  componentWillUnmount() {
    this.unlisten();
  }

  handleJSTreeChange(event, treeEvent) {
    if (treeEvent.action === 'select_node' && treeEvent.selected) {
      this.setState({
        testResult: treeEvent.node.data
      });
    }
  }


  render() {
    let passed = 0, failed = 0, errors = 0, xfailed = 0, xpassed = 0, skipped = 0, not_run = 0;
    let created = 0;
    let calculatePasses = true;
    const { run, columns, rows, classificationTable, artifactTabs } = this.state;
    const jsonViewTheme = getTheme() === 'dark' ? 'tomorrow' : 'rjv-default';

    if (run.start_time) {
      created = new Date(run.start_time);
    }
    else {
      created = new Date(run.created);
    }
    if (run.summary) {
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
      }
      else if (run.summary.collected) {
        not_run = run.summary.collected - run.summary.tests;
      }
    }
    const pagination = {
      pageSize: this.state.pageSize,
      page: this.state.page,
      totalItems: this.state.totalItems
    }
    return (
      <React.Fragment>
        <PageSection variant={PageSectionVariants.light}>
          <TextContent>
            <Text component="h1" className="pf-c-title">Run {run.id}</Text>
          </TextContent>
        </PageSection>
        <PageSection>
          {!this.state.isRunValid &&
          <EmptyObject headingText="Run not found" returnLink="/runs" returnLinkText="Return to runs list" />
          }
          {this.state.isRunValid &&
            <Tabs activeKey={this.state.activeTab} onSelect={this.onTabSelect} isBox>
              <Tab eventKey={'summary'} title={<TabTitle icon={InfoCircleIcon} text="Summary" />}>
                <Card>
                  <CardBody style={{padding: 0}} id="run-detail">
                    <Grid>
                      <GridItem span={6}>
                        <DataList selectedDataListItemId={null} aria-label="Run properties" style={{borderBottom: 'none', borderTop: 'none'}}>
                          <DataListItem aria-labelledby="Duration">
                            <DataListItemRow>
                              <DataListItemCells
                                dataListCells={[
                                  <DataListCell key={1} width={2}><strong>Duration:</strong></DataListCell>,
                                  <DataListCell key={2} width={4}>{round(run.duration)}s</DataListCell>
                                ]}
                              />
                            </DataListItemRow>
                          </DataListItem>
                          <DataListItem aria-labelledby="Started">
                            <DataListItemRow>
                              <DataListItemCells
                                dataListCells={[
                                  <DataListCell key={1} width={2}><strong>Started:</strong></DataListCell>,
                                  <DataListCell key={2} width={4}>{created.toLocaleString()}</DataListCell>
                                ]}
                              />
                            </DataListItemRow>
                          </DataListItem>
                          {run.metadata && run.metadata.component &&
                          <DataListItem aria-labelledby="Component">
                            <DataListItemRow>
                              <DataListItemCells
                                dataListCells={[
                                  <DataListCell key={1} width={2}><strong>Component:</strong></DataListCell>,
                                  <DataListCell key={2} width={4}>{run.metadata.component}</DataListCell>
                                ]}
                              />
                            </DataListItemRow>
                          </DataListItem>
                          }
                          {run.metadata && run.metadata.env &&
                            <DataListItem aria-labelledby="Environment">
                              <DataListItemRow>
                                <DataListItemCells
                                  dataListCells={[
                                    <DataListCell key={1} width={2}><strong>Environment:</strong></DataListCell>,
                                    <DataListCell key={2} width={4}>{run.metadata.env}</DataListCell>
                                  ]}
                                />
                              </DataListItemRow>
                            </DataListItem>
                          }
                          {run.metadata && run.metadata.tags &&
                            <DataListItem aria-labelledby="tags-label">
                              <DataListItemRow>
                                <DataListItemCells
                                  dataListCells={[
                                    <DataListCell key="tags-label" width={2}><strong>Tags:</strong></DataListCell>,
                                    <DataListCell key="tags-data" width={4}>
                                      <Flex>
                                        {run.metadata.tags.map((tag) => <FlexItem spacer={{ default: 'spacerXs' }} key={tag}><Label color="blue" variant="filled">{tag}</Label></FlexItem>)}
                                      </Flex>
                                    </DataListCell>
                                  ]}
                                />
                              </DataListItemRow>
                            </DataListItem>
                          }
                        {run.metadata && run.metadata.jenkins && run.metadata.jenkins.job_name &&
                          <DataListItem aria-labelledby="Jenkins Job Name">
                            <DataListItemRow>
                              <DataListItemCells
                                dataListCells={[
                                  <DataListCell key={1} width={2}><strong>Jenkins Job Name:</strong></DataListCell>,
                                  <DataListCell key={2} width={4}>{run.metadata.jenkins.job_name}</DataListCell>
                                ]}
                              />
                            </DataListItemRow>
                          </DataListItem>
                          }
                          {run.source &&
                            <DataListItem aria-labelledby="Source">
                              <DataListItemRow>
                                <DataListItemCells
                                  dataListCells={[
                                    <DataListCell key={1} width={2}><strong>Source:</strong></DataListCell>,
                                    <DataListCell key={2} width={4}>{run.source}</DataListCell>
                                  ]}
                                />
                              </DataListItemRow>
                            </DataListItem>
                          }
                        </DataList>
                      </GridItem>
                      <GridItem span={6}>
                        <DataList selectedDataListItemId={null} aria-label="Summary properties" style={{borderBottom: 0, borderTop: 0}}>
                          <DataListItem aria-labelledby="Summary">
                            <DataListItemRow>
                              <DataListItemCells
                                style={{paddingBottom: 0}}
                                dataListCells={[
                                  <DataListCell key={1} width={2}><strong>Summary:</strong></DataListCell>,
                                  <DataListCell key={2} width={4} style={{paddingTop: 0}}>
                                    <DataList selectedDataListItemId={null} aria-label="Summary" style={{borderBottom: 0, borderTop: 0}}>
                                      <DataListItem aria-labelledby="Total">
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>Total:</DataListCell>,
                                              <DataListCell key={2}>{run.summary.collected ? run.summary.collected : run.summary.tests}</DataListCell>
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </DataListItem>
                                      <DataListItem aria-labelledby="Passed">
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>Passed:</DataListCell>,
                                              <DataListCell key={2}>{passed}</DataListCell>
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </DataListItem>
                                      <DataListItem aria-labelledby="Failed">
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>Failed:</DataListCell>,
                                              <DataListCell key={2}>{failed}</DataListCell>
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </DataListItem>
                                      <DataListItem aria-labelledby="Error">
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>Error:</DataListCell>,
                                              <DataListCell key={2}>{errors}</DataListCell>
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </DataListItem>
                                      <DataListItem aria-labelledby="Xfailed">
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>Xfailed:</DataListCell>,
                                              <DataListCell key={2}>{xfailed}</DataListCell>
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </DataListItem>
                                      <DataListItem aria-labelledby="Xpassed">
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>Xpassed:</DataListCell>,
                                              <DataListCell key={2}>{xpassed}</DataListCell>
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </DataListItem>
                                      <DataListItem aria-labelledby="Skipped">
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>Skipped:</DataListCell>,
                                              <DataListCell key={2}>{skipped}</DataListCell>
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </DataListItem>
                                      <DataListItem aria-labelledby="Not Run">
                                        <DataListItemRow>
                                          <DataListItemCells
                                            dataListCells={[
                                              <DataListCell key={1}>Not Run:</DataListCell>,
                                              <DataListCell key={2}>{not_run}</DataListCell>
                                            ]}
                                          />
                                        </DataListItemRow>
                                      </DataListItem>
                                    </DataList>
                                  </DataListCell>
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
              <Tab eventKey={'results-list'} title={<TabTitle icon={CatalogIcon} text="Results List" />}>
                <Card className="pf-u-mt-lg">
                  <CardHeader>
                    <Flex style={{ width: '100%' }}>
                      <FlexItem grow={{ default: 'grow' }}>
                        <TextContent>
                          <Text component="h2" className="pf-c-title pf-m-xl">Test Results</Text>
                        </TextContent>
                      </FlexItem>
                      <FlexItem>
                        <Button variant="secondary" onClick={this.refreshResults}>Refresh results</Button>
                      </FlexItem>
                      <FlexItem>
                        <Link to={`/results?run_id[eq]=${run.id}`} className="pf-c-button pf-m-primary" style={{marginLeft: '2px'}}>See all results <ChevronRightIcon /></Link>
                      </FlexItem>
                    </Flex>
                  </CardHeader>
                  <CardBody>
                    <FilterTable
                      columns={columns}
                      rows={rows}
                      pagination={pagination}
                      isEmpty={this.state.isEmpty}
                      isError={this.state.isError}
                      onSetPage={this.setPage}
                      onSetPageSize={this.pageSizeSelect}
                    />
                  </CardBody>
                </Card>
              </Tab>
              <Tab eventKey={'results-tree'} title={<TabTitle icon={RepositoryIcon} text="Results Tree" />}>
                <Card className="pf-u-mt-lg">
                  <CardBody>
                    <Grid gutter="sm">
                      {false && <GridItem span={12}>
                        <div style={{paddingTop: "1em"}}>
                          <TextInput value={this.state.treeSearch} type="text" onChange={this.onSearch} placeholder="Search tree..." aria-label="Filter tree" />
                        </div>
                      </GridItem>
                      }
                      {this.state.resultsTree.core.data.length === 0 &&
                        <GridItem span={12}>
                          <Bullseye><center><Spinner size="xl"/></center></Bullseye>
                        </GridItem>
                      }
                      {this.state.resultsTree.core.data !== 0 &&
                        <React.Fragment>
                          <GridItem span={5}>
                            <TreeView treeData={this.state.resultsTree} onChange={(e, data) => this.handleJSTreeChange(e, data)}/>
                          </GridItem>
                          <GridItem span={7}>
                            {this.state.testResult &&
                            <Card className={this.state.testResult.result}>
                              <CardHeader>
                                {this.state.testResult.test_id}
                                {this.state.testResult.metadata.markers &&
                                  <div style={{float: 'right'}}>
                                    {this.state.testResult.metadata.markers.map((marker) => {
                                      return <Badge isRead key={marker.name}>{marker.name}</Badge>;
                                    })}
                                  </div>
                                }
                              </CardHeader>
                              <CardBody style={{backgroundColor: "var(--pf-c-page__main-section--BackgroundColor)", paddingTop: "1.2em"}}>
                                <ResultView testResult={this.state.testResult}/>
                              </CardBody>
                            </Card>
                            }
                          </GridItem>
                        </React.Fragment>
                      }
                    </Grid>
                  </CardBody>
                </Card>
              </Tab>
              <Tab eventKey={'classify-failures'} title={<TabTitle icon={MessagesIcon} text="Classify Failures" />}>
                {classificationTable}
              </Tab>
              {artifactTabs}
              <Tab eventKey={'run-object'} title={<TabTitle icon={CodeIcon} text="Run Object" />}>
                <Card>
                  <CardBody>
                    <ReactJson src={run} name={null} iconStyle={"triangle"} collapseStringsAfterLength={120} enableClipboard={false} displayDataTypes={false} theme={jsonViewTheme} />
                  </CardBody>
                </Card>
              </Tab>
            </Tabs>
          }
        </PageSection>
      </React.Fragment>
    );
  }
}
