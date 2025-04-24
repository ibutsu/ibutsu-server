import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import {
  ChartDonut,
  ChartLegend
} from '@patternfly/react-charts';
import {
  Card,
  CardBody,
  CardFooter,
  Text
} from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { toTitleCase } from '../utilities';
import WidgetHeader from '../components/widget-header';

const ResultSummaryWidget = ( props ) => {
  const {
    title,
    params,
    onDeleteClick,
    onEditClick
  } = props;

  const [summary, setSummary] = useState({
    passed: 0,
    failed: 0,
    error: 0,
    skipped: 0,
    xfailed: 0,
    xpassed: 0,
    other: 0,
    total: 0
  });

  const [dataError, setDataError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    setIsLoading(true);
    HttpClient.get([Settings.serverUrl, 'widget', 'result-summary'], params)
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        return response.json();
      })
      .then(data => {
        setSummary(data);
        setIsLoading(false);
        setDataError(false);
      })
      .catch(error => {
        setDataError(true);
        setIsLoading(false);
        console.log(error);
      });
  }, [params]);

  const themeColors = [
    'var(--pf-v5-global--success-color--100)',
    'var(--pf-v5-global--danger-color--100)',
    'var(--pf-v5-global--info-color--100)',
    'var(--pf-v5-global--warning-color--100)',
    'var(--pf-v5-global--palette--purple-400)',
    'var(--pf-v5-global--palette--purple-700)',
    'var(--pf-v5-global--primary-color--100)'
  ];

  return (
    <Card>
      <WidgetHeader title={title} onEditClick={onEditClick} onDeleteClick={onDeleteClick}/>
      <CardBody>
        {dataError &&
          <p>Error fetching data</p>
        }
        {!dataError && isLoading &&
          <Text component="h2">Loading ...</Text>
        }
        {!dataError && !isLoading &&
          <div>
            <ChartDonut
              constrainToVisibleArea={true}
              data={[
                { x: 'Passed', y: summary.passed },
                { x: 'Failed', y: summary.failed },
                { x: 'Skipped', y: summary.skipped },
                { x: 'Error', y: summary.error },
                { x: 'Xfailed', y: summary.xfailed },
                { x: 'Xpassed', y: summary.xpassed }
              ]}
              labels={({datum}) => `${toTitleCase(datum.x)}: ${datum.y}`}
              height={200}
              title={summary.total}
              subTitle="total results"
              style={{
                labels: {fontFamily: 'RedHatText'}
              }}
              colorScale={themeColors}
            />
            <p className="pf-u-pt-sm">Total number of tests: {summary.total}</p>
          </div>
        }
      </CardBody>
      <CardFooter>
        {!dataError && !isLoading &&
        <ChartLegend
          data={[
            {name: 'Passed (' + summary.passed + ')'},
            {name: 'Failed (' + summary.failed + ')'},
            {name: 'Skipped (' + summary.skipped + ')'},
            {name: 'Error (' + summary.error + ')'},
            {name: 'Xfailed (' + summary.xfailed + ')'},
            {name: 'Xpassed (' + summary.xpassed + ')'}
          ]}
          height={120}
          orientation="horizontal"
          responsive={false}
          itemsPerRow={2}
          colorScale={themeColors}
          style={{
            labels: {fontFamily: 'RedHatText'},
            title: {fontFamily: 'RedHatText'}
          }}
        />
        }
      </CardFooter>
    </Card>
  );
};

ResultSummaryWidget.propTypes = {
  title: PropTypes.string,
  params: PropTypes.object,
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func
};

export default ResultSummaryWidget;
