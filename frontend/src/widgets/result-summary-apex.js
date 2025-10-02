import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Chart from 'react-apexcharts';

import { Card, CardBody, Content } from '@patternfly/react-core';

import { HttpClient } from '../utilities/http';
import { Settings } from '../pages/settings';
import { getDarkTheme, toTitleCase } from '../utilities';
import WidgetHeader from '../components/widget-header';
import { CHART_COLOR_MAP, WIDGET_HEIGHT } from '../constants';
import ResultWidgetLegend from './result-widget-legend';
import { useSVGContainerDimensions } from '../components/hooks/use-svg-container-dimensions';

const ResultSummaryApex = ({ title, params, onDeleteClick, onEditClick }) => {
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

  // Dynamic SVG container measurement
  const { containerRef, width: containerWidth } = useSVGContainerDimensions();

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

  // Prepare data for ApexCharts
  const { chartSeries, chartLabels, chartColors } = useMemo(() => {
    if (!Object.keys(summary || {}).length) {
      return { chartSeries: [], chartLabels: [], chartColors: [] };
    }

    const series = [];
    const labels = [];
    const colors = [];

    Object.keys(summary)
      .filter((key) => key !== 'total' && summary[key] > 0)
      .forEach((resultType) => {
        series.push(summary[resultType]);
        labels.push(toTitleCase(resultType));
        colors.push(
          CHART_COLOR_MAP[resultType] ||
            'var(--pf-v6-global--BackgroundColor--100)',
        );
      });

    return {
      chartSeries: series,
      chartLabels: labels,
      chartColors: colors,
    };
  }, [summary]);

  // Legend data for with custom symbols
  const legendData = useMemo(() => {
    return Object.keys(summary || {}).length
      ? Object.keys(summary)
          .filter((key) => key !== 'total' && summary[key] > 0)
          .map((resultType) => ({
            name: `${toTitleCase(resultType)} (${summary[resultType]})`,
            symbol: {
              fill: CHART_COLOR_MAP[resultType],
              type: resultType,
            },
          }))
      : [];
  }, [summary]);

  const itemsPerRow = Math.ceil(legendData.length / 3);

  // ApexCharts configuration
  const chartOptions = useMemo(() => {
    return {
      chart: {
        type: 'donut',
      },
      legend: {
        show: false,
      },
      colors: chartColors,
      labels: chartLabels,
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
                label: 'Total Count',
                fontWeight: 600,
                fontFamily: 'RedHatText, sans-serif',
                color: 'var(--pf-t--global--text--color--subtle)',
                formatter: function () {
                  return summary.total || 0;
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
            return `${val} tests`;
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
  }, [chartColors, chartLabels, summary.total]);

  return (
    <Card className="ibutsu-widget-card">
      <WidgetHeader
        title={title || 'Test Results Summary'}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
      />
      <CardBody className="ibutsu-widget-card-body">
        {isError && (
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
        {!isError && fetching && (
          <div
            style={{
              textAlign: 'center',
            }}
          >
            <Content component="h2">Loading ...</Content>
          </div>
        )}
        {!isError && !fetching && Object.keys(summary || {}).length && (
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
            {Object.keys(summary || {}).length > 0 && (
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <svg
                  ref={containerRef}
                  style={{ overflow: 'visible', width: '100%', height: '60px' }}
                >
                  {legendData.map((item, index) => {
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
    </Card>
  );
};

ResultSummaryApex.propTypes = {
  title: PropTypes.string,
  params: PropTypes.object,
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func,
};

export default ResultSummaryApex;
