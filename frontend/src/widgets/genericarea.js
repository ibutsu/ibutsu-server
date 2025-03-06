import React, { useEffect, useState } from 'react';
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
} from '@patternfly/react-charts';
import {
  Card,
  CardBody,
  CardFooter,
  Text,
} from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { toTitleCase } from '../utilities';
import WidgetHeader from '../components/widget-header';


const GenericAreaWidget = (props) => {
  const {
    colorScale,
    fontSize,
    getColors,
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
    widgetEndpoint
  } = props;

  const [data, setData] = useState({});
  const [areaCharts, setAreaCharts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const newAreaCharts = [];
    for (const [index, key] of Object.keys(data).entries()) {
      const chartData = [];
      if (key !== 'filter') {
        for (const groupField of Object.keys(data[key])) {
          chartData.push({name: toTitleCase(key), x: groupField, y: data[key][groupField]});
        }
        if (chartData.length !== 0) {
          newAreaCharts.push(
            <ChartArea
              data={chartData}
              key={index}
              sortKey={(datum) => `${datum.x}`}
              sortOrder={sortOrder || 'ascending'}
              interpolation={interpolation || 'monotoneX'}
              style={getColors ? {data: { fill: getColors(key)}}: {}}
            />
          );
        }
      }
    }
    setAreaCharts(newAreaCharts);
  }, [data, getColors, interpolation, sortOrder]);


  useEffect(() => {
    setIsLoading(true);
    setIsError(false);
    HttpClient.get([Settings.serverUrl, 'widget', (widgetEndpoint || 'jenkins-line-chart')], (params || {}))
      .then(response => HttpClient.handleResponse(response))
      .then(responseData => {
        setData(responseData);
        setIsLoading(false);
      })
      .catch(error => {
        setIsError(true);
        console.log(error);
      });
  }, [params, widgetEndpoint]);

  const getTooltip = () => {
    const CursorVoronoiContainer = createContainer('cursor', 'voronoi');
    if (showTooltip) {
      return (
        <CursorVoronoiContainer
          cursorDimension="x"
          labels={({datum}) => `${toTitleCase(datum.name, true)}: ${datum.y} ${percentData ? ' %' : ''}`}
          labelComponent={<ChartTooltip style={{ fill: 'white', fontSize: fontSize-2 || 14}}/>}
          mouseFollowTooltips
          voronoiDimension="x"
          voronoiPadding={50}
        />
      );
    }
    else {
      return <ChartContainer/>;
    }
  };

  return (
    <Card>
      <WidgetHeader title={title || 'Generic Area Chart'} onEditClick={onEditClick} onDeleteClick={onDeleteClick}/>
      <CardBody data-id="generic-area">
        {isError &&
          <p>Error fetching data</p>
        }
        {(!isError && isLoading) &&
        <Text component="h2">Loading ...</Text>
        }
        {(!isError && !isLoading) &&
        <Chart
          padding={ padding || {
            bottom: 30,
            left: 150,
            right: 15,
            top: 20
          }}
          domainPadding={{y: 10}}
          height={height || 200}
          themeColor={ChartThemeColor.multiUnordered}
          containerComponent={getTooltip()}
        >
          <ChartStack>
            {areaCharts}
          </ChartStack>
          <ChartAxis
            label={xLabel || 'x'}
            fixLabelOverlap
            style={{
              tickLabels: {fontSize: fontSize-2 || 14},
              axisLabel: {fontSize: fontSize || 14}
            }}
          />
          <ChartAxis
            label={yLabel || 'y'}
            dependentAxis
            style={{
              tickLabels: {fontSize: fontSize-2 || 14},
              axisLabel: {fontSize: fontSize || 14}
            }}
          />
        </Chart>
        }
      </CardBody>
      <CardFooter>
        <ChartLegend
          height={30}
          data={Object.keys(data).map((legend) => ({'name': toTitleCase(legend, true)}))}
          style={{
            labels: {fontFamily: 'RedHatText', fontSize: fontSize-2 || 14},
            title: {fontFamily: 'RedHatText'}
          }}
          colorScale={colorScale}
          themeColor={ChartThemeColor.multiUnordered}
        />
        {varExplanation &&
        <Text component="h3">{varExplanation}</Text>
        }
      </CardFooter>
    </Card>
  );
};

GenericAreaWidget.propTypes = {
  colorScale: PropTypes.array,
  dropdownItems: PropTypes.array,
  fontSize: PropTypes.number,
  getColors: PropTypes.func,
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
  onEditClick: PropTypes.func
};

export default GenericAreaWidget;
