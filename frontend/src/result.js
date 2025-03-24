import React, { useState, useEffect } from 'react';

import {
  PageSection,
  PageSectionVariants,
  TextContent,
  Text,
  Skeleton
} from '@patternfly/react-core';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import EmptyObject from './components/empty-object';
import ResultView from './components/result';
import { useParams } from 'react-router-dom';

const Result = () => {

  const params = useParams();
  const [isResultValid, setIsResultValid] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const id = params.result_id;

  useEffect(() => {
    const fetchTestResult = async () => {
      if (!id) {
        return;
      }
      try {
        let response = await HttpClient.get([Settings.serverUrl, 'result', id]);
        response = HttpClient.handleResponse(response, 'response');
        if (response.ok) {
          setIsResultValid(true);
          const data = await response.json();
          setTestResult(data);
        } else {
          throw new Error('Failed with HTTP code ' + response.status);
        }
      } catch (error) {
        console.log(error);
      }
    };
    fetchTestResult();
  }, [id]);

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
        {!testResult ? (
          <Skeleton />
        ) : (
          isResultValid ?
            <ResultView testResult={testResult} /> :
            <EmptyObject headingText="Result not found" returnLink="/results" returnLinkText="Return to results list"/>
        )}
      </PageSection>
    </React.Fragment>
  );
};

Result.propTypes = {};

export default Result;
