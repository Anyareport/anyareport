export const antiAbuseConfig = {
  maxReportsPerDay: parseInt(process.env.MAX_REPORTS_PER_DAY || '15', 10),
  flaggedReportThreshold: parseInt(process.env.FLAGGED_REPORT_THRESHOLD || '3', 10),
};
