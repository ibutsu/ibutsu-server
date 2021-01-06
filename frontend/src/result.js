import React from 'react';
import PropTypes from 'prop-types';

import {
  PageSection,
  PageSectionVariants,
  TextContent,
  Text
} from '@patternfly/react-core';

import { Settings } from './settings';
import { EmptyObject, ResultView } from './components';


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
      .then(response => {
        this.setState({ "httpStatus": response.status });
        if (!response.ok) {
          throw new Error("Failed with HTTP code " + response.status);
        }
        return response.json();
      })
      .then(data => {
        this.setState({testResult: data});
      })
      .catch(error => console.log(error));
  }

  componentDidMount() {
    this.getTestResult();
  }

  render() {
    let isNotFound = false;
    const testResult = this.state.testResult;
    if (!this.state.httpStatus || [404, 500].includes(this.state.httpStatus)) {
      isNotFound = true;
    }
    return (
      <React.Fragment>
        <PageSection variant={PageSectionVariants.light}>
          <TextContent>
            <Text component="h1">
              {testResult && testResult.test_id}
              {!testResult && <Text>Result</Text>}
            </Text>
          </TextContent>
        </PageSection>
        <PageSection>
          {isNotFound &&
          <EmptyObject headingText="Result not found" returnLink="/results" returnLinkText="Return to results list" />}
          {!isNotFound && <ResultView testResult={testResult} history={this.props.history} location={this.props.location}/>}
        </PageSection>
      </React.Fragment>
    );
  }
}
