import React from 'react';
import PropTypes from 'prop-types';

import {
  ChartDonut,
  ChartLegend,
  ChartPie,
  ChartThemeColor,
  ChartTooltip,
} from '@patternfly/react-charts';
import {
  Card,
  CardBody,
  CardFooter,
  Text
} from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { toTitleCase } from '../utilities';
import { ParamDropdown, WidgetHeader } from '../components/widget-components';


export class ResultAggregatorWidget extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    params: PropTypes.object,
    dropdownItems: PropTypes.array,
    onDeleteClick: PropTypes.func,
    onEditClick: PropTypes.func
  };

  constructor (props) {
    super(props);
    this.title = props.title || 'Result Categories';
    this.params = props.params || {};
    this.getResultData = this.getResultData.bind(this);
    this.onDaySelect = this.onDaySelect.bind(this);
    this.onGroupFieldSelect = this.onGroupFieldSelect.bind(this);
    this.state = {
      data: {},
      chartData: [],
      legendData: [],
      isLoading: true,
      total: 0,
    };
  }

  getResultData () {
    this.setState({isLoading: true});
    HttpClient.get([Settings.serverUrl, 'widget', 'result-aggregator'], this.params)
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        if (!response.ok) {
          throw Error(response.statusText);
        }
        return response.json();
      })
      .then(data => this.setState({data: data, isLoading: false}, () => {
        this.getChartData();
      }))
      .catch(error => {
        this.setState({resultAggregatorError: true});
        console.log(error);
      });
  }

  getChartData () {
    let chartData = [];
    let legendData = [];
    let total = 0;
    this.state.data.forEach( ( datum ) =>  {
      chartData.push({x: datum._id, y: datum.count});
      legendData.push({name: toTitleCase(datum._id) + ': ' + datum.count});
      total = total + datum.count;
    });
    this.setState({
      chartData,
      legendData,
      total
    });
  }

  componentDidMount () {
    this.getResultData();
  }

  componentDidUpdate (prevProps) {
    if (prevProps.params !== this.props.params) {
      this.params = this.props.params;
      this.getResultData();
    }
  }

  onGroupFieldSelect = (value) => {
    this.props.params.group_field = value;
    this.getResultData();
  };

  onDaySelect = (value) => {
    this.props.params.days = value;
    this.getResultData();
  };

  render () {
    const themeColors = [
      'var(--pf-v5-global--success-color--100)',
      'var(--pf-v5-global--danger-color--100)',
      'var(--pf-v5-global--warning-color--100)',
      'var(--pf-v5-global--info-color--100)',
      'var(--pf-v5-global--primary-color--100)'
    ];
    return (
      <Card>
        <WidgetHeader title={this.title} getDataFunc={this.getResultData} onEditClick={this.props.onEditClick} onDeleteClick={this.props.onDeleteClick}/>
        <CardBody data-id="recent-result-data">
          {this.state.resultAggregatorError &&
            <p>Error fetching data</p>
          }
          {(this.state.total === 0 && !this.state.isLoading) &&
            <p>No data returned, try changing the days.</p>
          }
          {(!this.state.resultAggregatorError && this.state.isLoading) &&
          <Text component="h2">Loading ...</Text>
          }
          {(!this.state.resultAggregatorError && !this.state.isLoading && this.params.chart_type === 'pie' && this.state.total !== 0) &&
            <ChartPie
              constrainToVisibleArea={true}
              data={this.state.chartData}
              legendData={this.state.legendData}
              labels={({datum}) => `${toTitleCase(datum.x)}: ${datum.y}`}
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
                top: 20
              }}
              themeColor={ChartThemeColor.multi}
            />
          }
          {(!this.state.resultAggregatorError && !this.state.isLoading && this.params.chart_type === 'donut' && this.state.total !== 0) &&
            <ChartDonut
              constrainToVisibleArea
              data={this.state.chartData}
              legendData={this.state.legendData}
              labels={({datum}) => `${toTitleCase(datum.x || '')}: ${datum.y}`}
              height={200}
              title={this.state.total}
              subTitle="total results"
              style={{
                labels: {fontFamily: 'RedHatText'}
              }}
              colorScale={themeColors}
            />
          }
        </CardBody>
        <CardFooter>
          {!this.state.isLoading && this.state.total !== 0 &&
          <ChartLegend
            data={this.state.legendData}
            height={120}
            orientation="horizontal"
            responsive={false}
            itemsPerRow={2}
            colorScale={themeColors}
            style={{
              labels: {fontFamily: 'RedHatText'},
              title: {fontFamily: 'RedHatText'}
            }}
          />
          }
          <ParamDropdown
            dropdownItems={this.props.dropdownItems || ['result', 'metadata.exception_name', 'component', 'metadata.classification']}
            defaultValue={this.params.group_field}
            handleSelect={this.onGroupFieldSelect}
            tooltip="Group data by:"
          />
          <ParamDropdown
            dropdownItems={[0.1, 0.5, 1, 3, 5]}
            handleSelect={this.onDaySelect}
            defaultValue={this.params.days}
            tooltip="Set days to:"
          />
        </CardFooter>
      </Card>
    );
  }
}
