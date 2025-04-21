// TODO This component is incomplete
// and should not be implemented as a view type widget, but as a normal component
// The class was converted to functional react, but needs additional work.
// It's not in use in downstream environments at the moment
import React, { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardBody,
  CardHeader,
  Flex,
  FlexItem,
  PageSection,
  Tab,
  Tabs,
  TextContent,
  Text,
} from '@patternfly/react-core';
import {
  CatalogIcon,
  ChevronRightIcon,
  CodeIcon,
} from '@patternfly/react-icons';
import { ChartLegend, ChartDonut } from '@patternfly/react-charts';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { resultToRow } from '../utilities';
import FilterTable from '../components/filtertable';
import { IbutsuContext } from '../services/context';
import TabTitle from '../components/tabs';
import { CodeEditor, Language } from '@patternfly/react-code-editor';

const COLUMNS = ['Test', 'Run', 'Result', 'Duration', 'Started'];

const AccessibilityAnalysisView = ({ view }) => {
  const context = useContext(IbutsuContext);
  const { darkTheme } = context;
  const location = useLocation();
  const navigate = useNavigate();
  const params = useSearchParams();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters] = useState({});

  const [run, setRun] = useState();
  const [id] = useState(filters.run_list?.val);
  const [, setResults] = useState([]);
  // const [selectedResults, setSelectedResults] = useState([]);

  // const [areaChart, setAreaChart] = useState(false);
  const [isError, setIsError] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  // const [barWidth, setBarWidth] = useState(8);
  const [builds] = useState(20);

  // const [artifacts, setArtifacts] = useState([]);

  const [artifactTabs] = useState([]);
  const [rows, setRows] = useState();

  const [totalItems, setTotalItems] = useState(0);
  // const [testResult, setTestResult] = useState();
  // const [chartParams, setChartParams] = useState({});
  const [pieData, setPieData] = useState([
    { x: '', y: 0 },
    { x: '', y: 0 },
    { total: 0 },
  ]);

  // const [treeSearch, setTreeSearch] = useState();

  const [, setRunList] = useState([]);
  const [countSkips] = useState(false);

  // TODO? search param sync

  // const combo = parseFilter(pair[0]);
  // filters[combo['key']] = {
  //   'op': combo['op'],
  //   'val': pair[1]
  // };

  useEffect(() => {
    if (view) {
      setIsError(false);

      let viewParams = { ...view.params };
      const { primaryObject } = context;
      if (primaryObject) {
        viewParams['project'] = primaryObject.id;
      } else {
        delete viewParams['project'];
      }
      // probably don't need this, but maybe something similar
      viewParams['run_list'] = filters.run_list?.val;
      HttpClient.get([Settings.serverUrl, 'widget', view.widget], viewParams)
        .then((response) => HttpClient.handleResponse(response))
        .then((data) => {
          setRunList(data.run_list);
        })
        .catch((error) => console.error(error));
    }
  }, [view, builds, countSkips, filters?.run_list?.val, context]);

  // TODO remove?
  // const getSwitch = () => (
  //   <Switch
  //     id="bar-chart-switch"
  //     labelOff="Change to Area Chart"
  //     label="Change to Bar Chart"
  //     isChecked={areaChart}
  //     onChange={(_, isChecked) => setAreaChart(isChecked)}
  //   />
  // );

  // const getColors = (key) => {
  //   let color = 'var(--pf-v5-global--success-color--100)';
  //   if (key === 'violations') {
  //     color = 'var(--pf-v5-global--danger-color--100)';
  //   }
  //   else if (key === 'skipped') {
  //     color = 'var(--pf-v5-global--info-color--100)';
  //   }
  //   else if (key === 'error') {
  //     color = 'var(--pf-v5-global--warning-color--100)';
  //   }
  //   else if (key === 'xfailed') {
  //     color = 'var(--pf-v5-global--palette--purple-400)';
  //   }
  //   else if (key === 'xpassed') {
  //     color = 'var(--pf-v5-global--palette--purple-700)';
  //   }
  //   return color;
  // };

  // TODO use ArtifactTab to look this up outside
  // useEffect(() => {
  //   HttpClient.get([Settings.serverUrl, 'artifact'], {runId: id})
  //     .then(response => HttpClient.handleResponse(response))
  //     .then(data => {
  //       let artifactTabs = [];
  //       data.artifacts.forEach((artifact) => {
  //         HttpClient.get([Settings.serverUrl, 'artifact', artifact.id, 'view'])
  //           .then(response => {
  //             let contentType = response.headers.get('Content-Type');
  //             if (contentType.includes('text')) {
  //               response.text().then(text => {
  //                 artifactTabs.push(
  //                   <Tab key={artifact.id} eventKey={artifact.id} title={<TabTitle icon={<FileAltIcon/>} text={artifact.filename} />} style={{backgroundColor: 'white'}}>
  //                     <Card>
  //                       <CardBody>
  //                         <Editor fontFamily="Hack, monospace" theme="vs-dark" value={text} height="40rem" options={{readOnly: true}} />
  //                       </CardBody>
  //                       <CardFooter>
  //                         <Button component="a" href={`${Settings.serverUrl}/artifact/${artifact.id}/download`}>Download {artifact.filename}</Button>
  //                       </CardFooter>
  //                     </Card>
  //                   </Tab>
  //                 );
  //                 this.setState({artifactTabs});
  //               });
  //             }
  //             else if (contentType.includes('image')) {
  //               response.blob().then(blob => {
  //                 let imageUrl = URL.createObjectURL(blob);
  //                 artifactTabs.push(
  //                   <Tab key={artifact.id} eventKey={artifact.id} title={<TabTitle icon={<FileImageIcon/>} text={artifact.filename} />} style={{backgroundColor: 'white'}}>
  //                     <Card>
  //                       <CardBody>
  //                         <img src={imageUrl} alt={artifact.filename}/>
  //                       </CardBody>
  //                       <CardFooter>
  //                         <Button component="a" href={`${Settings.serverUrl}/artifact/${artifact.id}/download`}>Download {artifact.filename}</Button>
  //                       </CardFooter>
  //                     </Card>
  //                   </Tab>
  //                 );
  //                 this.setState({artifactTabs});
  //               });
  //             }
  //           });
  //       });
  //     });
  // }, [run]),

  const onTabSelect = (_, tabIndex) => {
    navigate(`${location.pathname}${params}#${tabIndex}`);
    setActiveTab(tabIndex);
  };

  // TODO remove, use ArtifactTab. currentTest isn't even in state
  // const onToggle = (node) => {
  //   if (node.result) {
  //     setCurrentTest(node.result);

  //     if (!currentTest.artifacts) {
  //       HttpClient.get([Settings.serverUrl, 'artifact'], {resultId: currentTest.id})
  //         .then(response => HttpClient.handleResponse(response))
  //         .then(data => {
  //           setCurrentTest
  //           currentTest.artifacts = data.artifacts;
  //           this.setState({currentTest});
  //         });
  //     }
  //   }
  // };

  // Fetch the Run by ID
  useEffect(() => {
    if (id) {
      setIsError(false);
      HttpClient.get([Settings.serverUrl, 'run', id])
        .then((response) => HttpClient.handleResponse(response))
        .then((data) => {
          setRun(data);
        })
        .catch((error) => {
          console.error(error);
          setIsError(true);
        });
    }
  }, [id, activeTab]);

  // getResultsforTable
  useEffect(() => {
    setIsError(false);
    HttpClient.get([Settings.serverUrl + '/result'], {
      filter: ['run_id=' + id, 'metadata.markers*accessibility'],
      page: page,
      pageSize: pageSize,
    })
      .then((response) => HttpClient.handleResponse(response))
      .then((data) => {
        setResults(data.results);
        setRows(data.results.map((result) => resultToRow(result))); // TODO move to render
        setPage(data.pagination.page);
        setPageSize(data.pagination.pageSize);
        setTotalItems(data.pagination.totalItems);
      })
      .catch((error) => {
        console.error('Error fetching result data:', error);
        setRows([]); // TODO move to render
        setResults([]);
        setIsError(true);
      });
  }, [page, pageSize, id]);

  useEffect(() => {
    let { passes, violations } = run.metadata.accessibility_data;
    let total = passes + violations;
    setPieData([
      {
        x: 'passes',
        y: passes,
        ratio: Math.round((100 * passes) / total, 2),
      },
      {
        x: 'violations',
        y: violations,
        ratio: Math.round((100 * violations) / total, 2),
      },
      {
        total: total,
      },
    ]);
  }, [run]);

  return (
    <React.Fragment>
      <PageSection>
        <Tabs activeKey={activeTab} onSelect={onTabSelect} isBox>
          <Tab
            eventKey="overview"
            title={<TabTitle icon={<CatalogIcon />} text="Overview" />}
            style={{ backgroundColor: 'white' }}
          >
            <div
              style={{
                height: '1000px',
                width: '1250px',
                backgroundColor: 'white',
              }}
            >
              <ChartDonut
                ariaDesc="Accessibility results donut chart"
                ariaTitle="Accessibility results"
                subTitle="Elements"
                title={pieData[2].total}
                constrainToVisibleArea={true}
                data={pieData}
                labels={({ datum }) => `${datum.x}: ${datum.ratio}%`}
                legendData={[
                  { name: 'Passes', color: 'red' },
                  { name: 'Violations' },
                ]}
                legendOrientation="vertical"
                legendPosition="right"
                legendComponent={
                  <ChartLegend
                    data={[
                      {
                        name: 'Passes: ' + pieData[0].y,
                        symbol: {
                          fill: 'var(--pf-v5-global--success-color--100)',
                        },
                      },
                      {
                        name: 'Violations: ' + pieData[1].y,
                        symbol: {
                          fill: 'var(--pf-v5-global--danger-color--100)',
                        },
                      },
                    ]}
                  />
                }
                padding={{
                  bottom: 20,
                  left: 20,
                  right: 140,
                  top: 0,
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
          <Tab
            eventKey="run-object"
            title={<TabTitle icon={<CodeIcon />} text="Run Object" />}
            style={{ backgroundColor: 'white' }}
          >
            <Card>
              <CardBody id="object-card-body">
                <CodeEditor
                  isReadOnly={true}
                  isDarkTheme={darkTheme}
                  language={Language.json}
                  code={JSON.stringify(run, null, '\t')}
                  height="sizeToFit"
                />
              </CardBody>
            </Card>
          </Tab>
          <Tab
            eventKey="results-list"
            title={<TabTitle icon={<CatalogIcon />} text="Results List" />}
            style={{ backgroundColor: 'white' }}
          >
            <Card className="pf-u-mt-lg">
              <CardHeader>
                <Flex style={{ width: '100%' }}>
                  <FlexItem grow={{ default: 'grow' }}>
                    <TextContent>
                      <Text component="h2" className="pf-v5-c-title pf-m-xl">
                        Test Results
                      </Text>
                    </TextContent>
                  </FlexItem>
                  <FlexItem>
                    <Link
                      to={`/results?run_id[eq]=${run?.id}`}
                      className="pf-v5-c-button pf-m-primary"
                      style={{ marginLeft: '2px' }}
                    >
                      See all results <ChevronRightIcon />
                    </Link>
                  </FlexItem>
                </Flex>
              </CardHeader>
              <CardBody>
                <FilterTable
                  columns={COLUMNS}
                  rows={rows}
                  pagination={{
                    pageSize: pageSize,
                    page: page,
                    totalItems: totalItems,
                  }}
                  isEmpty={rows?.length === 0}
                  isError={isError}
                  onSetPage={(_, value) => setPage(value)}
                  onSetPageSize={(_, value) => setPageSize(value)}
                />
              </CardBody>
            </Card>
          </Tab>
          {artifactTabs}
        </Tabs>
      </PageSection>
    </React.Fragment>
  );
};

AccessibilityAnalysisView.propTypes = {
  view: PropTypes.object,
};

export default AccessibilityAnalysisView;
