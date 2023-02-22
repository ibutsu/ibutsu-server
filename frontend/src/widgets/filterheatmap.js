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

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { ParamDropdown, WidgetHeader } from '../components/widget-components';


export class FilterHeatmapWidget extends React.Component {
  static propTypes = {
    title: PropTypes.string,
    params: PropTypes.object,
    labelWidth: PropTypes.number,
    hideDropdown: PropTypes.bool,
    dropdownItems: PropTypes.array,
    includeAnalysisLink: PropTypes.bool,
    onDeleteClick: PropTypes.func,
    onEditClick: PropTypes.func,
    type: PropTypes.string
  }

  constructor(props) {
    super(props);
    this.title = props.title || 'Filter Heatmap';
    this.params = props.params || {};
    this.labelWidth = props.labelWidth || 200;
    this.getHeatmap = this.getHeatmap.bind(this);
    this.onBuildSelect = this.onBuildSelect.bind(this);
    this.type = props.type || 'filter';
    this.state = {
      data: {heatmap: {}},
      isLoading: true,
      analysisViewId: null,
      countSkips: 'No',
    };
  }

  getJenkinsAnalysisViewId() {
    HttpClient.get([Settings.serverUrl, 'widget-config'], {"filter": "widget=jenkins-analysis-view"})
      .then(response => HttpClient.handleResponse(response))
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
    if (this.type === 'jenkins') {
      this.getJenkinsAnalysisViewId();
      HttpClient.get([Settings.serverUrl, 'widget', 'jenkins-heatmap'], this.params)
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
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
    } else {
      HttpClient.get([Settings.serverUrl, 'widget', 'filter-heatmap'], this.params)
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
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
      // handle annotations, add a border for cells with annotations
      if (value[2]) {
        style.borderRight = 'solid 5px #01FFFF';
      }
    }
    return style;
  }

  renderCell(value) {
    let contents = '';
    let style = {marginTop: '-4px'};
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
      if (value[2]) {
        let title = '';
        value[2].forEach((item) => {
          if (!!item.name && !!item.value) {
            title += item.name + ": " + item.value + "\n";
          }
        });
        contents = <p title={title}><Link to={`/runs/${value[1]}`}>{Math.floor(value[0])}</Link></p>;
      }
      else {
        contents = <Link to={`/runs/${value[1]}`}>{Math.floor(value[0])}</Link>;
      }
    }
    return <div style={style}>{contents}</div>;
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

  onSkipSelect = (value) => {
    this.setState({countSkips: value}, () => {
      if (this.props.type === 'jenkins') {
        this.props.params.count_skips = (value === 'Yes');
      }
      this.getHeatmap();
    });
  }

  render() {
    const xLabels = [<ChartLineIcon key={0} />];
    const yLabels = [];
    const data = [];
    let labels = [];
    for (const key of Object.keys(this.state.data.heatmap)) {
      const newLabels = [];
      const values = this.state.data.heatmap[key];
      yLabels.push(<div key={key} title={key} className="ellipsis">{key}</div>);
      data.push(values);
      values.forEach((item) => {
        if (!!item && (item.length > 2) && !!item[3]) {
          newLabels.push(<Link to={`/results?metadata.jenkins.build_number[eq]=${item[3]}&metadata.jenkins.job_name[eq]=` + this.params['job_name']} key={item[3]}>{item[3]}</Link>);
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
        <WidgetHeader title={this.title} actions={actions} getDataFunc={this.getHeatmap} onEditClick={this.props.onEditClick} onDeleteClick={this.props.onDeleteClick}/>
        <CardBody data-id="heatmap" style={{paddingTop: '0.5rem'}}>
          {(!this.state.heatmapError && this.state.isLoading) &&
          <Text component="h2">Loading ...</Text>
          }
          {(!this.state.heatmapError && !this.state.isLoading) &&
          <HeatMap
            xLabels={xLabels}
            yLabels={yLabels}
            yLabelWidth={this.labelWidth}
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
          {this.props.type === 'jenkins' &&
          <ParamDropdown
            dropdownItems={['Yes', 'No']}
            handleSelect={this.onSkipSelect}
            defaultValue={this.state.countSkips}
            tooltip="Count skips as failure:"
          />
          }
        </CardFooter>
        }
      </Card>
    );
  }
}
