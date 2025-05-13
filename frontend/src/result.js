import React, { useState, useEffect } from 'react';

import {
  PageSection,
  PageSectionVariants,
  TextContent,
  Text,
  Skeleton,
} from '@patternfly/react-core';

import { HttpClient } from './services/http';
import { Settings } from './settings';
import EmptyObject from './components/empty-object';
import ResultView from './components/result';
import { useParams } from 'react-router-dom';

const Result = () => {
  const { result_id } = useParams();

  const [isResultValid, setIsResultValid] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    const fetchTestResult = async () => {
      if (!result_id) {
        return;
      }
      try {
        const response = await HttpClient.get([
          Settings.serverUrl,
          'result',
          result_id,
        ]);
        const data = await HttpClient.handleResponse(response);
        setIsResultValid(true);
        setTestResult(data);
      } catch (error) {
        console.error(error);
        setIsResultValid(false);
      }
    };
    fetchTestResult();
  }, [result_id]);

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
        {testResult ? (
          isResultValid ? (
            <ResultView testResult={testResult} />
          ) : (
            <EmptyObject
              headingText="Result not found"
              returnLink="/results"
              returnLinkText="Return to results list"
            />
          )
        ) : (
          <Skeleton />
        )}
      </PageSection>
    </React.Fragment>
  );
};

Result.propTypes = {};

export default Result;
