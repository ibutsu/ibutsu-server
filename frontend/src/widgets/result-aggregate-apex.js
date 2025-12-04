import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Chart from 'react-apexcharts';

import { Card, CardBody, CardFooter, Content } from '@patternfly/react-core';

import { Settings } from '../pages/settings';
import { getDarkTheme, toTitleCase, HttpClient } from '../utilities';
import WidgetHeader from '../components/widget-header';
import ParamDropdown from '../components/param-dropdown';
import {
  CHART_COLOR_MAP,
  DEFAULT_CHART_COLORS,
  ICON_RESULT_MAP,
  WIDGET_HEIGHT,
} from '../constants';
import ResultWidgetLegend from './result-widget-legend';
import { useSVGContainerDimensions } from '../components/hooks/use-svg-container-dimensions';

// Helper function to get color for a label
const getColorForLabel = (label, index) => {
  // First check if it's a result type
  const resultColor = CHART_COLOR_MAP[label.toLowerCase()];
  if (resultColor) {
    return resultColor;
  }

  // Use default chart colors cycling through the array
  return DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length];
};

// Helper function to get colors for all labels
const getColorsForLabels = (labels) => {
  return labels.map((label, index) => getColorForLabel(label, index));
};

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

  // Dynamic SVG container measurement
  const { containerRef, width: containerWidth } = useSVGContainerDimensions();

  const dropdownItemsMemo = useMemo(() => {
    const uniqueItems = new Set([
      'result',
      'metadata.exception_name',
      'component',
      'metadata.classification',
      `${groupField}`,
    ]);
    return dropdownItems || [...uniqueItems];
  }, [dropdownItems, groupField]);

  useEffect(() => {
    setIsLoading(true);
    const fetchAggregated = async () => {
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'widget', 'result-aggregator'],
          {
            days: filterDays,
            group_field: filterGroupField,
            project: project.current,
            ...(additionalFilters.current
              ? { additional_filters: additionalFilters.current }
              : {}),
            ...(runId.current ? { run_id: runId.current } : {}),
          },
        );
        const data = await HttpClient.handleResponse(response);
        let _chartData = [];
        let _total = 0;
        data?.forEach((datum) => {
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

  const chartLegend = useMemo(() => {
    if (
      chartLabels?.length > 0 &&
      chartLabels.every((label) =>
        Object.keys(ICON_RESULT_MAP).includes(label.toLowerCase()),
      )
    ) {
      return {
        legendOption: {
          show: false,
        },
        legendData: chartLabels.map((resultLabel, index) => {
          // Find the corresponding count from chartData
          const chartItem = chartData.find(
            (item) => item.x === resultLabel.toLowerCase(),
          );
          const count = chartItem ? chartItem.y : chartSeries[index] || 0;

          return {
            name: `${resultLabel} (${count})`,
            symbol: {
              fill: CHART_COLOR_MAP[resultLabel.toLowerCase()],
              type: resultLabel.toLowerCase(),
            },
          };
        }),
      };
    } else {
      return {
        legendOption: {
          show: true,
          position: 'bottom',
          fontFamily: 'RedHatText, sans-serif',
          labels: {
            colors: getColorsForLabels(chartLabels),
            overflow: 'visible',
          },
          formatter: function (val) {
            return val;
          },
        },
      };
    }
  }, [chartData, chartLabels, chartSeries]);

  // ApexCharts configuration
  const chartOptions = useMemo(() => {
    return {
      chart: {
        type: 'donut',
      },
      colors: getColorsForLabels(chartLabels),
      labels: chartLabels,
      legend: chartLegend.legendOption,
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
              height: WIDGET_HEIGHT,
            },
          },
        },
      ],
    };
  }, [chartLabels, chartLegend, total]);

  const onGroupFieldSelect = (value) => {
    setFilterGroupField(value);
  };

  const onDaySelect = (value) => {
    setFilterDays(value);
  };

  const itemsPerRow = Math.ceil((chartLegend?.legendData?.length || 3) / 3);

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
          <>
            <div
              className="ibutsu-widget-chart-container"
              style={{ height: 'auto', minHeight: '250px' }}
            >
              <Chart
                className="ibutsu-widget-chart"
                options={chartOptions}
                series={chartSeries}
                type="donut"
              />
            </div>
            {chartLegend?.legendData?.length > 0 && (
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <svg
                  ref={containerRef}
                  style={{
                    overflow: 'visible',
                    width: '100%',
                    height: '60px',
                  }}
                >
                  {chartLegend?.legendData?.map((item, index) => {
                    const row = Math.floor(index / itemsPerRow);
                    const col = index % itemsPerRow;
                    const itemWidth = 150;
                    const totalLegendWidth = itemsPerRow * itemWidth;
                    const startX = Math.max(
                      0,
                      (containerWidth - totalLegendWidth) / 2,
                    );

                    return (
                      <ResultWidgetLegend
                        key={item.name}
                        x={startX + col * itemWidth}
                        y={20 + row * 25}
                        datum={item}
                        style={{
                          fill: 'var(--pf-t--global--text--color--regular)',
                        }}
                      />
                    );
                  })}
                </svg>
              </div>
            )}
          </>
        )}
      </CardBody>
      <CardFooter className="ibutsu-widget-footer">
        <ParamDropdown
          dropdownItems={dropdownItemsMemo}
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
