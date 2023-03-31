import React from 'react';
import PropTypes from 'prop-types';

import {
  ChartDonut,
  ChartLegend
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
import { WidgetHeader } from '../components/widget-components';

export class ResultSummaryWidget extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    params: PropTypes.object,
    onDeleteClick: PropTypes.func,
    onEditClick: PropTypes.func
  }

  constructor(props) {
    super(props);
    this.title = props.title || 'Result Summary';
    this.params = props.params || {};
    this.state = {
      summary: {
        passed: 0,
        failed: 0,
        error: 0,
        skipped: 0,
        xfailed: 0,
        xpassed: 0,
        other: 0,
        total: 0
      },
      dataError: null,
      isLoading: true,
    };
  }


  getResultSummary = () => {
    this.setState({isLoading: true});
    HttpClient.get([Settings.serverUrl, 'widget', 'result-summary'], this.params)
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        if (!response.ok) {
          throw Error(response.statusText);
        }
        this.setState({isLoading: false});
        return response.json();
      })
      .then(data => this.setState({summary: data}))
      .catch(error => {
        this.setState({dataError: true});
        console.log(error);
      });
  }

  componentDidMount() {
    this.getResultSummary();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.params !== this.props.params) {
      this.params = this.props.params;
      this.getResultSummary();
    }
  }

  render() {
    const themeColors = [
      'var(--pf-global--success-color--100)',
      'var(--pf-global--danger-color--100)',
      'var(--pf-global--info-color--100)',
      'var(--pf-global--warning-color--100)',
      'var(--pf-global--palette--purple-400)',
      'var(--pf-global--palette--purple-700)',
      'var(--pf-global--primary-color--100)'
    ];
    return (
      <Card>
        <WidgetHeader title={this.title} getDataFunc={this.getResultSummary} onEditClick={this.props.onEditClick} onDeleteClick={this.props.onDeleteClick}/>
        <CardBody>
          <div>
            {!this.state.isLoading &&
            <ChartDonut
              constrainToVisibleArea={true}
              data={[
                { x: 'Passed', y: this.state.summary.passed },
                { x: 'Failed', y: this.state.summary.failed },
                { x: 'Skipped', y: this.state.summary.skipped },
                { x: 'Error', y: this.state.summary.error },
                { x: 'Xfailed', y: this.state.summary.xfailed },
                { x: 'Xpassed', y: this.state.summary.xpassed }
              ]}
              labels={({datum}) => `${toTitleCase(datum.x)}: ${datum.y}`}
              height={200}
              title={this.state.summary.total}
              subTitle="total results"
              style={{
                labels: {fontFamily: 'RedHatText'}
              }}
              colorScale={themeColors}
            />
            }
            {this.state.isLoading &&
            <Text component="h2">Loading ...</Text>
            }
          </div>
          {!this.state.isLoading &&
          <p className="pf-u-pt-sm">Total number of tests: {this.state.summary.total}</p>
          }
        </CardBody>
        <CardFooter>
          {!this.state.isLoading &&
          <ChartLegend
            data={[
                {name: 'Passed (' + this.state.summary.passed + ')'},
                {name: 'Failed (' + this.state.summary.failed + ')'},
                {name: 'Skipped (' + this.state.summary.skipped + ')'},
                {name: 'Error (' + this.state.summary.error + ')'},
                {name: 'Xfailed (' + this.state.summary.xfailed + ')'},
                {name: 'Xpassed (' + this.state.summary.xpassed + ')'}
              ]}
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
        </CardFooter>
      </Card>
    );
  }
}
