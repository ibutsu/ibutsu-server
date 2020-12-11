import React from 'react';
import PropTypes from 'prop-types';

import {
  PageSection,
  PageSectionVariants,
  TextContent,
  Text
} from '@patternfly/react-core';

import { Settings } from './settings';
import { ResultView } from './components';


export class Result extends React.Component {
  static propTypes = {
    match: PropTypes.object,
    history: PropTypes.object,
    location: PropTypes.object
  }

  constructor(props) {
    super(props);
    this.state = {
      testResult: null,
      id: props.match.params.id
    };
  }

  getTestResult() {
    if (!this.state.id) {
      return;
    }
    fetch(Settings.serverUrl + '/result/' + this.state.id)
      .then(response => response.json())
      .then(data => {
        this.setState({testResult: data});
      })
      .catch(error => console.log(error));
  }

  componentDidMount() {
    this.getTestResult();
  }

  render() {
    const testResult = this.state.testResult;
    return (
      <React.Fragment>
        <PageSection variant={PageSectionVariants.light}>
          <TextContent>
            <Text component="h1">{testResult && testResult.test_id}</Text>
          </TextContent>
        </PageSection>
        <PageSection>
          <ResultView testResult={testResult} history={this.props.history} location={this.props.location}/>
        </PageSection>
      </React.Fragment>
    );
  }
}
