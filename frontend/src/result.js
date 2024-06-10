import React from 'react';
import PropTypes from 'prop-types';

import {
  PageSection,
  PageSectionVariants,
  TextContent,
  Text
} from '@patternfly/react-core';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import { EmptyObject, ResultView } from './components';


export class Result extends React.Component {
  static propTypes = {
    params: PropTypes.object,
    location: PropTypes.object,
    navigate: PropTypes.func,
  }

  constructor(props) {
    super(props);
    this.state = {
      isResultValid: false,
      testResult: null,
      id: props.params.id
    };
  }

  getTestResult() {
    if (!this.state.id) {
      return;
    }
    HttpClient.get([Settings.serverUrl, 'result', this.state.id])
      .then(response => {
        response = HttpClient.handleResponse(response, 'response');
        if (response.ok) {
          this.setState({"isResultValid": true});
        } else {
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
    const testResult = this.state.testResult;
    return (
      <React.Fragment>
        <PageSection variant={PageSectionVariants.light}>
          <TextContent>
            <Text component="h1">
              {testResult ? testResult.test_id : <Text>Result</Text>}
            </Text>
          </TextContent>
        </PageSection>
        <PageSection>
          {this.state.isResultValid ?
            <ResultView testResult={testResult} location={this.props.location} navigate={this.props.navigate} /> :
            <EmptyObject headingText="Result not found" returnLink="/results" returnLinkText="Return to results list"/>}
        </PageSection>
      </React.Fragment>
    );
  }
}
