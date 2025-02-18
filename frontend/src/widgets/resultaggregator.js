import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

import {
  ChartDonut,
  ChartLegend,
  ChartPie,
  ChartThemeColor,
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


const ResultAggregatorWidget = (props) => {
  const {
    title,
    params,
    dropdownItems,
    onDeleteClick,
    onEditClick
  } = props;

  const [chartData, setChartData] = useState([]);
  const [legendData, setLegendData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [resultAggregatorError, setResultAggregatorError] = useState(false);

  const getChartData = useCallback(() => {
    setIsLoading(true);
    HttpClient.get([Settings.serverUrl, 'widget', 'result-aggregator'], params)
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        if (!response.ok) {
          throw Error(response.statusText);
        }
        return response.json();
      })
      .then(data => {
        let _chartData = [];
        let _legendData = [];
        let _total = 0;
        data.forEach( ( datum ) =>  {
          _chartData.push({x: datum._id, y: datum.count});
          _legendData.push({name: toTitleCase(datum._id) + ': ' + datum.count});
          _total = _total + datum.count;
        });
        setChartData(_chartData);
        setLegendData(_legendData);
        setTotal(_total);

        setIsLoading(false);
        setResultAggregatorError(false);
      })
      .catch(error => {
        setResultAggregatorError(true);
        console.log(error);
      });
  }, [params]);

  useEffect(() => {
    getChartData();
  }, [getChartData]);

  const onGroupFieldSelect = (value) => {
    params.group_field = value;
    getChartData();
  };

  const onDaySelect = (value) => {
    params.days = value;
    getChartData();
  };

  const themeColors = [
    'var(--pf-v5-global--success-color--100)',
    'var(--pf-v5-global--danger-color--100)',
    'var(--pf-v5-global--warning-color--100)',
    'var(--pf-v5-global--info-color--100)',
    'var(--pf-v5-global--primary-color--100)'
  ];

  return (
    <Card>
      <WidgetHeader title={title} getDataFunc={getChartData} onEditClick={onEditClick} onDeleteClick={onDeleteClick}/>
      <CardBody data-id="recent-result-data">
        {resultAggregatorError &&
          <p>Error fetching data</p>
        }
        {(total === 0 && !isLoading) &&
          <p>No data returned, try changing the days.</p>
        }
        {(!resultAggregatorError && isLoading) &&
        <Text component="h2">Loading ...</Text>
        }
        {(!resultAggregatorError && !isLoading && params.chart_type === 'pie' && total !== 0) &&
          <ChartPie
            constrainToVisibleArea={true}
            data={chartData}
            legendData={legendData}
            labels={({datum}) => `${toTitleCase(datum.x)}: ${datum.y}`}
            labelComponent={
              <ChartTooltip
                constrainToVisibleArea
                dx={-10}
                style={{ fill: 'white' }}
              />
            }
            width={350}
            padding={{
              bottom: 20,
              left: 20,
              right: 20,
              top: 20
            }}
            themeColor={ChartThemeColor.multi}
          />
        }
        {(!resultAggregatorError && !isLoading && params.chart_type === 'donut' && total !== 0) &&
          <ChartDonut
            constrainToVisibleArea
            data={chartData}
            legendData={legendData}
            labels={({datum}) => `${toTitleCase(datum.x || '')}: ${datum.y}`}
            height={200}
            title={total}
            subTitle="total results"
            style={{
              labels: {fontFamily: 'RedHatText'}
            }}
            colorScale={themeColors}
          />
        }
      </CardBody>
      <CardFooter>
        {!isLoading && total !== 0 &&
        <ChartLegend
          data={legendData}
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
        <ParamDropdown
          dropdownItems={dropdownItems || ['result', 'metadata.exception_name', 'component', 'metadata.classification']}
          defaultValue={params.group_field}
          handleSelect={onGroupFieldSelect}
          tooltip="Group data by:"
        />
        <ParamDropdown
          dropdownItems={[0.1, 0.5, 1, 3, 5]}
          handleSelect={onDaySelect}
          defaultValue={params.days}
          tooltip="Set days to:"
        />
      </CardFooter>
    </Card>
  );
};


ResultAggregatorWidget.propTypes = {
  title: PropTypes.string,
  params: PropTypes.object,
  dropdownItems: PropTypes.array,
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func
};

export default ResultAggregatorWidget;
