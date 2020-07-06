import React from 'react';
import PropTypes from 'prop-types';

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Text
} from '@patternfly/react-core';
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ChartLineIcon
} from '@patternfly/react-icons';
import { Link } from 'react-router-dom';
import HeatMap from 'react-heatmap-grid';

import { Settings } from '../settings';
import { buildUrl } from '../utilities';
import { ParamDropdown, WidgetHeader } from '../components/widget-components';


export class JenkinsHeatmapWidget extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    params: PropTypes.object,
    hideDropdown: PropTypes.bool,
    dropdownItems: PropTypes.array,
    includeAnalysisLink: PropTypes.bool
  }

  constructor(props) {
    super(props);
    this.title = props.title || 'Jenkins Heatmap';
    this.params = props.params || {};
    this.getHeatmap = this.getHeatmap.bind(this);
    this.onBuildSelect = this.onBuildSelect.bind(this);
    this.state = {
      data: {heatmap: {}},
      isLoading: true,
      analysisViewId: null,
    };
  }

  getJenkinsAnalysisViewId() {
    fetch(buildUrl(Settings.serverUrl + '/widget-config', {"filter": "widget=jenkins-analysis-view"}))
      .then(response => response.json())
      .then(data => this.setState({analysisViewId: data.widgets[0].id}))
      .catch(error => console.log(error));
  }

  getJenkinsAnalysisLink() {
    const { analysisViewId } = this.state;
    if (this.props.includeAnalysisLink && analysisViewId !== null) {
      return (
        <Link to={`/view/${analysisViewId}?job_name=${this.params.job_name}`}>
          <Button variant="secondary" title="See analysis" aria-label="See analysis" isInline><ChartLineIcon/></Button>
        </Link>
      );
    }
    else {
      return [];
    }
  }

  getHeatmap() {
    this.setState({isLoading: true})
    this.getJenkinsAnalysisViewId();
    fetch(buildUrl(Settings.serverUrl + '/widget/jenkins-heatmap', this.params))
      .then(response => {
        if (!response.ok) {
          throw Error(response.statusText);
        }
        return response.json();
      })
      .then(data => this.setState({data: data, isLoading: false}))
      .catch(error => {
        this.setState({heatmapError: true});
        console.log(error);
      });
  }

  getCellStyle = (background, value, min, max, data, x) => {
    let style = {paddingTop: '-8.10811px'};
    if ((x === 0) && !!value) {
      if (value[0] < 0) {
        style.background = 'var(--pf-global--danger-color--100)';
      }
      else if ((value[0] <= 1) && (value[0] >= 0)) {
        style.background = 'var(--pf-global--warning-color--100)';
      }
      else if (value[0] > 1) {
        style.background = 'var(--pf-global--success-color--100)';
      }
      else {
        style.background = 'none';
      }
    }
    else if (value) {
      if (value[0] < 50) {
        style.background = 'var(--pf-global--danger-color--100)';
      }
      else if ((value[0] <= 85) && (value[0] >= 50)) {
        style.background = 'var(--pf-global--warning-color--100)';
      }
      else if (value[0] > 85) {
        style.background = 'var(--pf-global--success-color--100)';
      }
      else if (isNaN(value[0])) {
        style.background = 'var(--pf-global--info-color--100)';
      }
    }
    return style;
  }

  renderCell(value) {
    let contents = '';
    if (!!value && (value[1] === 0)) {
      if (value[0] < 0) {
        contents = <ArrowDownIcon />;
      }
      else if ((value[0] <= 1) && (value[0] >= 0)) {
        contents = <ArrowRightIcon />;
      }
      else if (value[0] === 100) {
        contents = <ArrowRightIcon />;
      }
      else if (value[0] > 1) {
        contents = <ArrowUpIcon />;
      }
    }
    else if (!!value && isNaN(value[0])) {
      contents = "n/a"
    }
    else if (value) {
      contents = <Link to={`/runs/${value[1]}`}>{Math.floor(value[0])}</Link>;
    }
    return <div style={{marginTop: '-4px'}}>{contents}</div>;
  }

  componentDidMount() {
    this.getHeatmap();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.params !== this.props.params) {
      this.params = this.props.params;
      this.getHeatmap();
    }
  }

  onBuildSelect = (value) => {
    this.props.params.builds = value;
    this.getHeatmap();
  }

  render() {
    const xLabels = [<ChartLineIcon key={0} />];
    const yLabels = [];
    const data = [];
    let labels = [];
    for (const key of Object.keys(this.state.data.heatmap)) {
      const newLabels = [];
      const values = this.state.data.heatmap[key];
      yLabels.push(key);
      data.push(values);
      values.forEach((item) => {
        if (!!item && (item.length > 2) && !!item[2]) {
          newLabels.push(<Link to={`/results?metadata.jenkins.build_number[eq]=${item[2]}&metadata.jenkins.job_name[eq]=` + this.params['job_name']} key={item[2]}>{item[2]}</Link>);
        }
      });
      if (newLabels.length > labels.length) {
        labels = newLabels;
      }
    }
    labels.forEach((item) => xLabels.push(item));
    const actions = this.getJenkinsAnalysisLink() || {};
    return (
      <Card>
        <WidgetHeader title={this.title} actions={actions} getDataFunc={this.getHeatmap}/>
        <CardBody data-id="heatmap" style={{paddingTop: '0.5rem'}}>
          {(!this.state.heatmapError && this.state.isLoading) &&
          <Text component="h2">Loading ...</Text>
          }
          {(!this.state.heatmapError && !this.state.isLoading) &&
          <HeatMap
            xLabels={xLabels}
            yLabels={yLabels}
            yLabelWidth={200}
            yLabelTextAlign={"left"}
            data={data}
            squares
            cellStyle={this.getCellStyle}
            cellRender={this.renderCell}
            title={(value) => value ? `${value[0]}` : ''}
          />
          }
          {this.state.heatmapError &&
          <p>Error fetching data</p>
          }
        </CardBody>
        {!this.props.hideDropdown &&
        <CardFooter>
          <ParamDropdown
            dropdownItems={this.props.dropdownItems || [3, 5, 6, 7]}
            handleSelect={this.onBuildSelect}
            defaultValue={this.params.builds}
            tooltip={"Set no. of builds to:"}
          />
        </CardFooter>
        }
      </Card>
    );
  }
}
