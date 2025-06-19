import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Chart from 'react-apexcharts';

import { Card, CardBody, CardFooter, Content } from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { getDarkTheme, toTitleCase } from '../utilities';
import WidgetHeader from '../components/widget-header';
import ParamDropdown from '../components/param-dropdown';
import { CHART_COLOR_MAP } from '../constants';

const ResultAggregateApex = ({
  title,
  params,
  days,
  groupField,
  dropdownItems,
  onDeleteClick,
  onEditClick,
}) => {
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [resultAggregatorError, setResultAggregatorError] = useState(false);
  const [filterDays, setFilterDays] = useState(days);
  const [filterGroupField, setFilterGroupField] = useState(groupField);
  const additionalFilters = useRef(params.additional_filters);
  const runId = useRef(params.run_id);
  const project = useRef(params.project);

  console.dir(params);

  useEffect(() => {
    setIsLoading(true);
    const fetchAggregated = async () => {
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'widget', 'result-aggregator'],
          {
            days: filterDays,
            group_field: filterGroupField,
            chart_type: 'donut',
            project: project.current,
            additional_filters: additionalFilters.current,
            run_id: runId.current,
          },
        );
        const data = await HttpClient.handleResponse(response);
        let _chartData = [];
        let _total = 0;
        data.forEach((datum) => {
          _chartData.push({
            x: datum._id,
            y: datum.count,
          });

          _total += datum.count;
        });
        setChartData(_chartData);
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
  }, [filterDays, filterGroupField]);

  // Prepare data for ApexCharts
  const { chartSeries, chartLabels } = useMemo(() => {
    if (!chartData.length) {
      return { chartSeries: [], chartLabels: [], chartColors: [] };
    }

    const series = [];
    const labels = [];

    chartData.forEach((datum) => {
      series.push(datum.y);
      labels.push(toTitleCase(datum.x));
    });

    return {
      chartSeries: series,
      chartLabels: labels,
    };
  }, [chartData]);

  // ApexCharts configuration
  const chartOptions = {
    chart: {
      type: 'donut',
    },
    colors: chartLabels.map((label) => CHART_COLOR_MAP[label.toLowerCase()]),
    labels: chartLabels,
    legend: {
      show: true,
      position: 'bottom',
      fontFamily: 'RedHatText, sans-serif',
      labels: {
        colors: chartLabels.map(
          (label) => CHART_COLOR_MAP[label.toLowerCase()],
        ),
        overflow: 'visible',
      },
      formatter: function (val) {
        return val;
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: '85%',
          labels: {
            show: true,
            name: {
              show: true,
              fontFamily: 'RedHatText, sans-serif',
              color: 'var(--pf-t--global--text--color--regular)',
            },
            value: {
              show: true,
              fontFamily: 'RedHatText, sans-serif',
              color: 'var(--pf-t--global--text--color--regular)',
              formatter: function (val) {
                return val;
              },
            },
            total: {
              show: true,
              showAlways: false,
              label: 'Total Results',
              fontWeight: 600,
              fontFamily: 'RedHatText, sans-serif',
              color: 'var(--pf-t--global--text--color--subtle)',
              formatter: function () {
                return total || 0;
              },
            },
          },
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
    tooltip: {
      enabled: true,
      theme: getDarkTheme() ? 'dark' : 'light',
      style: {
        fontFamily: 'RedHatText, sans-serif',
      },
      y: {
        formatter: function (val) {
          return `${val} results`;
        },
      },
    },
    responsive: [
      {
        breakpoint: 768,
        options: {
          chart: {
            height: 250,
          },
        },
      },
    ],
  };

  const onGroupFieldSelect = (value) => {
    setFilterGroupField(value);
  };

  const onDaySelect = (value) => {
    setFilterDays(value);
  };

  return (
    <Card className="ibutsu-widget-card">
      <WidgetHeader
        title={title || 'Result Aggregator'}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
      />
      <CardBody className="ibutsu-widget-card-body">
        {resultAggregatorError && (
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
        {total === 0 && !isLoading && (
          <div
            style={{
              textAlign: 'center',
            }}
          >
            <Content>No data returned, try changing the days.</Content>
          </div>
        )}
        {!resultAggregatorError && isLoading && (
          <div
            style={{
              textAlign: 'center',
            }}
          >
            <Content component="h2">Loading ...</Content>
          </div>
        )}
        {!resultAggregatorError && !isLoading && total !== 0 && (
          <div className="ibutsu-widget-chart-container">
            <Chart
              className="ibutsu-widget-chart"
              options={chartOptions}
              series={chartSeries}
              type="donut"
            />
          </div>
        )}
      </CardBody>
      <CardFooter className="ibutsu-widget-footer">
        <div style={{ marginTop: 'var(--pf-v6-global--spacer--sm)' }}>
          <ParamDropdown
            dropdownItems={
              dropdownItems || [
                'result',
                'metadata.exception_name',
                'component',
                'metadata.classification',
                `${groupField}`,
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
        </div>
      </CardFooter>
    </Card>
  );
};

ResultAggregateApex.propTypes = {
  title: PropTypes.string,
  params: PropTypes.object,
  days: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  groupField: PropTypes.string,
  dropdownItems: PropTypes.array,
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func,
};

export default ResultAggregateApex;
