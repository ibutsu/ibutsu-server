import React from 'react';
import PropTypes from 'prop-types';
import { Label, LabelGroup } from '@patternfly/react-core';
import { iconResultMap } from '../utilities';

const RunSummary = ({ summary }) => {
  let passed = 0,
    failed = 0,
    errors = 0,
    skipped = 0,
    xfailed = 0,
    xpassed = 0;
  if (summary?.tests) {
    passed = summary.tests;
  }
  if (summary?.failures) {
    passed -= summary.failures;
    failed = summary.failures;
  }
  if (summary?.errors) {
    passed -= summary.errors;
    errors = summary.errors;
  }
  if (summary?.skips) {
    passed -= summary.skips;
    skipped = summary.skips;
  }
  if (summary?.xfailures) {
    xfailed = summary.xfailures;
  }
  if (summary?.xpasses) {
    passed -= summary.xpasses;
    xpassed = summary.xpasses;
  }
  if (summary?.passes) {
    passed = summary.passes;
  }
  return (
    <React.Fragment>
      {summary && (
        <LabelGroup aria-label="Result Counts">
          {passed > 0 && (
            <Label icon={iconResultMap.passed} variant="filled" title="Passed">
              {passed}
            </Label>
          )}
          {failed > 0 && (
            <Label icon={iconResultMap.failed} variant="filled" title="Failed">
              {failed}
            </Label>
          )}
          {errors > 0 && (
            <Label icon={iconResultMap.error} variant="filled" title="Error">
              {errors}
            </Label>
          )}
          {skipped > 0 && (
            <Label
              icon={iconResultMap.skipped}
              variant="filled"
              title="Skipped"
            >
              {skipped}
            </Label>
          )}
          {xfailed > 0 && (
            <Label
              icon={iconResultMap.xfailed}
              variant="filled"
              title="Xfailed"
            >
              {xfailed}
            </Label>
          )}
          {xpassed > 0 && (
            <Label
              icon={iconResultMap.xpassed}
              variant="filled"
              title="Xpassed"
            >
              {xpassed}
            </Label>
          )}
        </LabelGroup>
      )}
    </React.Fragment>
  );
};

RunSummary.propTypes = {
  summary: PropTypes.object,
};

export default RunSummary;
