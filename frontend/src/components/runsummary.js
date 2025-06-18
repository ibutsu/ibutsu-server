import React from 'react';
import PropTypes from 'prop-types';
import { Label, LabelGroup } from '@patternfly/react-core';
import { ICON_RESULT_MAP } from '../constants';

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
            <Label
              icon={ICON_RESULT_MAP.passed}
              variant="filled"
              title="Passed"
            >
              {passed}
            </Label>
          )}
          {failed > 0 && (
            <Label
              icon={ICON_RESULT_MAP.failed}
              variant="filled"
              title="Failed"
            >
              {failed}
            </Label>
          )}
          {errors > 0 && (
            <Label icon={ICON_RESULT_MAP.error} variant="filled" title="Error">
              {errors}
            </Label>
          )}
          {skipped > 0 && (
            <Label
              icon={ICON_RESULT_MAP.skipped}
              variant="filled"
              title="Skipped"
            >
              {skipped}
            </Label>
          )}
          {xfailed > 0 && (
            <Label
              icon={ICON_RESULT_MAP.xfailed}
              variant="filled"
              title="Xfailed"
            >
              {xfailed}
            </Label>
          )}
          {xpassed > 0 && (
            <Label
              icon={ICON_RESULT_MAP.xpassed}
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
