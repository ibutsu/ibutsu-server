import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Badge } from '@patternfly/react-core';
import { HttpClient } from '../utilities/http';
import { Settings } from '../pages/settings';
import { filtersToAPIParams } from '../utilities';

const LastPassed = ({ filters = [] }) => {
  const [resultData, setResultData] = useState();

  useEffect(() => {
    // get the passed/failed/etc test summary
    // disregard result filter so we can filter on last passed
    const fetchResults = async () => {
      // drop result and start time filters

      const filtersForParam = filters.filter(
        (f) => !['result', 'start_time'].includes(f.field),
      );
      filtersForParam.push({
        field: 'result',
        operator: 'eq',
        value: 'passed',
      });
      const apiParams = {
        estimate: true,
        filter: filtersToAPIParams(filtersForParam),
      };
      try {
        const response = await HttpClient.get(
          [Settings.serverUrl, 'result'],
          apiParams,
        );
        const data = await HttpClient.handleResponse(response);

        setResultData(data.results[0]);
      } catch (error) {
        console.error('Error fetching result data:', error);
      }
    };

    if (filters.length) {
      const debouncer = setTimeout(() => {
        fetchResults();
      }, 100);
      return () => {
        clearTimeout(debouncer);
      };
    }
  }, [filters]);

  return (
    <>
      {resultData && (
        <Link
          target="_blank"
          rel="noopener noreferrer"
          to={`../results/${resultData.id}#summary`}
          relative="Path"
        >
          <Badge style={{ padding: '.2rem', margin: '.2rem' }}>
            {new Date(resultData.start_time).toLocaleString()}
          </Badge>
        </Link>
      )}
      {resultData === null && 'result error'}
      {resultData === undefined && (
        <Badge isDisabled style={{ padding: '.2rem', margin: '.2rem' }}>
          Not Applicable
        </Badge>
      )}
    </>
  );
};

LastPassed.propTypes = {
  filters: PropTypes.arrayOf(PropTypes.object),
};

export default LastPassed;
