import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import {
  Chart,
  ChartAxis,
  ChartArea,
  ChartContainer,
  ChartLegend,
  ChartStack,
  ChartThemeColor,
  ChartTooltip,
  createContainer,
} from '@patternfly/react-charts/victory';
import { Card, CardBody, CardFooter, Content } from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { toTitleCase } from '../utilities';
import WidgetHeader from '../components/widget-header';
import { CHART_COLOR_MAP } from '../constants';

const GenericAreaWidget = ({
  fontSize,
  height,
  interpolation,
  padding,
  params,
  percentData,
  showTooltip,
  sortOrder,
  title,
  varExplanation,
  xLabel,
  yLabel,
  onDeleteClick,
  onEditClick,
  widgetEndpoint,
}) => {
  const [data, setData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const legendData = useMemo(() => {
    return Object.keys(data).map((key) => ({
      name: toTitleCase(key, true),
      symbol: {
        fill: CHART_COLOR_MAP[key] || ChartThemeColor.default,
      },
    }));
  }, [data]);

  const areaCharts = useMemo(() => {
    const newAreaCharts = [];
    for (const key of Object.keys(data || {})) {
      const chartData = [];
      if (key !== 'filter') {
        for (const groupField of Object.keys(data[key])) {
          chartData.push({
            name: toTitleCase(key),
            x: groupField,
            y: data[key][groupField],
          });
        }
        if (chartData.length !== 0) {
          newAreaCharts.push(
            <ChartArea
              data={chartData}
              style={{
                data: {
                  fill: CHART_COLOR_MAP[key] || ChartThemeColor.default,
                },
              }}
              legendData={legendData}
              key={key}
              sortKey={(datum) => `${datum.x}`}
              sortOrder={sortOrder || 'ascending'}
              interpolation={interpolation || 'monotoneX'}
            />,
          );
        }
      }
    }
    return newAreaCharts;
  }, [data, interpolation, legendData, sortOrder]);

  useEffect(() => {
    const fetchLine = async () => {
      try {
        setIsLoading(true);
        setIsError(false);
        const response = await HttpClient.get(
          [
            Settings.serverUrl,
            'widget',
            widgetEndpoint || 'jenkins-line-chart',
          ],
          params || {},
        );
        const responseData = await HttpClient.handleResponse(response);

        setData(responseData);
        setIsLoading(false);
      } catch (error) {
        setIsError(true);
        console.error(error);
      }
    };

    if (Object.keys(params || {}).length) {
      const debouncer = setTimeout(() => {
        fetchLine();
      }, 50);
      return () => clearTimeout(debouncer);
    }
  }, [params, widgetEndpoint]);

  const toolTip = useMemo(() => {
    const CursorVoronoiContainer = createContainer('cursor', 'voronoi');
    if (showTooltip) {
      return (
        <CursorVoronoiContainer
          cursorDimension="x"
          labels={({ datum }) =>
            `${toTitleCase(datum.name, true)}: ${datum.y} ${percentData ? ' %' : ''}`
          }
          labelComponent={
            <ChartTooltip
              style={{ fill: 'white', fontSize: fontSize - 2 || 14 }}
            />
          }
          mouseFollowTooltips
          voronoiDimension="x"
          voronoiPadding={50}
        />
      );
    } else {
      return <ChartContainer />;
    }
  }, [fontSize, percentData, showTooltip]);

  return (
    <Card>
      <WidgetHeader
        title={title || 'Generic Area Chart'}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
      />
      <CardBody data-id="generic-area">
        {isError && <p>Error fetching data</p>}
        {!isError && isLoading && <Content component="h2">Loading ...</Content>}
        {!isError && !isLoading && (
          <Chart
            padding={
              padding || {
                bottom: 30,
                left: 150,
                right: 15,
                top: 20,
              }
            }
            domainPadding={{ y: 10 }}
            height={height || 200}
            containerComponent={toolTip}
          >
            <ChartStack>{areaCharts}</ChartStack>
            <ChartAxis
              label={xLabel || 'x'}
              fixLabelOverlap
              style={{
                tickLabels: { fontSize: fontSize - 2 || 14 },
                axisLabel: { fontSize: fontSize || 14 },
              }}
            />
            <ChartAxis
              label={yLabel || 'y'}
              dependentAxis
              style={{
                tickLabels: { fontSize: fontSize - 2 || 14 },
                axisLabel: { fontSize: fontSize || 14 },
              }}
            />
          </Chart>
        )}
      </CardBody>
      <CardFooter>
        <ChartLegend
          height={30}
          data={legendData}
          style={{
            labels: { fontFamily: 'RedHatText', fontSize: fontSize - 2 || 14 },
            title: { fontFamily: 'RedHatText' },
          }}
        />
        {varExplanation && <Content component="h3">{varExplanation}</Content>}
      </CardFooter>
    </Card>
  );
};

GenericAreaWidget.propTypes = {
  dropdownItems: PropTypes.array,
  fontSize: PropTypes.number,
  height: PropTypes.number,
  hideDropdown: PropTypes.bool,
  interpolation: PropTypes.string,
  padding: PropTypes.object,
  params: PropTypes.object,
  percentData: PropTypes.bool,
  showTooltip: PropTypes.bool,
  sortOrder: PropTypes.string,
  title: PropTypes.string,
  varExplanation: PropTypes.string,
  widgetEndpoint: PropTypes.string,
  xLabel: PropTypes.string,
  yLabel: PropTypes.string,
  onDeleteClick: PropTypes.func,
  onEditClick: PropTypes.func,
};

export default GenericAreaWidget;
