import React from 'react';
import PropTypes from 'prop-types';

import {
  PageSection,
  PageSectionVariants,
  Text,
  TextContent
} from '@patternfly/react-core';

import { HttpClient } from '../services/http';
import { Settings } from '../settings';
import { JenkinsJobView, JenkinsJobAnalysisView } from '../views';

const VIEW_MAP = {
  'jenkins-job-view': JenkinsJobView,
  'jenkins-analysis-view': JenkinsJobAnalysisView
};

export class View extends React.Component {
  static propTypes = {
    location: PropTypes.object,
    history: PropTypes.object,
    match: PropTypes.object
  };

  constructor(props) {
    super(props);
    this.state = {
      id: props.match.params.id,
      view: null,
    };
  }

  getView() {
    HttpClient.get([Settings.serverUrl, 'widget-config', this.state.id])
      .then(response => HttpClient.handleResponse(response))
      .then(data => this.setState({view: data}));
  }

  componentDidUpdate(prevProps){
    if (prevProps !== this.props) {
      this.setState({id: this.props.match.params.id}, this.getView);
    }
  }

  componentDidMount() {
    this.getView();
  }

  render() {
    const { view } = this.state;
    const { location, history } = this.props;
    document.title = view ? view.title + ' | Ibutsu' : document.title;
    const ViewComponent = view ? VIEW_MAP[view.widget] : 'div';
    return (
      <React.Fragment>
        <PageSection id="page" variant={PageSectionVariants.light}>
          <TextContent>
            <Text className="title" component="h1">{(view && view.title) || 'Loading...'}</Text>
          </TextContent>
        </PageSection>
        <PageSection className="pf-u-pb-0">
          <ViewComponent view={view} location={location} history={history}/>
        </PageSection>
      </React.Fragment>
    );
  }
}
