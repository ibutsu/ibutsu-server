import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Chart from 'react-apexcharts';

import { Card, CardBody, CardFooter, Content } from '@patternfly/react-core';

import { HttpClient } from '../utilities/http';
import { Settings } from '../pages/settings';
import { getDarkTheme, toTitleCase } from '../utilities';
import WidgetHeader from '../components/widget-header';
import ParamDropdown from '../components/param-dropdown';
import { CHART_COLOR_MAP } from '../constants';
import ResultWidgetLegend from './result-widget-legend';
import { useSVGContainerDimensions } from '../components/hooks/use-svg-container-dimensions';

// React 19 compatibility: This component supports both forwardRef (current React)
// and ref as a prop (React 19). The actualRef variable handles both cases.
const RunAggregateApex = forwardRef(
  (
    {
      title,
      params,
      horizontal = true,
      dropdownItems,
      onDeleteClick,
      onEditClick,
      // React 19 compatibility: accept ref as a prop
      ref: refProp,
    },
    ref,
  ) => {
    // Use the forwarded ref or the prop ref (React 19 compatibility)
    const actualRef = ref || refProp;
    const [chartData, setChartData] = useState({});
    const [legendData, setLegendData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [runAggregatorError, setRunAggregatorError] = useState(false);
    const [groupField, setGroupField] = useState(params.group_field);
    const [weeks, setWeeks] = useState(params.weeks);
    const [containerHeight, setContainerHeight] = useState(null);
    const cardRef = useRef(null);
    const resizeObserverRef = useRef(null);
    const timeoutRef = useRef(null);

    // Callback ref to handle both internal cardRef and forwarded ref
    const setCardRef = (node) => {
      cardRef.current = node;
      // Forward the ref to the parent component
      if (actualRef) {
        if (typeof actualRef === 'function') {
          actualRef(node);
        } else if (
          actualRef &&
          typeof actualRef === 'object' &&
          'current' in actualRef
        ) {
          actualRef.current = node;
        }
      }
    };

    // Dynamic SVG container measurement
    const { containerRef: legendContainerRef, width: legendContainerWidth } =
      useSVGContainerDimensions();

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

    // Effect to monitor container height changes
    useEffect(() => {
      if (!cardRef.current) return;

      const updateContainerHeight = () => {
        if (cardRef.current) {
          const cardHeight = cardRef.current.offsetHeight;
          // Debounce height updates to prevent excessive re-renders
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            setContainerHeight(cardHeight);
          }, 100);
        }
      };

      // Initial measurement with a small delay to ensure DOM is ready
      timeoutRef.current = setTimeout(updateContainerHeight, 100);

      // Set up ResizeObserver to watch for container size changes
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserverRef.current = new ResizeObserver(() => {
          updateContainerHeight();
        });
        resizeObserverRef.current.observe(cardRef.current);
      }

      // Fallback: listen for window resize
      window.addEventListener('resize', updateContainerHeight);

      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
        }
        window.removeEventListener('resize', updateContainerHeight);
      };
    }, []);

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

    // Calculate responsive height based on data and container
    const chartHeight = useMemo(() => {
      const minHeight = 250;
      const maxHeight = 600;
      const categoryCount = chartCategories.length;

      if (!containerHeight) {
        // Default calculation when container height not available
        return horizontal
          ? Math.min(Math.max(minHeight, categoryCount * 35), maxHeight)
          : minHeight;
      }

      // Use 70% of container height for chart, leaving space for header/footer
      const availableHeight = Math.max(minHeight, containerHeight * 0.7);
      return Math.min(availableHeight, maxHeight);
    }, [chartCategories.length, horizontal, containerHeight]);

    // ApexCharts configuration for horizontal bar chart
    const chartOptions = useMemo(() => {
      return {
        chart: {
          type: 'bar',
          stacked: true,
          stackType: '100%',
          height: chartHeight,
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
                height: Math.max(200, chartHeight * 0.75), // Smaller height for mobile
              },
            },
          },
        ],
      };
    }, [chartSeries, chartCategories, horizontal, chartHeight]);

    const onGroupFieldSelect = (value) => {
      setGroupField(value);
    };

    const onWeekSelect = (value) => {
      setWeeks(value);
    };

    const itemsPerRow = Math.ceil(legendData.length / 3);

    return (
      <Card
        className="ibutsu-widget-card"
        ref={setCardRef}
        style={{ height: '100%' }}
      >
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
              <>
                <div
                  className="ibutsu-widget-chart-container"
                  style={{ height: chartHeight }}
                >
                  <Chart
                    className="ibutsu-widget-chart"
                    options={chartOptions}
                    series={chartSeries}
                    type="bar"
                    height={chartHeight}
                  />
                </div>
                {legendData.length > 0 && (
                  <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <svg
                      ref={legendContainerRef}
                      style={{
                        overflow: 'visible',
                        width: '100%',
                        height: '60px',
                      }}
                    >
                      {legendData.map((item, index) => {
                        const row = Math.floor(index / itemsPerRow);
                        const col = index % itemsPerRow;
                        const itemWidth = 120;
                        const totalLegendWidth = itemsPerRow * itemWidth;
                        const startX = Math.max(
                          0,
                          (legendContainerWidth - totalLegendWidth) / 2,
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
  },
);

RunAggregateApex.displayName = 'RunAggregateApex';

RunAggregateApex.propTypes = {
  title: PropTypes.string,
  params: PropTypes.object,
  horizontal: PropTypes.bool,
  dropdownItems: PropTypes.array,
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func,
  // React 19 compatibility: ref can be passed as a prop
  ref: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
};

export default RunAggregateApex;
