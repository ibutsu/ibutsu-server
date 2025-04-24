import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';

import {
  Chart,
  ChartAxis,
  ChartBar,
  ChartLegend,
  ChartStack,
  ChartTooltip,
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
import ParamDropdown from '../components/param-dropdown';

const GenericBarWidget = (props) => {
  const {
    barWidth = 20,
    dropdownItems = ['component', 'env', 'metadata.jenkins.job_name'],
    fontSize,
    height,
    hideDropdown,
    horizontal,
    padding = {
      bottom: 30,
      left: 150,
      right: 15,
      top: 20
    },
    params = {},
    percentData,
    sortOrder = 'descending',
    title = 'Recent Run Results',
    widgetEndpoint = 'run-aggregator',
    xLabel = '',
    xLabelTooltip,
    yLabel = '',
    onDeleteClick,
    onEditClick,
  } = props;

  const [data, setData] = useState({});
  const [barCharts, setBarCharts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [genericBarError, setGenericBarError] = useState(false);
  const[groupField, setGroupField] = useState(params.group_field);
  const[weeks, setWeeks] = useState(params.weeks);

  const getBarStyle = (key) => {
    let color = 'var(--pf-v5-global--success-color--100)';
    if (key === 'failed') {
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
  };

  useEffect(() => {
    setIsLoading(true);
    HttpClient.get([Settings.serverUrl, 'widget', widgetEndpoint], params)
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        if (!response.ok) {
          throw Error(response.statusText);
        }
        return response.json();
      })
      .then(responseData => {
        setData({...responseData});
        setIsLoading(false);
      })
      .catch(error => {
        setGenericBarError(true);
        console.log(error);
      });
  }, [widgetEndpoint, params]);

  useEffect(() => {
    const barCharts = [];

    const getLabels = () => {
      if (percentData) {
        return ({datum}) => `${toTitleCase(datum.name)}: ${datum.y} %`;
      }
      else {
        if (xLabelTooltip) {
          return ({datum}) => `${xLabelTooltip}: ${datum.x} \n ${toTitleCase(datum.name)}: ${datum.y}`;
        }
        else {
          return ({datum}) => `${toTitleCase(datum.name)}: ${datum.y}`;

        }
      }
    };

    for (const test_state of Object.keys(data)) {
      if (test_state !== 'filter') {
        const barData = [];
        for (const group_field of Object.keys(data[test_state])) {
          barData.push({name: toTitleCase(test_state), x: group_field, y: data[test_state][group_field]});
        }
        if (barData.length !== 0) {
          barCharts.push(
            <ChartBar
              key={test_state}
              style={{data: {fill: getBarStyle(test_state)}}}
              barWidth={barWidth}
              data={barData}
              sortKey={(datum) => `${datum.x}`}
              sortOrder={sortOrder}
              horizontal={horizontal}
              labels={getLabels()}
              labelComponent={
                <ChartTooltip
                  dx={horizontal ? -10 : 0}
                  dy={horizontal ? 0 : -10}
                  style={{ fill: 'white', fontSize: fontSize-2 || 14}}
                />
              }
            />
          );
        }
      }
    }
    setBarCharts(barCharts);
  }, [data, barWidth, fontSize, horizontal, sortOrder, percentData, xLabelTooltip]);

  const getChartHeight = (numBars) => {
    if (numBars > 10) {
      return numBars*30;
    }
    else {
      return 300;
    }
  };

  const getDropdowns = () => {
    if (hideDropdown) {
      return null;
    }
    else {
      return (
        <div>
          <ParamDropdown
            dropdownItems={dropdownItems}
            defaultValue={groupField}
            handleSelect={(value) => setGroupField(value)}
            tooltip="Group data by:"
          />
          <ParamDropdown
            dropdownItems={[1, 2, 3, 4, 5, 6]}
            handleSelect={(value) => setWeeks(value)}
            defaultValue={weeks}
            tooltip="Set weeks to:"
          />
        </div>
      );
    }
  };

  return (
    <Card>
      <WidgetHeader title={title} onEditClick={onEditClick} onDeleteClick={onDeleteClick}/>
      <CardBody data-id="recent-runs">
        {genericBarError &&
          <p>Error fetching data</p>
        }
        {(!genericBarError && isLoading) &&
        <Text component="h2">Loading ...</Text>
        }
        {(!genericBarError && !isLoading) &&
        <Chart
          domainPadding={ horizontal ? { x: 20 } : { y: 20} }
          padding={padding}
          height={height || getChartHeight(Object.keys(data['passed']).length)}
        >
          <ChartAxis
            label={xLabel}
            fixLabelOverlap={!horizontal}
            style={{
              tickLabels: {fontSize: fontSize-2 || 12},
              axisLabel: {fontSize: fontSize || 12}
            }}
          />
          <ChartAxis
            label={yLabel}
            dependentAxis
            style={{
              tickLabels: {fontSize: fontSize-2 || 12},
              axisLabel: {fontSize: fontSize || 12}
            }}
          />
          <ChartStack>
            {barCharts}
          </ChartStack>
        </Chart>
        }
      </CardBody>
      <CardFooter>
        <ChartLegend
          height={30}
          data={[
            {name: 'Passed'},
            {name: 'Failed'},
            {name: 'Skipped'},
            {name: 'Error'},
            {name: 'Xfailed'},
            {name: 'Xpassed'}
          ]}
          colorScale={[
            'var(--pf-v5-global--success-color--100)',
            'var(--pf-v5-global--danger-color--100)',
            'var(--pf-v5-global--info-color--100)',
            'var(--pf-v5-global--warning-color--100)',
            'var(--pf-v5-global--palette--purple-400)',
            'var(--pf-v5-global--palette--purple-700)',
          ]}
          style={{
            labels: {fontFamily: 'RedHatText', fontSize: fontSize-2 || 12},
            title: {fontFamily: 'RedHatText'}
          }}
        />
        {getDropdowns()}
      </CardFooter>
    </Card>
  );

};

GenericBarWidget.propTypes = {
  barWidth: PropTypes.number,
  dropdownItems: PropTypes.array,
  fontSize: PropTypes.number,
  height: PropTypes.number,
  hideDropdown: PropTypes.bool,
  horizontal: PropTypes.bool,
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func,
  padding: PropTypes.object,
  params: PropTypes.object,
  percentData: PropTypes.bool,
  sortOrder: PropTypes.string,
  title: PropTypes.string,
  widgetEndpoint: PropTypes.string,
  xLabel: PropTypes.string,
  xLabelTooltip: PropTypes.string,
  yLabel: PropTypes.string,
};

export default GenericBarWidget;
