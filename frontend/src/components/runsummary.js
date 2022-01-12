import React from 'react';
import PropTypes from 'prop-types';

export class RunSummary extends React.Component {
  static propTypes = {
    summary: PropTypes.object
  }

  render() {
    if (!this.props.summary) {
      return '';
    }
    const summary = this.props.summary;
    let passed = 0, failed = 0, errors = 0, skipped = 0, xfailed = 0, xpassed = 0;
    if (summary.tests) {
      passed = summary.tests;
    }
    if (summary.failures) {
      passed -= summary.failures;
      failed = summary.failures;
    }
    if (summary.errors) {
      passed -= summary.errors;
      errors = summary.errors;
    }
    if (summary.skips) {
      passed -= summary.skips;
      skipped = summary.skips;
    }
    if (summary.xfailures) {
      xfailed = summary.xfailures;
    }
    if (summary.xpasses) {
      passed -= summary.xpasses;
      xpassed = summary.xpasses;
    }
    if (summary.passes) {
      passed = summary.passes;
    }
    return (
      <React.Fragment>
        {passed > 0 && <span className="pf-c-badge passed" title="Passed">{passed}</span>}
        {failed > 0 && <span className="pf-c-badge failed" title="Failed">{failed}</span>}
        {errors > 0 && <span className="pf-c-badge error" title="Error">{errors}</span>}
        {skipped > 0 && <span className="pf-c-badge skipped" title="Skipped">{skipped}</span>}
        {xfailed > 0 && <span className="pf-c-badge xfailed" title="Xfailed">{xfailed}</span>}
        {xpassed > 0 && <span className="pf-c-badge xpassed" title="Xpassed">{xpassed}</span>}
      </React.Fragment>
    );
  }
}
