import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Badge } from '@patternfly/react-core';
import { HttpClient } from '../services/http';
import { Settings } from '../settings';

import {
  buildParams,
  toAPIFilter,
} from '../utilities';

const LastPassed = (props) => {
  const {filters} = props;

  const [resultData, setResultData] = useState();

  useEffect(() => {
    // get the passed/failed/etc test summary
    // disregard result filter so we can filter on last passed
    if (filters) {
      const params = {...filters};
      delete params['result'];
      delete params['start_time'];
      params['result'] = {'op': 'eq', 'val': 'passed'};
      const apiParams = buildParams(filters);
      apiParams['filter'] = toAPIFilter(filters);
      apiParams['pageSize'] = 1;
      apiParams['page'] = 1;
      apiParams['estimate'] = 'true';

      HttpClient.get([Settings.serverUrl, 'result'], apiParams)
        .then(response => HttpClient.handleResponse(response))
        .then(data => {setResultData(data.results[0]);})
        .catch((error) => {console.error('Error fetching result data:', error);});
    }
  }, [filters]);

  return (
    <React.Fragment>
      {resultData &&
            <Link target="_blank" rel="noopener noreferrer" to={`../results/${resultData.id}#summary`} relative="Path">
              <Badge isRead>
                {new Date(resultData.start_time).toLocaleString()}
              </Badge>
            </Link>}
      {(resultData === null) && 'result error'}
    </React.Fragment>
  );
};

LastPassed.propTypes = {
  filters: PropTypes.object
};

export default LastPassed;
