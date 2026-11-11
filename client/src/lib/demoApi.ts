import {
  getDemoAnalytics,
  getDemoDbSnapshot,
  getDemoProfile,
  getDemoSession,
  setDemoDbSnapshot,
  createReportId,
  createNotificationId,
  createAuditId,
} from './demoStore';
import type { Report, UserProfile } from './api';
import { getStatusLabel, normalizeReportStatus } from './reportWorkflow';

function getExportStatus(status: string) {
  return normalizeReportStatus(status) === 'coordinating' ? getStatusLabel(status) : status;
}

function now() {
  return new Date().toISOString();
}

function normalizePath(path: string) {
  const url = new URL(path, 'http://demo.local');
  return { pathname: url.pathname, searchParams: url.searchParams };
}

export async function demoRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { pathname, searchParams } = normalizePath(path);
  const method = (options.method || 'GET').toUpperCase();
  const db = getDemoDbSnapshot();
  const session = getDemoSession();
  const body =
    options.body instanceof FormData
      ? Object.fromEntries(options.body.entries())
      : options.body
        ? JSON.parse(String(options.body))
        : {};

  if (pathname === '/api/auth/profile' && method === 'GET') {
    return getDemoProfile() as T;
  }

  if (pathname === '/api/auth/register' && method === 'POST') {
    const profile: UserProfile = {
      _id: `user-${Date.now()}`,
      firebaseUid: session?.firebaseUid || `demo-resident-${Date.now()}`,
      email: body.email || session?.email || 'resident@demo.local',
      name: body.name || 'Demo Resident',
      phone: body.phone || '09170000000',
      address: body.address || '',
      role: 'resident',
      status: 'active',
      emailVerified: true,
      flaggedReportCount: 0,
    };
    db.users = [profile, ...db.users.filter((user) => user.firebaseUid !== profile.firebaseUid)];
    setDemoDbSnapshot(db);
    return profile as T;
  }

  if (pathname === '/api/auth/sync-claims' && method === 'POST') {
    return { role: getDemoProfile()?.role || 'resident' } as T;
  }

  if (pathname === '/api/reports/categories' && method === 'GET') {
    return db.categories as T;
  }

  if (pathname === '/api/reports/mine' && method === 'GET') {
    const uid = session?.firebaseUid || 'demo-resident-1';
    return db.reports
      .filter((report) => report.submittedBy === uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) as T;
  }

  if (pathname === '/api/reports/analytics' && method === 'GET') {
    const period = searchParams.get('period') || 'month';
    return getDemoAnalytics(
      period === 'all' || period === 'week' || period === 'year' ? period : 'month',
    ) as T;
  }

  if (pathname === '/api/reports/analytics/insights' && method === 'GET') {
    const requestedPeriod = searchParams.get('period') || 'month';
    const period =
      requestedPeriod === 'all' || requestedPeriod === 'week' || requestedPeriod === 'year'
        ? requestedPeriod
        : 'month';
    const analytics = getDemoAnalytics(period);
    if (!analytics.total) return { insufficientData: true } as T;

    const periodDays = period === 'all' ? null : { week: 7, month: 30, year: 365 }[period];
    const cutoff = periodDays === null ? null : Date.now() - periodDays * 86400000;
    const periodReports =
      cutoff === null
        ? db.reports
        : db.reports.filter((report) => new Date(report.createdAt).getTime() >= cutoff);
    const statuses = new Map(
      analytics.byStatus.map((entry) => [normalizeReportStatus(entry._id), entry.count]),
    );
    const open = [...statuses]
      .filter(([status]) => !['resolved', 'endorsed', 'flagged'].includes(status))
      .reduce((count, [, value]) => count + value, 0);
    const highSeverity = periodReports.filter((report) =>
      ['Critical', 'High'].includes(report.severity || ''),
    ).length;
    const recommendations: {
      title: string;
      evidence: string;
      recommendation: string;
    }[] = [];

    if (open > 0) {
      recommendations.push({
        title: 'Review open reports',
        evidence: `${open} reports are not yet resolved, endorsed, or flagged.`,
        recommendation: 'Review pending and in-progress cases, starting with the oldest and most urgent.',
      });
    }
    if (highSeverity > 0) {
      recommendations.push({
        title: 'Prioritize higher-severity incidents',
        evidence: `${highSeverity} reports are marked High or Critical.`,
        recommendation: 'Confirm that urgent cases have an assigned responder and receive timely follow-up.',
      });
    }
    const topCategory = analytics.byCategory.slice().sort((left, right) => right.count - left.count)[0];
    if (topCategory) {
      recommendations.push({
        title: 'Review the most reported category',
        evidence: `${topCategory._id}: ${topCategory.count} of ${analytics.total} reports.`,
        recommendation: 'Review these cases for recurring needs and consider whether prevention or public information could help.',
      });
    }

    const resolved = analytics.resolvedWithinBarangay;
    const endorsed = analytics.resolvedExternally;
    return {
      insufficientData: false,
      overallSummary: `There are ${analytics.total} reports for this period: ${open} remain open, ${resolved} were resolved within the barangay, and ${endorsed} were endorsed to external agencies.`,
      resolvedCount: resolved,
      endorsedCount: endorsed,
      recommendations: recommendations.slice(0, 3),
    } as T;
  }

  if (pathname === '/api/reports/heatmap' && method === 'GET') {
    return db.reports.map((report) => ({
      id: report._id,
      lat: report.location.coordinates[1],
      lng: report.location.coordinates[0],
      category: report.category,
      status: report.status,
    })) as T;
  }

  if (pathname === '/api/reports' && method === 'GET') {
    const status = searchParams.get('status');
    const role = getDemoProfile()?.role || 'resident';

    let reports = db.reports;
    if (role === 'resident') {
      reports = reports.filter(
        (report) => report.submittedBy === (session?.firebaseUid || 'demo-resident-1')
      );
    }

    if (searchParams.get('handledByMe') === 'true' && ['tanod', 'responder'].includes(role)) {
      reports = reports.filter(
        (report) =>
          report.acknowledgedBy === (session?.firebaseUid || getDemoProfile()?.firebaseUid) &&
          report.status !== 'endorsed'
      );
    }

    if (status) {
      reports = reports.filter((report) => report.status === status);
    }

    return reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200) as T;
  }

  if (pathname === '/api/reports' && method === 'POST') {
    const category = String(body.category || 'Public Concerns');
    const report: Report = {
      _id: createReportId(),
      submittedBy: session?.firebaseUid || 'demo-resident-1',
      submitterName: session?.name || 'Demo Resident',
      category,
      description: String(body.description || ''),
      photos: [],
      location: {
        type: 'Point',
        coordinates: [Number(body.longitude || 121.3708), Number(body.latitude || 16.4833)],
        address: String(body.address || ''),
      },
      status: 'pending',
      subcategory: null,
      severity: null,
      aiSuggestedCategory: category,
      aiSummary: null,
      verifiedBy: null,
      acknowledgedBy: null,
      statusHistory: [
        {
          status: 'pending',
          updatedBy: session?.firebaseUid || 'demo-resident-1',
          timestamp: now(),
        },
      ],
      createdAt: now(),
      updatedAt: now(),
    };

    db.reports = [report, ...db.reports];
    db.auditLogs = [
      {
        _id: createAuditId(),
        action: 'report_submitted',
        actorUid: report.submittedBy,
        reportId: report._id,
        ip: '127.0.0.1',
        userAgent: 'Demo mode',
        metadata: { category },
        timestamp: now(),
        createdAt: now(),
        updatedAt: now(),
      },
      ...db.auditLogs,
    ];
    setDemoDbSnapshot(db);
    return report as T;
  }

  const reportMatch = pathname.match(
    /^\/api\/reports\/([^/]+)(?:\/(verify|flag|status|acknowledge|backup))?$/
  );
  if (reportMatch) {
    const reportId = reportMatch[1];
    const action = reportMatch[2] || null;
    const report = db.reports.find((entry) => entry._id === reportId);

    if (!report) {
      throw new Error('Report not found');
    }

    if (method === 'GET' && !action) {
      return report as T;
    }

    if (method === 'POST' && action === 'verify') {
      report.status = 'verified';
      report.verifiedBy = getDemoProfile()?.firebaseUid || 'demo-secretary-1';
      report.statusHistory.push({
        status: 'verified',
        updatedBy: report.verifiedBy,
        timestamp: now(),
      });
      db.notifications.unshift({
        _id: createNotificationId(),
        recipientUid: 'demo-responder-1',
        recipientRole: 'responder',
        reportId: report._id,
        type: 'incident_verified',
        message: `Verified incident: ${report.category}`,
        read: false,
        urgent: report.category === 'Emergency Situations',
        createdAt: now(),
        updatedAt: now(),
      });
      db.auditLogs.unshift({
        _id: createAuditId(),
        action: 'report_verified',
        actorUid: getDemoProfile()?.firebaseUid || 'demo-secretary-1',
        reportId: report._id,
        ip: '127.0.0.1',
        userAgent: 'Demo mode',
        metadata: {},
        timestamp: now(),
        createdAt: now(),
        updatedAt: now(),
      });
      setDemoDbSnapshot(db);
      return report as T;
    }

    if (method === 'POST' && action === 'flag') {
      report.status = 'flagged';
      report.statusHistory.push({
        status: 'flagged',
        updatedBy: getDemoProfile()?.firebaseUid || 'demo-secretary-1',
        timestamp: now(),
      });
      setDemoDbSnapshot(db);
      return report as T;
    }

    if (method === 'PATCH' && action === 'status') {
      const nextStatus = String(body.status || 'en_route') as Report['status'];
      const demoProfile = getDemoProfile();
      const demoRole = demoProfile?.role || '';
      const demoUid = demoProfile?.firebaseUid || 'demo-responder-1';
      if (['captain', 'secretary'].includes(demoRole) && nextStatus !== 'resolved') {
        throw new Error('Captain and Secretary can only resolve incidents');
      }
      if (['tanod', 'responder'].includes(demoRole)) {
        if (report.acknowledgedBy && report.acknowledgedBy !== demoUid) {
          throw new Error('Incident is already reserved by another responder');
        }
        if (nextStatus === 'en_route' && !report.acknowledgedBy) {
          report.acknowledgedBy = demoUid;
        } else if (!report.acknowledgedBy) {
          throw new Error('Set en route first to reserve this incident');
        }
      }
      report.status = nextStatus;
      report.statusHistory.push({
        status: nextStatus,
        updatedBy: demoUid,
        timestamp: now(),
      });
      if (nextStatus === 'verified') {
        report.verifiedBy = getDemoProfile()?.firebaseUid || 'demo-responder-1';
      }
      setDemoDbSnapshot(db);
      return report as T;
    }

    if (method === 'PATCH' && action === 'acknowledge') {
      const demoProfile = getDemoProfile();
      if (!['tanod', 'responder'].includes(demoProfile?.role || '')) {
        throw new Error('Only responders can acknowledge incidents');
      }
      const demoUid = demoProfile?.firebaseUid || 'demo-responder-1';
      if (report.acknowledgedBy && report.acknowledgedBy !== demoUid) {
        throw new Error('Incident is already reserved by another responder');
      }
      report.acknowledgedBy = demoUid;
      if (report.status === 'verified') {
        report.status = 'en_route';
        report.statusHistory.push({
          status: 'en_route',
          updatedBy: report.acknowledgedBy,
          timestamp: now(),
        });
      }
      setDemoDbSnapshot(db);
      return report as T;
    }

    if (method === 'POST' && action === 'backup') {
      const demoProfile = getDemoProfile();
      const demoUid = demoProfile?.firebaseUid || 'demo-responder-1';
      if (!['tanod', 'responder'].includes(demoProfile?.role || '')) {
        throw new Error('Only responders can request backup');
      }
      if (['resolved', 'endorsed'].includes(report.status)) {
        throw new Error('Resolved incidents cannot request backup');
      }
      if (report.acknowledgedBy !== demoUid) {
        throw new Error('Only the assigned responder can request backup');
      }
      report.backupRequests = report.backupRequests || [];
      if (report.backupRequests.some((request) => request.status === 'pending')) {
        throw new Error('Backup has already been requested');
      }
      report.backupRequests.push({ requestedBy: demoUid, requestedAt: now(), status: 'pending' });
      db.notifications.unshift({
        _id: createNotificationId(),
        recipientUid: 'demo-responder-1',
        recipientRole: 'responder',
        reportId: report._id,
        type: 'backup_requested',
        message: `${demoProfile?.name || 'Demo Responder'} requested backup for ${report.category}.`,
        read: false,
        urgent: true,
        createdAt: now(),
        updatedAt: now(),
      });
      setDemoDbSnapshot(db);
      return report as T;
    }
  }

  if (pathname === '/api/notifications' && method === 'GET') {
    const uid = getDemoProfile()?.firebaseUid || 'demo-responder-1';
    return db.notifications
      .filter((notification) => notification.recipientUid === uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) as T;
  }

  const notificationMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (notificationMatch && method === 'PATCH') {
    const notification = db.notifications.find((entry) => entry._id === notificationMatch[1]);
    if (!notification) throw new Error('Notification not found');
    notification.read = true;
    notification.updatedAt = now();
    setDemoDbSnapshot(db);
    return notification as T;
  }

  if (pathname === '/api/audit-logs' && method === 'GET') {
    const excludedActions = (searchParams.get('excludeActions') || '')
      .split(',')
      .filter(Boolean);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 500);
    return db.auditLogs
      .filter((log) => !excludedActions.includes(log.action))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit) as T;
  }

  if (pathname === '/api/admin/users' && method === 'GET') {
    return db.users as T;
  }

  if (pathname === '/api/admin/users' && method === 'POST') {
    const role = String(body.role || 'secretary');
    const user: UserProfile = {
      _id: `user-${Date.now()}`,
      firebaseUid: `demo-${role}-${Date.now()}`,
      email: String(body.email || ''),
      name: String(body.name || ''),
      phone: String(body.phone || ''),
      address: String(body.address || ''),
      role: role as UserProfile['role'],
      status: 'active',
      emailVerified: true,
      flaggedReportCount: 0,
    };
    db.users.unshift(user);
    setDemoDbSnapshot(db);
    return user as T;
  }

  const userStatusMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/status$/);
  if (userStatusMatch && method === 'PATCH') {
    const user = db.users.find((entry) => entry._id === userStatusMatch[1]);
    if (!user) throw new Error('User not found');
    user.status = String(body.status || user.status) as UserProfile['status'];
    setDemoDbSnapshot(db);
    return user as T;
  }

  const userRoleMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/role$/);
  if (userRoleMatch && method === 'PATCH') {
    const user = db.users.find((entry) => entry._id === userRoleMatch[1]);
    if (!user) throw new Error('User not found');
    user.role = String(body.role || user.role) as UserProfile['role'];
    setDemoDbSnapshot(db);
    return user as T;
  }

  if (pathname === '/api/export' && method === 'GET') {
    const format = searchParams.get('format') || 'csv';
    if (format === 'pdf') {
      const content = db.reports
        .map((report, index) => `${index + 1}. [${getExportStatus(report.status)}] ${report.category}`)
        .join('\n');
      return new Blob([content], { type: 'application/pdf' }) as T;
    }

    const rows = ['id,category,status,description,address,submittedAt'];
    db.reports.forEach((report) => {
      rows.push(
        [
          report._id,
          report.category,
          getExportStatus(report.status),
          report.description.replace(/"/g, '""'),
          report.location.address,
          report.createdAt,
        ]
          .map((value) => `"${String(value)}"`)
          .join(',')
      );
    });
    return new Blob([rows.join('\n')], { type: 'text/csv' }) as T;
  }

  throw new Error(`Demo API route not implemented: ${method} ${pathname}`);
}
