import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Chart from 'react-apexcharts';

import { Card, CardBody, CardFooter, Content } from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { getDarkTheme, toTitleCase } from '../utilities';
import WidgetHeader from '../components/widget-header';
import ParamDropdown from '../components/param-dropdown';
import { CHART_COLOR_MAP } from '../constants';
import ResultWidgetLegend from './ResultWidgetLegend';

const RunAggregateApex = ({
  title,
  params,
  horizontal = true,
  dropdownItems,
  onDeleteClick,
  onEditClick,
}) => {
  const [chartData, setChartData] = useState({});
  const [legendData, setLegendData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runAggregatorError, setRunAggregatorError] = useState(false);
  const [groupField, setGroupField] = useState(params.group_field);
  const [weeks, setWeeks] = useState(params.weeks);

  console.dir(params);

  useEffect(() => {
    setIsLoading(true);
    const fetchAggregated = async () => {
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'widget', 'run-aggregator'],
          {
            ...params,
            group_field: groupField,
            weeks: weeks,
          },
        );
        const data = await HttpClient.handleResponse(response);
        setChartData(data);

        // Create legend data from chart data
        const _legendData = Object.keys(data || {})
          .filter((key) => key !== 'filter')
          .map((resultType) => ({
            name: `${toTitleCase(resultType)}`,
            symbol: {
              fill: CHART_COLOR_MAP[resultType] || CHART_COLOR_MAP.default,
              type: resultType,
            },
          }));
        setLegendData(_legendData);

        setIsLoading(false);
        setRunAggregatorError(false);
      } catch (error) {
        setIsLoading(false);
        setRunAggregatorError(true);
        console.error('Error fetching run aggregator data:', error);
      }
    };
    if (Object.keys(params || {}).length) {
      fetchAggregated();
    }
  }, [params, groupField, weeks]);

  // Prepare data for ApexCharts horizontal bar chart
  const { chartSeries, chartCategories } = useMemo(() => {
    if (!Object.keys(chartData || {}).length) {
      return { chartSeries: [], chartCategories: [] };
    }

    const series = [];
    const categories = new Set();

    // Collect all categories first
    Object.keys(chartData).forEach((testState) => {
      if (testState !== 'filter') {
        Object.keys(chartData[testState]).forEach((groupField) => {
          categories.add(groupField);
        });
      }
    });

    const sortedCategories = Array.from(categories).sort();

    // Create series data for each test state
    Object.keys(chartData).forEach((testState) => {
      if (testState !== 'filter') {
        const data = sortedCategories.map((category) => {
          return chartData[testState][category] || 0;
        });

        series.push({
          name: toTitleCase(testState),
          data: data,
          color: CHART_COLOR_MAP[testState] || CHART_COLOR_MAP.default,
        });
      }
    });

    return {
      chartSeries: series,
      chartCategories: sortedCategories,
    };
  }, [chartData]);

  // ApexCharts configuration for horizontal bar chart
  const chartOptions = useMemo(() => {
    return {
      chart: {
        type: 'bar',
        stacked: true,
        stackType: '100%',
      },
      toolbar: {
        show: false,
      },
      colors: chartSeries.map((series) => series.color),
      plotOptions: {
        bar: {
          horizontal: horizontal,
          dataLabels: {
            position: 'center',
          },
        },
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        show: true,
        width: 1,
        colors: ['var(--pf-t--global--text--color--regular)'],
      },
      xaxis: {
        categories: chartCategories,
        labels: {
          style: {
            fontFamily: 'RedHatText, sans-serif',
            fontSize: '12px',
            colors: 'var(--pf-t--global--text--color--regular)',
          },
        },
      },
      yaxis: {
        labels: {
          style: {
            fontFamily: 'RedHatText, sans-serif',
            fontSize: '12px',
            colors: 'var(--pf-t--global--text--color--regular)',
          },
          formatter: function (val) {
            return val;
          },
        },
      },
      legend: {
        show: false,
      },
      tooltip: {
        enabled: true,
        theme: getDarkTheme() ? 'dark' : 'light',
        style: {
          fontFamily: 'RedHatText, sans-serif',
        },
        y: {
          formatter: function (val) {
            return `${val} %`;
          },
        },
      },
      responsive: [
        {
          breakpoint: 768,
          options: {
            chart: {
              height: 350,
            },
          },
        },
      ],
    };
  }, [chartSeries, chartCategories, horizontal]);

  const onGroupFieldSelect = (value) => {
    setGroupField(value);
  };

  const onWeekSelect = (value) => {
    setWeeks(value);
  };

  const itemsPerRow = Math.ceil(legendData.length / 3);

  return (
    <Card className="ibutsu-widget-card">
      <WidgetHeader
        title={title || 'Recent Run Results'}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
      />
      <CardBody className="ibutsu-widget-card-body">
        {runAggregatorError && (
          <div
            style={{
              textAlign: 'center',
            }}
          >
            <Content
              style={{ color: 'var(--pf-v6-global--danger-color--100)' }}
            >
              Error fetching data
            </Content>
          </div>
        )}
        {!runAggregatorError && isLoading && (
          <div
            style={{
              textAlign: 'center',
            }}
          >
            <Content component="h2">Loading ...</Content>
          </div>
        )}
        {!runAggregatorError &&
          !isLoading &&
          Object.keys(chartData || {}).length > 0 && (
            <div className="ibutsu-widget-chart-container">
              <Chart
                className="ibutsu-widget-chart"
                options={chartOptions}
                series={chartSeries}
                type="bar"
                height={350}
              />
            </div>
          )}
      </CardBody>
      <CardFooter className="ibutsu-widget-footer">
        {!runAggregatorError && !isLoading && legendData.length > 0 && (
          <svg style={{ overflow: 'visible' }}>
            {legendData.map((item, index) => {
              const row = Math.floor(index / itemsPerRow);
              const col = index % itemsPerRow;
              const itemWidth = 120;

              return (
                <ResultWidgetLegend
                  key={item.name}
                  x={col * itemWidth}
                  y={20 + row * 25}
                  datum={item}
                  style={{
                    fill: 'var(--pf-t--global--text--color--regular)',
                  }}
                />
              );
            })}
          </svg>
        )}
        <ParamDropdown
          dropdownItems={
            dropdownItems || ['component', 'env', 'metadata.jenkins.job_name']
          }
          defaultValue={groupField}
          handleSelect={onGroupFieldSelect}
          tooltip="Group data by:"
        />
        <ParamDropdown
          dropdownItems={[1, 2, 3, 4, 5, 6]}
          handleSelect={onWeekSelect}
          defaultValue={weeks}
          tooltip="Set weeks to:"
        />
      </CardFooter>
    </Card>
  );
};

RunAggregateApex.propTypes = {
  title: PropTypes.string,
  params: PropTypes.object,
  horizontal: PropTypes.bool,
  dropdownItems: PropTypes.array,
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func,
};

export default RunAggregateApex;
