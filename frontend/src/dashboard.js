import React from 'react';
import PropTypes from 'prop-types';

import {
  Grid,
  GridItem,
  PageSection,
  PageSectionVariants,
  TextContent,
  Text
} from '@patternfly/react-core';

import { KNOWN_WIDGETS } from './constants';
import { Settings } from './settings';
import {
  GenericBarWidget,
  JenkinsHeatmapWidget,
  ResultAggregatorWidget,
  ResultSummaryWidget
} from './widgets';
import { buildUrl, getActiveProject } from './utilities.js';


export class Dashboard extends React.Component {
  static propTypes = {
    eventEmitter: PropTypes.object
  }

  constructor(props) {
    super(props);
    this.state = {
      widgets: []
    };
    props.eventEmitter.on('projectChange', () => {
      this.getWidgets();
    });
  }

  getWidgets() {
    let params = {"type": "widget"};
    let project = getActiveProject();
    if (project) {
      params['filter'] = 'project_id=' + project.id;
    }
    fetch(buildUrl(Settings.serverUrl + '/widget-config', params))
      .then(response => response.json())
      .then(data => {
        // set the widget project param
        data.widgets.forEach(widget => {
          if (project) {
            widget.params['project'] = project.id;
          }
          else {
            delete widget.params['project'];
          }
        });
        this.setState({widgets: data.widgets});
      });
  }

  componentDidMount() {
    this.getWidgets();
  }

  render() {
    document.title = 'Dashboard | Ibutsu';
    const { widgets } = this.state;
    return (
      <React.Fragment>
        <PageSection variant={PageSectionVariants.light}>
          <TextContent>
            <Text component="h1">Dashboard</Text>
          </TextContent>
        </PageSection>
        <PageSection>
          {!!widgets &&
          <Grid hasGutter>
            {widgets.map(widget => {
              if (KNOWN_WIDGETS.includes(widget.widget)) {
                return (
                  <GridItem xl={4} lg={6} md={12} key={widget.id}>
                    {(widget.type === "widget" && widget.widget === "jenkins-heatmap") &&
                      <JenkinsHeatmapWidget title={widget.title} params={widget.params} includeAnalysisLink={true}/>
                    }
                    {(widget.type === "widget" && widget.widget === "run-aggregator") &&
                      <GenericBarWidget title={widget.title} params={widget.params} horizontal={true} percentData={true} barWidth={20}/>
                    }
                    {(widget.type === "widget" && widget.widget === "result-summary") &&
                      <ResultSummaryWidget title={widget.title} params={widget.params}/>
                    }
                    {(widget.type === "widget" && widget.widget === "result-aggregator") &&
                      <ResultAggregatorWidget title={widget.title} params={widget.params}/>
                    }
                  </GridItem>
                );
              }
              else {
                return '';
              }
            })}
          </Grid>
          }
        </PageSection>
      </React.Fragment>
    );
  }
}
