// Canonical pass_percent formula: floor(passes * 100 / tests), clamped to
// [0, 100].  The same formula is implemented in the backend (update_run in
// ibutsu_server/tasks/runs.py) and the migration backfill SQL
// (d18de2b3253f_backfill_pass_percent_in_run_summary.py).
//
// Non-passing outcomes subtracted when deriving passes: failures, errors,
// skips, xpasses, xfailures.  Keep this list in sync with the backend.
export const getRunPassPercent = (summary) => {
  if (!summary) return 'N/A';
  if (summary.pass_percent != null) return summary.pass_percent + '%';
  if (!summary.tests) return '0%';
  // Fallback for runs not yet backfilled
  const passed =
    summary.passes ??
    summary.tests -
      (summary.failures || 0) -
      (summary.errors || 0) -
      (summary.skips || 0) -
      (summary.xpasses || 0) -
      (summary.xfailures || 0);
  const pct = Math.min(Math.max(Math.floor((passed * 100) / summary.tests), 0), 100);
  return pct + '%';
};
