import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { ChartDonut, ChartLegend } from '@patternfly/react-charts';
import { Card, CardBody, CardFooter, Text } from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { toTitleCase } from '../utilities';
import WidgetHeader from '../components/widget-header';

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

  const themeColors = [
    'var(--pf-v5-global--success-color--100)',
    'var(--pf-v5-global--danger-color--100)',
    'var(--pf-v5-global--info-color--100)',
    'var(--pf-v5-global--warning-color--100)',
    'var(--pf-v5-global--palette--purple-400)',
    'var(--pf-v5-global--palette--purple-700)',
    'var(--pf-v5-global--primary-color--100)',
  ];

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
              data={[
                { x: 'Passed', y: summary.passed },
                { x: 'Failed', y: summary.failed },
                { x: 'Skipped', y: summary.skipped },
                { x: 'Error', y: summary.error },
                { x: 'Xfailed', y: summary.xfailed },
                { x: 'Xpassed', y: summary.xpassed },
                { x: 'Manual', y: summary?.manual }, // TODO result-summary data needs it
              ]}
              labels={({ datum }) => `${toTitleCase(datum.x)}: ${datum.y}`}
              height={200}
              title={summary.total}
              subTitle="total results"
              style={{
                labels: { fontFamily: 'RedHatText' },
              }}
              colorScale={themeColors}
            />
            <p className="pf-u-pt-sm">Total number of tests: {summary.total}</p>
          </div>
        )}
      </CardBody>
      <CardFooter>
        {!isError && !fetching && (
          <ChartLegend
            data={[
              { name: `Passed (${summary.passed})` },
              { name: `Failed (${summary.failed})` },
              { name: `Skipped (${summary.skipped})` },
              { name: `Error (${summary.error})` },
              { name: `xFailed (${summary.xfailed})` },
              { name: `xPassed (${summary.xpassed})` },
              { name: `Manual (${summary.manual || 'N/A'})` },
            ]}
            height={120}
            orientation="horizontal"
            responsive={false}
            itemsPerRow={2}
            colorScale={themeColors}
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
