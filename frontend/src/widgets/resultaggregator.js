import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import {
  ChartDonut,
  ChartLegend,
  ChartPie,
  ChartTooltip,
} from '@patternfly/react-charts';
import { Card, CardBody, CardFooter, Title } from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { toTitleCase } from '../utilities';
import WidgetHeader from '../components/widget-header';
import ParamDropdown from '../components/param-dropdown';
import { CHART_COLOR_MAP } from '../constants';

const ResultAggregatorWidget = ({
  title,
  params,
  chartType,
  days,
  groupField,
  dropdownItems,
  onDeleteClick,
  onEditClick,
}) => {
  const [chartData, setChartData] = useState([]);
  const [legendData, setLegendData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [resultAggregatorError, setResultAggregatorError] = useState(false);
  const [filterDays, setFilterDays] = useState(days);
  const [filterGroupField, setFilterGroupField] = useState(groupField);
  const filterChartType = useRef(chartType);
  const additionalFilters = useRef(params.additional_filters);
  const runId = useRef(params.run_id);
  const project = useRef(params.project);

  useEffect(() => {
    setIsLoading(true);
    const fetchAggregated = async () => {
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'widget', 'result-aggregator'],
          {
            days: filterDays,
            group_field: filterGroupField,
            chart_type: filterChartType.current,
            project: project.current,
            additional_filters: additionalFilters.current,
            run_id: runId.current,
          },
        );
        const data = await HttpClient.handleResponse(response);
        let _chartData = [];
        let _legendData = [];
        let _total = 0;
        data.forEach((datum) => {
          _chartData.push({
            x: datum._id,
            y: datum.count,
          });
          _legendData.push({
            name: toTitleCase(datum._id) + ': ' + datum.count,
            symbol: {
              fill: CHART_COLOR_MAP[datum._id] || CHART_COLOR_MAP.default,
            },
          });
          _total = _total + datum.count;
        });
        setChartData(_chartData);
        setLegendData(_legendData);
        setTotal(_total);

        setIsLoading(false);
        setResultAggregatorError(false);
      } catch (error) {
        setIsLoading(false);
        setResultAggregatorError(true);
        console.error('Error fetching result aggregator data:', error);
      }
    };
    fetchAggregated();
  }, [filterDays, filterGroupField, filterChartType]);

  const onGroupFieldSelect = (value) => {
    setFilterGroupField(value);
  };

  const onDaySelect = (value) => {
    setFilterDays(value);
  };

  return (
    <Card>
      <WidgetHeader
        title={title}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
      />
      <CardBody data-id="recent-result-data">
        {resultAggregatorError && <p>Error fetching data</p>}
        {total === 0 && !isLoading && (
          <p>No data returned, try changing the days.</p>
        )}
        {!resultAggregatorError && isLoading && (
          <Title headingLevel="h2">Loading ...</Title>
        )}
        {!resultAggregatorError &&
          !isLoading &&
          filterChartType.current === 'pie' &&
          total !== 0 && (
            <ChartPie
              constrainToVisibleArea={true}
              data={chartData}
              legendData={legendData}
              style={{
                data: {
                  fill: ({ datum }) =>
                    CHART_COLOR_MAP[datum.x] || CHART_COLOR_MAP.default,
                },
              }}
              labels={({ datum }) => `${toTitleCase(datum.x)}: ${datum.y}`}
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
                top: 20,
              }}
            />
          )}
        {!resultAggregatorError &&
          !isLoading &&
          filterChartType.current === 'donut' &&
          total !== 0 && (
            <ChartDonut
              constrainToVisibleArea
              data={chartData}
              legendData={legendData}
              labels={({ datum }) =>
                `${toTitleCase(datum.x || '')}: ${datum.y}`
              }
              height={200}
              title={total}
              subTitle="total results"
              style={{
                data: {
                  fill: ({ datum }) =>
                    CHART_COLOR_MAP[datum.x] || CHART_COLOR_MAP.default,
                },
                labels: { fontFamily: 'RedHatText' },
              }}
            />
          )}
      </CardBody>
      <CardFooter>
        {!isLoading && total !== 0 && (
          <ChartLegend
            data={legendData}
            height={120}
            orientation="horizontal"
            responsive={false}
            itemsPerRow={2}
            style={{
              labels: { fontFamily: 'RedHatText' },
              title: { fontFamily: 'RedHatText' },
            }}
          />
        )}
        <ParamDropdown
          dropdownItems={
            dropdownItems || [
              'result',
              'metadata.exception_name',
              'component',
              'metadata.classification',
            ]
          }
          defaultValue={filterGroupField}
          handleSelect={onGroupFieldSelect}
          tooltip="Group data by:"
        />
        <ParamDropdown
          dropdownItems={[3, 5, 10, 14, 90]}
          handleSelect={onDaySelect}
          defaultValue={filterDays}
          tooltip="Set days to:"
        />
      </CardFooter>
    </Card>
  );
};

ResultAggregatorWidget.propTypes = {
  title: PropTypes.string,
  params: PropTypes.object,
  chartType: PropTypes.string,
  days: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  groupField: PropTypes.string,
  dropdownItems: PropTypes.array,
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func,
};

export default ResultAggregatorWidget;
