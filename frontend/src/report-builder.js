import React from 'react';
import PropTypes from 'prop-types';

import {
  ActionGroup,
  Button,
  Card,
  CardBody,
  CardFooter,
  ExpandableSection,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  PageSection,
  PageSectionVariants,
  Text,
  TextContent,
  TextInput
} from '@patternfly/react-core';
import Linkify from 'react-linkify';

import { HttpClient } from './services/http';
import { linkifyDecorator } from './components/decorators';
import { Settings } from './settings';
import {
  getIconForStatus,
  toTitleCase,
  parseFilter,
  getSpinnerRow,
  getActiveProject
} from './utilities';
import { FilterTable } from './components';
import { OPERATIONS } from './constants';


function reportToRow(report) {
  let reportStatus = 'pending';
  let reportLink = '(no filename yet)';
  let actions = [];
  if (report.status !== undefined && !!report.status) {
    reportStatus = report.status;
  }
  let statusIcon = getIconForStatus(reportStatus);
  if (report.status === "empty") {
    actions.push("Filter(s) returned no data");
  }
  if (reportStatus !== 'done') {
    reportLink = report.filename;
  }
  else if (report.view_url !== undefined && !!report.view_url) {
    reportLink = <a href={report.view_url} target="_blank" rel="noopener noreferrer">{report.filename}</a>;
    actions.push(<Button component="a" href={report.view_url} target="_blank" rel="noopener noreferrer" key={report.view_url}>View</Button>);
    actions.push(" ");
    actions.push(<Button component="a" href={report.download_url} key={report.download_url}>Download</Button>);
  }
  else if (report.url !== undefined && !!report.url) {
    reportLink = <a href={report.url}>{report.filename}</a>;
    actions.push(<Button component="a" href={report.url} key={report.url}>Download</Button>);
  }
  return {
    cells: [
      {title: reportLink, data: report},
      {title: <span className={reportStatus}>{statusIcon} {toTitleCase(reportStatus)}</span>},
      {title: actions}
    ]
  };
}

export class ReportBuilder extends React.Component {
  static propTypes = {
    location: PropTypes.object,
    history: PropTypes.object,
    eventEmitter: PropTypes.object
  }

  constructor(props) {
    super(props);
    const params = new URLSearchParams(props.location.search);
    let page = 1, pageSize = 20, filters = [], filterString = '';
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
          filters.push(combo['key'] + OPERATIONS[combo['op']] + pair[1]);
        }
      }
    }
    if (filters.length > 0) {
      filterString = filters.join();
    }
    this.state = {
      isHelpExpanded: false,
      reportType: "html",
      reportSource: "",
      reportFilter: filterString,
      reportTypes: [],
      columns: ['Report', 'Status', 'Actions'],
      rows: [getSpinnerRow(3)],
      page: page,
      pageSize: pageSize,
      totalItems: 0,
      totalPages: 0,
      isError: false,
      isEmpty: false
    };
    props.eventEmitter.on('projectChange', () => {
      this.getReports();
    });
  }

  onHelpToggle = () => {
    this.setState({isHelpExpanded: !this.state.isHelpExpanded});
  };

  onReportTypeChange = (reportType) => {
    this.setState({ reportType });
  };

  onReportSourceChange = (reportSource) => {
    this.setState({ reportSource });
  };

  onReportFilterChange = (reportFilter) => {
    this.setState({ reportFilter });
  };

  setPage = (_event, pageNumber) => {
    this.setState({page: pageNumber}, this.getResults);
  }

  setPageSize = (_event, perPage) => {
    this.setState({pageSize: perPage}, this.getResults);
  }

  getReports() {
    let params = {
      pageSize: this.state.pageSize,
      page: this.state.page
    };
    const project = getActiveProject();
    if (project) {
      params['project'] = project.id;
    }
    HttpClient.get([Settings.serverUrl, 'report'], params)
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({
        rows: data.reports.map((report) => reportToRow(report)),
        page: data.pagination.page,
        pageSize: data.pagination.pageSize,
        totalItems: data.pagination.totalItems,
        totalPages: data.pagination.totalPages,
        isEmpty: data.pagination.totalItems === 0,
        isError: false
      }))
      .catch((error) => {
        console.error('Error fetching result data:', error);
        this.setState({rows: [], isEmpty: false, isError: true});
      });
  }

  getReportTypes() {
    HttpClient.get([Settings.serverUrl, 'report', 'types'])
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({reportTypes: data}));
  }

  onRunReportClick = () => {
    const project = getActiveProject();
    let params = {
      type: this.state.reportType,
      filter: this.state.reportFilter,
      source: this.state.reportSource
    };
    if (project) {
      params['project'] = project.id;
    }
    HttpClient.post([Settings.serverUrl, 'report'], params).then(() => this.getReports());
  };

  componentDidMount() {
    this.getReportTypes();
    this.getReports();
    this.interval = setInterval(() => this.getReports(), 5000);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  render() {
    document.title = 'Report Builder | Ibutsu';
    const { columns, rows, actions } = this.state;
    const reportTypes = this.state.reportTypes.map((reportType) => <FormSelectOption key={reportType.type} value={reportType.type} label={reportType.name} />);
    const pagination = {
      page: this.state.page,
      pageSize: this.state.pageSize,
      totalItems: this.state.totalItems
    };
    return (
      <React.Fragment>
        <PageSection variant={PageSectionVariants.light}>
          <TextContent>
            <Text component="h1">Report Builder</Text>
          </TextContent>
        </PageSection>
        <PageSection>
          <Card>
            <CardBody>
              <Form isHorizontal>
                <FormGroup isRequired label="Report Type" helperText="The type of report" fieldId="report-type">
                  <FormSelect id="report-type" value={this.state.reportType} onChange={this.onReportTypeChange}>
                    {reportTypes}
                  </FormSelect>
                </FormGroup>
                <FormGroup label="Filter" fieldId="report-filter">
                  <TextInput type="text" id="report-filter" value={this.state.reportFilter} onChange={this.onReportFilterChange} />
                  <ExpandableSection toggleText="Filter Help" onToggle={this.onHelpToggle} isExpanded={this.state.isHelpExpanded}>
                    <TextContent>
                      <p>The filter parameter takes a comma-separated list of filters to apply. <Linkify componentDecorator={linkifyDecorator}>https://docs.ibutsu-project.org/en/latest/user-guide/filter-help.html</Linkify></p>
                    </TextContent>
                  </ExpandableSection>
                </FormGroup>
                <FormGroup label="Source" helperText="The source of report" fieldId="report-source">
                  <TextInput type="text" id="report-source" value={this.state.reportSource} onChange={this.onReportSourceChange} />
                </FormGroup>
                <ActionGroup>
                  <Button variant="primary" onClick={this.onRunReportClick}>Run Report</Button>
                </ActionGroup>
              </Form>
            </CardBody>
            <CardFooter>
              <Text className="disclaimer" component="h4">
                * Note: reports can only show a maximum of 100,000 results.
              </Text>
            </CardFooter>
          </Card>
        </PageSection>
        <PageSection>
          <Card>
            <CardBody>
              <FilterTable
                columns={columns}
                rows={rows}
                actions={actions}
                pagination={pagination}
                isEmpty={this.state.isEmpty}
                isError={this.state.isError}
                onSetPage={this.setPage}
                onSetPageSize={this.setPageSize}
              />
            </CardBody>
          </Card>
        </PageSection>
      </React.Fragment>
    );
  }
}
