import { getDemoAnalytics, getDemoDbSnapshot, getDemoProfile, getDemoSession, setDemoDbSnapshot, createReportId, createNotificationId, createAuditId } from './demoStore';
import type { Report, UserProfile } from './api';

function now() {
  return new Date().toISOString();
}

function pickCommittee(category: string) {
  const map: Record<string, string | null> = {
    'Public Concerns': 'Peace and Order',
    'Blotter Cases': 'Peace and Order',
    'Emergency Situations': null,
    'Infrastructure Damage': 'Infrastructure',
    'Health and Sanitation': 'Health and Sanitation',
    Environmental: 'Environmental Protection',
  };
  return map[category] ?? null;
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
  const body = options.body instanceof FormData
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
      committee: null,
      status: 'active',
      emailVerified: true,
      flaggedReportCount: 0,
    };
    db.users = [profile, ...db.users.filter((user) => user.firebaseUid !== profile.firebaseUid)];
    setDemoDbSnapshot(db);
    return profile as T;
  }

  if (pathname === '/api/auth/sync-claims' && method === 'POST') {
    return { role: getDemoProfile()?.role || 'resident', committee: getDemoProfile()?.committee || null } as T;
  }

  if (pathname === '/api/reports/categories' && method === 'GET') {
    return db.categories as T;
  }

  if (pathname === '/api/reports/mine' && method === 'GET') {
    const uid = session?.firebaseUid || 'demo-resident-1';
    return db.reports.filter((report) => report.submittedBy === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) as T;
  }

  if (pathname === '/api/reports/analytics' && method === 'GET') {
    return getDemoAnalytics() as T;
  }

  if (pathname === '/api/reports/heatmap' && method === 'GET') {
    return db.reports.map((report) => ({
      lat: report.location.coordinates[1],
      lng: report.location.coordinates[0],
      category: report.category,
      status: report.status,
    })) as T;
  }

  if (pathname === '/api/reports' && method === 'GET') {
    const status = searchParams.get('status');
    const role = getDemoProfile()?.role || 'resident';
    const committee = getDemoProfile()?.committee;

    let reports = db.reports;
    if (role === 'resident') {
      reports = reports.filter((report) => report.submittedBy === (session?.firebaseUid || 'demo-resident-1'));
    } else if (role === 'kagawad' && committee) {
      reports = reports.filter((report) => report.committee === committee);
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
      category,
      committee: pickCommittee(category),
      description: String(body.description || ''),
      photos: [],
      location: {
        type: 'Point',
        coordinates: [Number(body.longitude || 121.3708), Number(body.latitude || 16.4833)],
        address: String(body.address || ''),
      },
      status: 'pending',
      aiSuggestedCategory: category,
      verifiedBy: null,
      acknowledgedBy: null,
      statusHistory: [{ status: 'pending', updatedBy: session?.firebaseUid || 'demo-resident-1', timestamp: now() }],
      createdAt: now(),
      updatedAt: now(),
    };

    db.reports = [report, ...db.reports];
    db.auditLogs = [{
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
    }, ...db.auditLogs];
    setDemoDbSnapshot(db);
    return report as T;
  }

  const reportMatch = pathname.match(/^\/api\/reports\/([^/]+)(?:\/(verify|flag|status|acknowledge))?$/);
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
      report.statusHistory.push({ status: 'verified', updatedBy: report.verifiedBy, timestamp: now() });
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
      report.statusHistory.push({ status: 'flagged', updatedBy: getDemoProfile()?.firebaseUid || 'demo-secretary-1', timestamp: now() });
      setDemoDbSnapshot(db);
      return report as T;
    }

    if (method === 'PATCH' && action === 'status') {
      const nextStatus = String(body.status || 'en_route') as Report['status'];
      report.status = nextStatus;
      report.statusHistory.push({ status: nextStatus, updatedBy: getDemoProfile()?.firebaseUid || 'demo-responder-1', timestamp: now() });
      setDemoDbSnapshot(db);
      return report as T;
    }

    if (method === 'PATCH' && action === 'acknowledge') {
      report.acknowledgedBy = getDemoProfile()?.firebaseUid || 'demo-responder-1';
      if (report.status === 'verified') {
        report.status = 'en_route';
        report.statusHistory.push({ status: 'en_route', updatedBy: report.acknowledgedBy, timestamp: now() });
      }
      setDemoDbSnapshot(db);
      return report as T;
    }
  }

  if (pathname === '/api/notifications' && method === 'GET') {
    const uid = getDemoProfile()?.firebaseUid || 'demo-responder-1';
    return db.notifications.filter((notification) => notification.recipientUid === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) as T;
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
    return db.auditLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 100) as T;
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
      committee: body.committee ? String(body.committee) : null,
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
    user.committee = body.committee !== undefined ? (body.committee ? String(body.committee) : null) : user.committee;
    setDemoDbSnapshot(db);
    return user as T;
  }

  if (pathname === '/api/export' && method === 'GET') {
    const format = searchParams.get('format') || 'csv';
    if (format === 'pdf') {
      const content = db.reports.map((report, index) => `${index + 1}. [${report.status}] ${report.category}`).join('\n');
      return new Blob([content], { type: 'application/pdf' }) as T;
    }

    const rows = ['id,category,committee,status,description,latitude,longitude,submittedAt'];
    db.reports.forEach((report) => {
      rows.push([
        report._id,
        report.category,
        report.committee || '',
        report.status,
        report.description.replace(/"/g, '""'),
        report.location.coordinates[1],
        report.location.coordinates[0],
        report.createdAt,
      ].map((value) => `"${String(value)}"`).join(','));
    });
    return new Blob([rows.join('\n')], { type: 'text/csv' }) as T;
  }

  throw new Error(`Demo API route not implemented: ${method} ${pathname}`);
}
