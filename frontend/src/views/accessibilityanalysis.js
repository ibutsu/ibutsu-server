import React from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Flex,
  FlexItem,
  PageSection,
  Switch,
  Tab,
  Tabs,
  TextContent,
  Text
} from '@patternfly/react-core';
import {
  CatalogIcon,
  ChevronRightIcon,
  CodeIcon,
  FileAltIcon,
  FileImageIcon,
} from '@patternfly/react-icons';
import {
  ChartLegend,
  ChartDonut
} from '@patternfly/react-charts';
import { Link } from 'react-router-dom';
import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { JSONTree } from 'react-json-tree';
import Editor from '@monaco-editor/react';
import {
  parseFilter,
  getSpinnerRow,
  resultToRow,
} from '../utilities';
import { FilterTable } from '../components/filtertable';
import { IbutsuContext } from '../services/context';
import TabTitle from '../components/tabs';
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


export class AccessibilityAnalysisView extends React.Component {
  static contextType = IbutsuContext;
  static propTypes = {
    location: PropTypes.object,
    navigate: PropTypes.func,
    view: PropTypes.object
  };

  constructor(props) {
    super(props);
    const params = new URLSearchParams(props.location.search);
    let page = 1, pageSize = 20, filters = {};
    if (params.toString() !== '') {
      for(let pair of params) {
        if (pair[0] === 'page') {
          page = parseInt(pair[1]);
        }
        else if (pair[0] === 'pageSize') {
          pageSize = parseInt(pair[1]);
        }
        else {
          const combo = parseFilter(pair[0]);
          filters[combo['key']] = {
            'op': combo['op'],
            'val': pair[1]
          };
        }
      }
    }
    this.state = {
      run: MockRun,
      isAreaChart: false,
      isEmpty: true,
      isError: false,
      filters: filters,
      id: filters.run_list?.val,
      activeTab: this.getTabIndex('overview'),
      barWidth: 8,
      builds: 20,
      pageSize: pageSize,
      page: page,
      artifacts: [],
      artifactTabs: [],
      columns: ['Test', 'Run', 'Result', 'Duration', 'Started'],
      rows: [getSpinnerRow(5)],
      results: [],
      selectedResults: [],
      totalItems: 0,
      totalPages: 0,
      testResult: null,
      chartParams: {},
      pieData: [{x: '', y: 0}, {x: '', y: 0}, {total: 0}],
    };
  }

  getTabIndex(defaultValue) {
    defaultValue = defaultValue || null;
    return this.props.location.hash !== '' ? this.props.location.hash.substring(1) : defaultValue;
  }

  getWidgetParams = () => {
    // Show a spinner
    this.setState({isLoading: true, isEmpty: false, isError: false});
    if (!this.props.view) {
      return;
    }
    let params = this.props.view.params;
    const { primaryObject } = this.context;
    if (primaryObject) {
      params['project'] = primaryObject.id;
    }
    else {
      delete params['project'];
    }
    // probably don't need this, but maybe something similar
    params['run_list'] = this.state.filters.run_list?.val;
    HttpClient.get([Settings.serverUrl, 'widget', this.props.view.widget], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        this.setState({
          run_list: data.run_list,
          isLoading: false,
        });
      });
  }


  getSwitch() {
    const { isAreaChart } = this.state;
    return (<Switch
      id="bar-chart-switch"
      labelOff="Change to Area Chart"
      label="Change to Bar Chart"
      isChecked={isAreaChart}
      onChange={(_event, isChecked) => this.handleSwitch(isChecked)}
    />);
  }



  getColors = (key) => {
    let color = 'var(--pf-v5-global--success-color--100)';
    if (key === 'violations') {
      color = 'var(--pf-v5-global--danger-color--100)';
    }
    else if (key === 'skipped') {
      color = 'var(--pf-v5-global--info-color--100)';
    }
    else if (key === 'error') {
      color = 'var(--pf-v5-global--warning-color--100)';
    }
    else if (key === 'xfailed') {
      color = 'var(--pf-v5-global--palette--purple-400)';
    }
    else if (key === 'xpassed') {
      color = 'var(--pf-v5-global--palette--purple-700)';
    }
    return color;
  }

  getRunArtifacts() {
    HttpClient.get([Settings.serverUrl, 'artifact'], {runId: this.state.id})
      .then(response => HttpClient.handleResponse(response))
      .then(data => {
        let artifactTabs = [];
        data.artifacts.forEach((artifact) => {
          HttpClient.get([Settings.serverUrl, 'artifact', artifact.id, 'view'])
            .then(response => {
              let contentType = response.headers.get('Content-Type');
              if (contentType.includes('text')) {
                response.text().then(text => {
                  artifactTabs.push(
                    <Tab key={artifact.id} eventKey={artifact.id} title={<TabTitle icon={<FileAltIcon/>} text={artifact.filename} />} style={{backgroundColor: 'white'}}>
                      <Card>
                        <CardBody>
                          <Editor fontFamily="Hack, monospace" theme="vs-dark" value={text} height="40rem" options={{readOnly: true}} />
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
              else if (contentType.includes('image')) {
                response.blob().then(blob => {
                  let imageUrl = URL.createObjectURL(blob);
                  artifactTabs.push(
                    <Tab key={artifact.id} eventKey={artifact.id} title={<TabTitle icon={<FileImageIcon/>} text={artifact.filename} />} style={{backgroundColor: 'white'}}>
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

  updateTab(tabIndex) {
    if (tabIndex === 'overview') {
      this.getResultsForPie();
    }
    else if (tabIndex === 'results-list') {
      this.getResultsForTable();
    }
  }

  onSearch = (value) => {
    this.setState({treeSearch: value}, this.setFilteredTree);
  }

  onTabSelect = (_event, tabIndex) => {
    const loc = this.props.location;
    this.props.navigate(`${loc.pathname}${loc.search}#${tabIndex}`)
    this.setState({activeTab: tabIndex});
    this.updateTab(tabIndex);
  }

  onBuildSelect = (value) => {
    this.setState({builds: value}, () => {
      this.getWidgetParams();
      this.getBarWidth();
    });
  }

  onSkipSelect = (value) => {
    this.setState({countSkips: value}, () => {
      this.getWidgetParams();
    });
  }

  handleSwitch = isChecked => {
    this.setState({isAreaChart: isChecked});
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
          this.setState({'isRunValid': true});
        } else {
          throw new Error('Failed with HTTP code ' + response.status);
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
    let params = {filter: ['run_id=' + this.state.id, 'metadata.markers*accessibility']};
    params['pageSize'] = this.state.pageSize;
    params['page'] = this.state.page;
    this.setState({rows: [['Loading...', '', '', '']]});
    HttpClient.get([Settings.serverUrl + '/result'], params)
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

  getResultsForPie_old() {
    HttpClient.get([Settings.serverUrl, 'widget', 'accessibility-bar-chart'], {run_list: this.state.id})
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({
          pieData: data,
      }))
      .catch((error) => {
        console.error('Error fetching pie data:', error);
      });
  }

  getResultsForPie() {
    let passes = this.state.run.metadata.accessibility_data.passes
    let violations = this.state.run.metadata.accessibility_data.violations
    let total = passes + violations
    this.setState({
      pieData: [
        {
          x: 'passes',
          y: passes,
          ratio: Math.round(100 * passes/total, 2)
        },
        {
          x: 'violations',
          y: violations,
          ratio: Math.round(100 * violations/total, 2)
        },
        {
          total: total
        }
      ]
    });
  }


  componentDidMount() {
    this.getRun();
    this.getWidgetParams();
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
    const {
      run,
      columns,
      rows,
      artifactTabs
    } = this.state;
    const pagination = {
      pageSize: this.state.pageSize,
      page: this.state.page,
      totalItems: this.state.totalItems
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
        <PageSection>
          <Tabs activeKey={this.state.activeTab} onSelect={this.onTabSelect} isBox>
            <Tab eventKey="overview" title={<TabTitle icon={<CatalogIcon/>} text="Overview" />} style={{backgroundColor: 'white'}}>
              <div style={{ height: '1000px', width: '1250px', backgroundColor: 'white' }}>
                  <ChartDonut
                    ariaDesc="Accessibility results donut chart"
                    ariaTitle="Accessibility results"
                    subTitle="Elements"
                    title={this.state.pieData[2].total}
                    constrainToVisibleArea={true}
                    data={this.state.pieData}
                    labels={({ datum }) => `${datum.x}: ${datum.ratio}%`}
                    legendData={[{name: 'Passes', color: 'red'}, {name: 'Violations'}]}
                    legendOrientation="vertical"
                    legendPosition="right"
                    legendComponent = {
                      <ChartLegend
                        data={[
                          {
                            name: 'Passes: ' + this.state.pieData[0].y,
                              symbol: { fill: 'var(--pf-v5-global--success-color--100)'}
                          },
                          {
                            name: 'Violations: ' + this.state.pieData[1].y,
                            symbol: { fill: 'var(--pf-v5-global--danger-color--100)'}
                          }
                        ]}
                      />
                    }
                    padding = {{
                      bottom: 20,
                      left: 20,
                      right: 140,
                      top: 0
                    }}
                    colorScale={[
                      'var(--pf-v5-global--success-color--100)',
                      'var(--pf-v5-global--danger-color--100)',
                      'var(--pf-v5-global--warning-color--100)',
                      'var(--pf-v5-global--info-color--100)',
                    ]}
                    width={300}
                  />
              </div>
            </Tab>
            <Tab eventKey="run-object" title={<TabTitle icon={<CodeIcon/>} text="Run Object" />} style={{backgroundColor: 'white'}}>
              <Card>
                <CardBody>
                  <JSONTree data={run} theme={jsonViewTheme} invertTheme hideRoot shouldExpandNodeInitially={() => true}/>
                </CardBody>
              </Card>
            </Tab>
            <Tab eventKey="results-list" title={<TabTitle icon={<CatalogIcon/>} text="Results List" />} style={{backgroundColor: 'white'}}>
              <Card className="pf-u-mt-lg">
                <CardHeader>
                  <Flex style={{ width: '100%' }}>
                    <FlexItem grow={{ default: 'grow' }}>
                      <TextContent>
                        <Text component="h2" className="pf-v5-c-title pf-m-xl">Test Results</Text>
                      </TextContent>
                    </FlexItem>
                    <FlexItem>
                      <Button variant="secondary" onClick={this.refreshResults}>Refresh results</Button>
                    </FlexItem>
                    <FlexItem>
                      <Link to={`/results?run_id[eq]=${run.id}`} className="pf-v5-c-button pf-m-primary" style={{marginLeft: '2px'}}>See all results <ChevronRightIcon /></Link>
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
            {artifactTabs}
          </Tabs>
        </PageSection>
      </React.Fragment>
    );
  }
}
