import type { QueryClient } from '@tanstack/react-query';

export interface ReportChangeEvent {
  reportId: string;
  category: string;
  changeType: 'created' | 'updated';
}

export function invalidateReportQueries(queryClient: QueryClient, reportId?: string) {
  const queryKeys = [
    ['admin-reports'],
    ['admin-dashboard-reports'],
    ['admin-dashboard-analytics'],
    ['admin-analytics'],
    ['admin-heatmap-points'],
    ['admin-audit-logs'],
    ['captain-inactive-reports'],
    ['pending-reports'],
    ['secretary-intake'],
    ['responder-reports'],
    ['responder-alerts'],
    ['responder-handled-reports'],
    ['responder-history'],
    ['my-reports'],
    reportId ? ['report', reportId] : ['report'],
    reportId ? ['report-audit', reportId] : ['report-audit'],
  ];

  return Promise.all(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
}
