import React, { useContext, useEffect, useRef, useState } from 'react';

import {
  ActionGroup,
  Button,
  Card,
  CardBody,
  CardFooter,
  ExpandableSection,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
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
} from './utilities';
import { DownloadButton } from './components';
import {FilterTable} from './components/filtertable';
import { OPERATIONS } from './constants';
import { IbutsuContext } from './services/context';
import { useLocation } from 'react-router-dom';

const COLUMNS = ['Report', 'Status', 'Actions'];

function ReportBuilder() {
  const context = useContext(IbutsuContext);
  const {primaryObject} = context;

  const [reportType, setReportType] = useState('html');
  const [reportSource, setReportSource] = useState('');
  const [reportFilter, setReportFilter] = useState();
  const [reportTypes, setReportTypes] = useState([]);
  const [rows, setRows] = useState([getSpinnerRow(3)]);
  const [totalItems, setTotalItems] = useState(0);
  const [isError, setIsError] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [isHelpExpanded, setIsHelpExpanded] = useState(false);

  const location = useLocation();

  const intervalId = useRef();
  const pagination_page = useRef(1);
  const pagination_pageSize = useRef(20);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let filters = [], filterString = '';
    if (params.toString() !== '') {
      for(let pair of params) {
        if (pair[0] === 'page') {
          pagination_page.current = parseInt(pair[1]);
        }
        else if (pair[0] === 'pageSize') {
          pagination_pageSize.current = parseInt(pair[1]);
        }
        else {
          const combo = parseFilter(pair[0]);
          filters.push(combo['key'] + OPERATIONS[combo['op']] + pair[1]);
        }
      }
    }
    if (filters.length > 0) {
      filterString = filters.join();
      setReportFilter(filterString);
    }
  }, [location])

  useEffect(() => {
    HttpClient.get([Settings.serverUrl, 'report', 'types'])
      .then(response => HttpClient.handleResponse(response))
      .then(data => setReportTypes(data));
  }, [])

  useEffect(() => {
    const reportToRow = (report) => {
      let reportStatus = 'pending';
      let reportName = report.filename ? report.filename : '(report pending)';
      let row_actions = 'N/A';
      if (report.status !== undefined && !!report.status) {
        reportStatus = report.status;
      }
      let statusIcon = getIconForStatus(reportStatus);
      if (report.status === 'empty') {
        row_actions = 'Filter(s) returned no data';
      }
      if (reportStatus === 'done' && report.url) {
        row_actions = <DownloadButton url={report.url} key={report.url}>Download</DownloadButton>;
      }
      else if (reportStatus === 'done' && report.download_url) {
        row_actions = <DownloadButton url={report.download_url} key={report.download_url}>Download</DownloadButton>;
      }
      return {
        cells: [
          {title: reportName, data: report},
          {title: <span className={reportStatus}>{statusIcon} {toTitleCase(reportStatus)}</span>},
          {title: row_actions}
        ]
      };
    }

    const getReports = () => {
      let params = {
        pageSize: pagination_pageSize.current,
        page: pagination_page.current
      };
      if (primaryObject) {
        params['project'] = primaryObject.id;
      }
      HttpClient.get([Settings.serverUrl, 'report'], params)
        .then(response => HttpClient.handleResponse(response))
        .then(data => {
          let row_data = data.reports.map((report) => reportToRow(report));
          console.log('ROW DATA: ');
          console.dir(row_data);
          setRows(row_data);
          setTotalItems(data.pagination.totalItems);
          setIsEmpty(data.pagination.totalItems === 0);
          setIsError(false);
          pagination_page.current = data.pagination.page;
          pagination_pageSize.current = data.pagination.pageSize;
        })
        .catch((error) => {
          console.error('Error fetching result data:', error);
          setRows([]);
          setIsEmpty(false);
          setIsError(true);
        });
    }

    getReports();

    intervalId.current = setInterval(getReports, 5000);

    return () => {
      clearInterval(intervalId.current);
    }
  }, [primaryObject])

  function onRunReportClick() {
    let params = {
      type: reportType,
      filter: reportFilter,
      source: reportSource
    };
    if (primaryObject) {
      params['project'] = primaryObject.id;
    }
    HttpClient.post([Settings.serverUrl, 'report'], params);
  };

  document.title = 'Report Builder | Ibutsu';
  const pagination = {
    page: pagination_page.current,
    pageSize: pagination_pageSize.current,
    totalItems: totalItems,
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
              <FormGroup isRequired label="Report Type" fieldId="report-type">
                <FormSelect id="report-type" value={reportType} onChange={(_event, change) => setReportType(change)}>
                  {reportTypes.map((rpt) => <FormSelectOption key={rpt.type} value={rpt.type} label={rpt.name} />)}
                </FormSelect>
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>The type of report</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <FormGroup label="Filter" fieldId="report-filter">
                <TextInput type="text" id="report-filter" value={reportFilter} onChange={(_event, change) => setReportFilter(change)} />
                <ExpandableSection toggleText="Filter Help" onToggle={() => {setIsHelpExpanded(!isHelpExpanded)}} isExpanded={isHelpExpanded}>
                  <TextContent>
                    <p>The filter parameter takes a comma-separated list of filters to apply. <Linkify componentDecorator={linkifyDecorator}>https://docs.ibutsu-project.org/en/latest/user-guide/filter-help.html</Linkify></p>
                  </TextContent>
                </ExpandableSection>
              </FormGroup>
              <FormGroup label="Source" fieldId="report-source">
                <TextInput type="text" id="report-source" value={reportSource} onChange={(_event, change) => setReportSource(change)} />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>The source of report</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <ActionGroup>
                <Button variant="primary" onClick={onRunReportClick}>Run Report</Button>
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
              columns={COLUMNS}
              rows={rows}
              pagination={pagination}
              isEmpty={isEmpty}
              isError={isError}
              onSetPage={(_event, change) => {pagination_page.current = change}}
              onSetPageSize={(_event, change) => {pagination_pageSize.current = change}}
            />
          </CardBody>
        </Card>
      </PageSection>
    </React.Fragment>
  );
}


ReportBuilder.propTypes = {
};

export default ReportBuilder;
