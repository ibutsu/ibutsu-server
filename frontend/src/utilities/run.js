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
  return Math.floor((passed / summary.tests) * 100) + '%';
};
