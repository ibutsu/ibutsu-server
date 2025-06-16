import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { ChartDonut, ChartLegend } from '@patternfly/react-charts';
import { Card, CardBody, CardFooter, Text } from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { toTitleCase } from '../utilities';
import WidgetHeader from '../components/widget-header';
import { CHART_COLOR_MAP } from '../constants';

const ResultSummaryWidget = ({ title, params, onDeleteClick, onEditClick }) => {
  const [summary, setSummary] = useState({
    passed: 0,
    failed: 0,
    error: 0,
    skipped: 0,
    xfailed: 0,
    xpassed: 0,
    other: 0,
    manual: 0,
    total: 0,
  });

  const [isError, setIsError] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    setIsError(false);
    const fetchSummary = async () => {
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'widget', 'result-summary'],
          params,
        );
        const data = await HttpClient.handleResponse(response);
        setSummary(data);
        setIsError(false);
      } catch (error) {
        setIsError(true);
        console.error(error);
      }
      setFetching(false);
    };
    if (params) {
      fetchSummary();
    }
  }, [params]);

  // Create chart data and legend data with appropriate color mapping
  const chartData =
    !isError && !fetching && Object.keys(summary || {}).length
      ? [
          { x: 'Passed', y: summary.passed },
          { x: 'Failed', y: summary.failed },
          { x: 'Skipped', y: summary.skipped },
          { x: 'Error', y: summary.error },
          { x: 'Xfailed', y: summary.xfailed },
          { x: 'Xpassed', y: summary.xpassed },
          { x: 'Manual', y: summary?.manual || 0 },
        ]
      : [];

  const legendData =
    !isError && !fetching && Object.keys(summary || {}).length
      ? [
          {
            name: `Passed (${summary.passed})`,
            symbol: { fill: CHART_COLOR_MAP.passed },
          },
          {
            name: `Failed (${summary.failed})`,
            symbol: { fill: CHART_COLOR_MAP.failed },
          },
          {
            name: `Skipped (${summary.skipped})`,
            symbol: { fill: CHART_COLOR_MAP.skipped },
          },
          {
            name: `Error (${summary.error})`,
            symbol: { fill: CHART_COLOR_MAP.error },
          },
          {
            name: `xFailed (${summary.xfailed})`,
            symbol: { fill: CHART_COLOR_MAP.xfailed },
          },
          {
            name: `xPassed (${summary.xpassed})`,
            symbol: { fill: CHART_COLOR_MAP.xpassed },
          },
          {
            name: `Manual (${summary.manual || 'N/A'})`,
            symbol: { fill: CHART_COLOR_MAP.manual },
          },
        ]
      : [];

  return (
    <Card>
      <WidgetHeader
        title={title}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
      />
      <CardBody>
        {isError && <p>Error fetching data</p>}
        {!isError && fetching && <Text component="h2">Loading ...</Text>}
        {!isError && !fetching && Object.keys(summary || {}).length && (
          <div>
            <ChartDonut
              constrainToVisibleArea={true}
              data={chartData}
              labels={({ datum }) => `${toTitleCase(datum.x)}: ${datum.y}`}
              height={200}
              title={summary.total}
              subTitle="total results"
              colorScale={Object.values(CHART_COLOR_MAP)}
              style={{
                labels: { fontFamily: 'RedHatText' },
              }}
            />
            <p className="pf-v5-u-pt-sm">
              Total number of tests: {summary.total}
            </p>
          </div>
        )}
      </CardBody>
      <CardFooter>
        {!isError && !fetching && Object.keys(summary || {}).length > 0 && (
          <ChartLegend
            data={legendData}
            height={90}
            orientation="horizontal"
            responsive={false}
            itemsPerRow={2}
            style={{
              labels: { fontFamily: 'RedHatText' },
              title: { fontFamily: 'RedHatText' },
            }}
          />
        )}
      </CardFooter>
    </Card>
  );
};

ResultSummaryWidget.propTypes = {
  title: PropTypes.string,
  params: PropTypes.object,
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func,
};

export default ResultSummaryWidget;
