// Canonical pass_percent formula: floor(passes * 100 / tests), clamped to
// [0, 100].  The same formula is implemented in the backend
// (compute_pass_percent in ibutsu_server/tasks/runs.py, used by update_run)
// and the migration backfill SQL
// (d18de2b3253f_backfill_pass_percent_in_run_summary.py). JS can't share
// code with those, so if the formula changes, update all three -- see
// test_runs.py::test_compute_pass_percent_* for the cases that must match
// across implementations.
//
// Non-passing outcomes subtracted when deriving passes: failures, errors,
// skips, xpasses, xfailures.  Keep this list in sync with the backend.
//
// Returns the bare numeric value as a string (e.g. "85"), or 'N/A' when a
// percentage cannot be determined. Callers are responsible for appending a
// '%' suffix if their display context doesn't already convey the unit
// (e.g. via a "Pass %" column header or label).
export const getRunPassPercent = (summary) => {
  if (!summary) return 'N/A';
  if (summary.pass_percent != null) return String(summary.pass_percent);
  if (!summary.tests) return '0';
  // Fallback for runs not yet backfilled
  const passed =
    summary.passes ??
    summary.tests -
      (summary.failures || 0) -
      (summary.errors || 0) -
      (summary.skips || 0) -
      (summary.xpasses || 0) -
      (summary.xfailures || 0);
  const pct = Math.min(
    Math.max(Math.floor((passed * 100) / summary.tests), 0),
    100,
  );
  return String(pct);
};
