import React from 'react';
import PropTypes from 'prop-types';

import {
  Chart,
  ChartAxis,
  ChartBar,
  ChartLegend,
  ChartStack,
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

export class GenericBarWidget extends React.Component {
  static propTypes = {
    barWidth: PropTypes.number,
    dropdownItems: PropTypes.array,
    fontSize: PropTypes.number,
    height: PropTypes.number,
    hideDropdown: PropTypes.bool,
    horizontal: PropTypes.bool,
    padding: PropTypes.object,
    params: PropTypes.object,
    percentData: PropTypes.bool,
    sortOrder: PropTypes.string,
    title: PropTypes.string,
    widgetEndpoint: PropTypes.string,
    xLabel: PropTypes.string,
    xLabelTooltip: PropTypes.string,
    yLabel: PropTypes.string,
    onDeleteClick: PropTypes.func,
    onEditClick: PropTypes.func
  };

  constructor (props) {
    super(props);
    this.title = props.title || 'Recent Run Results';
    this.params = props.params || {};
    this.getData = this.getData.bind(this);
    this.onGroupFieldSelect = this.onGroupFieldSelect.bind(this);
    this.onWeekSelect = this.onWeekSelect.bind(this);
    this.state = {
      data: {},
      barCharts: [],
      isLoading: true,
      genericBarError: false,
    };
  }

  onGroupFieldSelect = (value) => {
    this.props.params.group_field = value;
    this.getData();
  };

  onWeekSelect = (value) => {
    this.props.params.weeks = value;
    this.getData();
  };

  getData () {
    this.setState({isLoading: true});
    let widgetEndpoint = this.props.widgetEndpoint || 'run-aggregator';
    HttpClient.get([Settings.serverUrl, 'widget', widgetEndpoint], this.params)
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        if (!response.ok) {
          throw Error(response.statusText);
        }
        return response.json();
      })
      .then(data => this.setState({data: data, isLoading: false}, () => {
        this.getBarCharts();
      }))
      .catch(error => {
        this.setState({genericBarError: true});
        console.log(error);
      });
  }

  getBarStyle = (key) => {
    let color = 'var(--pf-v5-global--success-color--100)';
    if (key === 'failed') {
      color = 'var(--pf-v5-global--danger-color--100)';
    }
    else if (key === 'skipped') {
      color = 'var(--pf-v5-global--info-color--100)';
    }
    else if (key === 'error') {
      color = 'var(--pf-v5-global--warning-color--100)';
    }
    else if (key === 'xfailed') {
      color = 'var(--pf-v5-global--palette--purple-400)';
    }
    else if (key === 'xpassed') {
      color = 'var(--pf-v5-global--palette--purple-700)';
    }
    return color;
  };

  getLabels () {
    if (this.props.percentData) {
      return ({datum}) => `${toTitleCase(datum.name)}: ${datum.y} %`;
    }
    else {
      if (this.props.xLabelTooltip) {
        return ({datum}) => `${this.props.xLabelTooltip}: ${datum.x} \n ${toTitleCase(datum.name)}: ${datum.y}`;
      }
      else {
        return ({datum}) => `${toTitleCase(datum.name)}: ${datum.y}`;

      }
    }
  }

  getBarCharts () {
    let barCharts = [];
    for (const test_state of Object.keys(this.state.data)) {
      if (test_state !== 'filter') {
        let barData = [];
        for (const group_field of Object.keys(this.state.data[test_state])) {
          barData.push({name: toTitleCase(test_state), x: group_field, y: this.state.data[test_state][group_field]});
        }
        if (barData.length !== 0) {
          barCharts.push(
            <ChartBar
              key={test_state}
              style={{data: {fill: this.getBarStyle(test_state)}}}
              barWidth={this.props.barWidth || 20}
              data={barData}
              sortKey={(datum) => `${datum.x}`}
              sortOrder={this.props.sortOrder || 'descending'}
              horizontal={this.props.horizontal}
              labels={this.getLabels()}
              labelComponent={
                <ChartTooltip
                  dx={this.props.horizontal ? -10 : 0}
                  dy={this.props.horizontal ? 0 : -10}
                  style={{ fill: 'white', fontSize: this.props.fontSize-2 || 14}}
                />
              }
            />
          );
        }
      }
    }
    this.setState({barCharts});
  }

  getChartHeight = (numBars) => {
    if (numBars > 10) {
      return numBars*30;
    }
    else {
      return 300;
    }
  };

  componentDidMount () {
    this.getData();
  }

  componentDidUpdate (prevProps) {
    if (prevProps.params !== this.props.params) {
      this.params = this.props.params;
      this.getData();
    }
  }

  getDropdowns () {
    if (this.props.hideDropdown) {
      return null;
    }
    else {
      return (
        <div>
          <ParamDropdown
            dropdownItems={this.props.dropdownItems || ['component', 'env', 'metadata.jenkins.job_name']}
            defaultValue={this.params.group_field}
            handleSelect={this.onGroupFieldSelect}
            tooltip="Group data by:"
          />
          <ParamDropdown
            dropdownItems={[1, 2, 3, 4, 5, 6]}
            handleSelect={this.onWeekSelect}
            defaultValue={this.params.weeks}
            tooltip="Set weeks to:"
          />
        </div>
      );
    }
  }

  render () {
    return (
      <Card>
        <WidgetHeader title={this.title} getDataFunc={this.getData} onEditClick={this.props.onEditClick} onDeleteClick={this.props.onDeleteClick}/>
        <CardBody data-id="recent-runs">
          {this.state.genericBarError &&
            <p>Error fetching data</p>
          }
          {(!this.state.genericBarError && this.state.isLoading) &&
          <Text component="h2">Loading ...</Text>
          }
          {(!this.state.genericBarError && !this.state.isLoading) &&
          <Chart
            domainPadding={ this.props.horizontal ? { x: 20 } : { y: 20} }
            padding={ this.props.padding || {
              bottom: 30,
              left: 150,
              right: 15,
              top: 20
            }}
            height={this.props.height || this.getChartHeight(Object.keys(this.state.data['passed']).length)}
          >
            <ChartAxis
              label={this.props.xLabel || ''}
              fixLabelOverlap={!this.props.horizontal}
              style={{
                tickLabels: {fontSize: this.props.fontSize-2 || 14},
                axisLabel: {fontSize: this.props.fontSize || 14}
              }}
            />
            <ChartAxis
              label={this.props.yLabel || ''}
              dependentAxis
              style={{
                tickLabels: {fontSize: this.props.fontSize-2 || 14},
                axisLabel: {fontSize: this.props.fontSize || 14}
              }}
            />
            <ChartStack>
              {this.state.barCharts}
            </ChartStack>
          </Chart>
          }
        </CardBody>
        <CardFooter>
          <ChartLegend
            height={30}
            data={[
              {name: 'Passed'},
              {name: 'Failed'},
              {name: 'Skipped'},
              {name: 'Error'},
              {name: 'Xfailed'},
              {name: 'Xpassed'}
            ]}
            colorScale={[
              'var(--pf-v5-global--success-color--100)',
              'var(--pf-v5-global--danger-color--100)',
              'var(--pf-v5-global--info-color--100)',
              'var(--pf-v5-global--warning-color--100)',
              'var(--pf-v5-global--palette--purple-400)',
              'var(--pf-v5-global--palette--purple-700)',
            ]}
            style={{
              labels: {fontFamily: 'RedHatText', fontSize: this.props.fontSize-2 || 14},
              title: {fontFamily: 'RedHatText'}
            }}
          />
          {this.getDropdowns()}
        </CardFooter>
      </Card>
    );
  }
}
