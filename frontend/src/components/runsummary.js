import React from 'react';
import PropTypes from 'prop-types';

const RunSummary = (props) => {
  const { summary } = props;

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
        <>
          {passed > 0 && (
            <span className="pf-v5-c-badge passed" title="Passed">
              {passed}
            </span>
          )}
          {failed > 0 && (
            <span className="pf-v5-c-badge failed" title="Failed">
              {failed}
            </span>
          )}
          {errors > 0 && (
            <span className="pf-v5-c-badge error" title="Error">
              {errors}
            </span>
          )}
          {skipped > 0 && (
            <span className="pf-v5-c-badge skipped" title="Skipped">
              {skipped}
            </span>
          )}
          {xfailed > 0 && (
            <span className="pf-v5-c-badge xfailed" title="Xfailed">
              {xfailed}
            </span>
          )}
          {xpassed > 0 && (
            <span className="pf-v5-c-badge xpassed" title="Xpassed">
              {xpassed}
            </span>
          )}
        </>
      )}
    </React.Fragment>
  );
};

RunSummary.propTypes = {
  summary: PropTypes.object,
};

export default RunSummary;
