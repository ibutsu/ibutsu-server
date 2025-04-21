import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import {
  ChartDonut,
  ChartLegend,
  ChartPie,
  ChartThemeColor,
  ChartTooltip,
} from '@patternfly/react-charts';
import { Card, CardBody, CardFooter, Title } from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { toTitleCase } from '../utilities';
import WidgetHeader from '../components/widget-header';
import ParamDropdown from '../components/param-dropdown';

const ResultAggregatorWidget = (props) => {
  const {
    title,
    params,
    chartType,
    days,
    groupField,
    dropdownItems,
    onDeleteClick,
    onEditClick,
  } = props;

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
    const _params = {
      days: filterDays,
      group_field: filterGroupField,
      chart_type: filterChartType.current,
      project: project.current,
      additional_filters: additionalFilters.current,
      run_id: runId.current,
    };

    HttpClient.get([Settings.serverUrl, 'widget', 'result-aggregator'], _params)
      .then((response) => {
        response = HttpClient.handleResponse(response, 'response');
        if (!response.ok) {
          throw Error(response.statusText);
        }
        return response.json();
      })
      .then((data) => {
        let _chartData = [];
        let _legendData = [];
        let _total = 0;
        data.forEach((datum) => {
          _chartData.push({ x: datum._id, y: datum.count });
          _legendData.push({
            name: toTitleCase(datum._id) + ': ' + datum.count,
          });
          _total = _total + datum.count;
        });
        setChartData(_chartData);
        setLegendData(_legendData);
        setTotal(_total);

        setIsLoading(false);
        setResultAggregatorError(false);
      })
      .catch((error) => {
        setResultAggregatorError(true);
        console.log(error);
      });
  }, [filterDays, filterGroupField, filterChartType]);

  const onGroupFieldSelect = (value) => {
    setFilterGroupField(value);
  };

  const onDaySelect = (value) => {
    setFilterDays(value);
  };

  const themeColors = [
    'var(--pf-v5-global--success-color--100)',
    'var(--pf-v5-global--danger-color--100)',
    'var(--pf-v5-global--warning-color--100)',
    'var(--pf-v5-global--info-color--100)',
    'var(--pf-v5-global--primary-color--100)',
  ];

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
              themeColor={ChartThemeColor.multi}
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
                labels: { fontFamily: 'RedHatText' },
              }}
              colorScale={themeColors}
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
            colorScale={themeColors}
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
          dropdownItems={[3, 5, 10, 14]}
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
  days: PropTypes.string,
  groupField: PropTypes.string,
  dropdownItems: PropTypes.array,
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func,
};

export default ResultAggregatorWidget;
