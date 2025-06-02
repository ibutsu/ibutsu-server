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
import ResultView from './components/resultView';
import { useParams } from 'react-router-dom';

const Result = () => {
  const { result_id } = useParams();

  const [isResultValid, setIsResultValid] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    const fetchTestResult = async () => {
      try {
        setFetching(true);
        const response = await HttpClient.get([
          Settings.serverUrl,
          'result',
          result_id,
        ]);
        const data = await HttpClient.handleResponse(response);
        setIsResultValid(true);
        setTestResult(data);
        setFetching(false);
      } catch (error) {
        console.error(error);
        setIsResultValid(false);
        setFetching(false);
      }
    };

    if (result_id !== testResult?.id) {
      const debouncer = setTimeout(() => {
        fetchTestResult();
      }, 100);
      return () => {
        clearTimeout(debouncer);
      };
    }
  }, [result_id, testResult]);

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
        {!fetching && isResultValid && <ResultView testResult={testResult} />}
        {!fetching && !isResultValid && (
          <EmptyObject
            headingText="Result not found"
            returnLink="/results"
            returnLinkText="Return to results list"
          />
        )}
        {fetching && <Skeleton />}
      </PageSection>
    </React.Fragment>
  );
};

Result.propTypes = {};

export default Result;
