import React from 'react';
import PropTypes from 'prop-types';

import {
  Chart,
  ChartAxis,
  ChartArea,
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

import { Settings } from '../settings';
import { buildUrl, toTitleCase } from '../utilities';
import { WidgetHeader } from '../components/widget-components';


export class GenericAreaWidget extends React.Component {
  static propTypes = {
    dropdownItems: PropTypes.array,
    fontSize: PropTypes.number,
    height: PropTypes.number,
    hideDropdown: PropTypes.bool,
    interpolation: PropTypes.string,
    padding: PropTypes.object,
    params: PropTypes.object,
    percentData: PropTypes.bool,
    sortOrder: PropTypes.string,
    title: PropTypes.string,
    varExplanation: PropTypes.string,
    widgetEndpoint: PropTypes.string,
    xLabel: PropTypes.string,
    yLabel: PropTypes.string,
  }

  constructor(props) {
    super(props);
    this.title = props.title || 'Generic Area Chart';
    this.params = props.params || {};
    this.getData = this.getData.bind(this);
    this.state = {
      data: {},
      areaCharts: [],
      isLoading: true,
    };
  }

  getLabels() {
    if (this.props.percentData) {
      return ({datum}) => `${toTitleCase(datum.name, true)}: ${datum.y} %`;
    }
    else {
      return ({datum}) => `${toTitleCase(datum.name, true)}: ${datum.y}`;
    }
  }

  getData() {
    this.setState({isLoading: true});
    let widgetEndpoint = this.props.widgetEndpoint || 'jenkins-line-chart';
    fetch(buildUrl(Settings.serverUrl + '/widget/' + widgetEndpoint, this.params))
      .then(response => {
        if (!response.ok) {
          throw Error(response.statusText);
        }
        return response.json();
      })
      .then(data => this.setState({data: data, isLoading: false}, () => {
        this.getAreaCharts();
      }))
      .catch(error => {
        this.setState({areaChartError: true});
        console.log(error);
      });
  }

  getLegendData() {
    let legendData = [];
    for (const legend of Object.keys(this.state.data)) {
      legendData.push({name: toTitleCase(legend, true)});
    }
    return legendData;
  }

  getAreaCharts() {
    let areaCharts = [];
    for (const timeField of Object.keys(this.state.data)) {
      let timeData = [];
      for (const groupField of Object.keys(this.state.data[timeField])) {
        timeData.push({name: toTitleCase(timeField), x: groupField, y: this.state.data[timeField][groupField]})
      }
      if (timeData.length !== 0) {
        areaCharts.push(
          <ChartArea
            data={timeData}
            sortKey={(datum) => `${datum.x}`}
            sortOrder={this.props.sortOrder || "ascending"}
            interpolation={this.props.interpolation || "monotoneX"}
          />
        );
      }
    }
    this.setState({areaCharts});
  }

  componentDidMount() {
    this.getData();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.params !== this.props.params) {
      this.params = this.props.params;
      this.getData();
    }
  }

  render() {
    const CursorVoronoiContainer = createContainer("cursor", "voronoi");
    const legendData = this.getLegendData();
    return (
      <Card>
        <WidgetHeader title={this.title} getDataFunc={this.getData}/>
        <CardBody data-id="generic-area">
          {this.state.areaChartError &&
            <p>Error fetching data</p>
          }
          {(!this.state.runAggregatorError && this.state.isLoading) &&
          <Text component="h2">Loading ...</Text>
          }
          {(!this.state.runAggregatorError && !this.state.isLoading) &&
          <Chart
            padding={ this.props.padding || {
              bottom: 30,
              left: 150,
              right: 15,
              top: 20
            }}
            height={this.props.height || 200}
            themeColor={ChartThemeColor.multiUnordered}
            containerComponent={
              <CursorVoronoiContainer
                cursorDimension="x"
                labels={this.getLabels()}
                labelComponent={<ChartTooltip style={{ fill: "white", fontSize: this.props.fontSize-2 || 14}}/>}
                mouseFollowTooltips
                voronoiDimension="x"
                voronoiPadding={50}
              />
            }
          >
            <ChartStack>
              {this.state.areaCharts}
            </ChartStack>
            <ChartAxis
              label={this.props.xLabel || "x"}
              fixLabelOverlap
              style={{
                tickLabels: {fontSize: this.props.fontSize-2 || 14},
                axisLabel: {fontSize: this.props.fontSize || 14}
              }}
            />
            <ChartAxis
              label={this.props.yLabel || "y"}
              dependentAxis
              style={{
                tickLabels: {fontSize: this.props.fontSize-2 || 14},
                axisLabel: {fontSize: this.props.fontSize || 14}
              }}
            />
          </Chart>
          }
        </CardBody>
        <CardFooter>
          <ChartLegend
            height={30}
            data={legendData}
            style={{
              labels: {fontFamily: 'RedHatText', fontSize: this.props.fontSize-2 || 14},
              title: {fontFamily: 'RedHatText'}
            }}
            themeColor={ChartThemeColor.multiUnordered}
          />
          {this.props.varExplanation &&
          <Text component="h3">{this.props.varExplanation}</Text>
          }
       </CardFooter>
      </Card>
    )
  }
}
