import type { Analytics, Category, Report, UserProfile } from './api';

type DemoNotification = {
  _id: string;
  recipientUid: string;
  recipientRole: string;
  reportId: string;
  type: string;
  message: string;
  read: boolean;
  urgent: boolean;
  createdAt: string;
  updatedAt: string;
};

type DemoAuditLog = {
  _id: string;
  action: string;
  actorUid: string | null;
  reportId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
};

const SESSION_KEY = 'anyareport-demo-session';
const DB_KEY = 'anyareport-demo-db';

type DemoRole = 'resident' | 'tanod' | 'responder' | 'captain' | 'secretary' | 'kagawad' | 'admin';

interface DemoSession {
  firebaseUid: string;
  email: string;
  name: string;
  role: DemoRole;
  committee: string | null;
}

interface DemoDb {
  categories: Category[];
  users: UserProfile[];
  reports: Report[];
  notifications: DemoNotification[];
  auditLogs: DemoAuditLog[];
}

const categorySeed: Category[] = [
  { _id: 'cat-1', name: 'Public Concerns', committee: 'Peace and Order', description: 'General public safety concerns' },
  { _id: 'cat-2', name: 'Blotter Cases', committee: 'Peace and Order', description: 'Formal blotter entries' },
  { _id: 'cat-3', name: 'Emergency Situations', committee: null, description: 'Medical, fire, and other emergencies' },
  { _id: 'cat-4', name: 'Infrastructure Damage', committee: 'Infrastructure', description: 'Roads, bridges, public facilities' },
  { _id: 'cat-5', name: 'Health and Sanitation', committee: 'Health and Sanitation', description: 'Health hazards and sanitation issues' },
  { _id: 'cat-6', name: 'Environmental', committee: 'Environmental Protection', description: 'Environmental concerns and pollution' },
];

const demoUsers: UserProfile[] = [
  {
    _id: 'user-resident-1',
    firebaseUid: 'demo-resident-1',
    email: 'resident@demo.local',
    name: 'Demo Resident',
    phone: '09171234567',
    address: 'Purok 1, Demo Barangay',
    role: 'resident',
    committee: null,
    status: 'active',
    emailVerified: true,
    flaggedReportCount: 0,
  },
  {
    _id: 'user-secretary-1',
    firebaseUid: 'demo-secretary-1',
    email: 'secretary@demo.local',
    name: 'Demo Secretary',
    phone: '09211234567',
    address: 'Barangay Hall',
    role: 'secretary',
    committee: null,
    status: 'active',
    emailVerified: true,
    flaggedReportCount: 0,
  },
  {
    _id: 'user-responder-1',
    firebaseUid: 'demo-responder-1',
    email: 'responder@demo.local',
    name: 'Demo Responder',
    phone: '09251234567',
    address: 'Barangay Hall',
    role: 'responder',
    committee: null,
    status: 'active',
    emailVerified: true,
    flaggedReportCount: 0,
  },
  {
    _id: 'user-admin-1',
    firebaseUid: 'demo-admin-1',
    email: 'admin@demo.local',
    name: 'Demo Admin',
    phone: '09191234567',
    address: 'Barangay Hall',
    role: 'admin',
    committee: null,
    status: 'active',
    emailVerified: true,
    flaggedReportCount: 0,
  },
  {
    _id: 'user-captain-1',
    firebaseUid: 'demo-captain-1',
    email: 'captain@demo.local',
    name: 'Demo Captain',
    phone: '09201234567',
    address: 'Barangay Hall',
    role: 'captain',
    committee: null,
    status: 'active',
    emailVerified: true,
    flaggedReportCount: 0,
  },
  {
    _id: 'user-kagawad-1',
    firebaseUid: 'demo-kagawad-1',
    email: 'kagawad.po@demo.local',
    name: 'Demo Kagawad',
    phone: '09221234567',
    address: 'Barangay Hall',
    role: 'kagawad',
    committee: 'Peace and Order',
    status: 'active',
    emailVerified: true,
    flaggedReportCount: 0,
  },
];

const reportSeed: Report[] = [
  {
    _id: 'report-1',
    submittedBy: 'demo-resident-1',
    category: 'Public Concerns',
    committee: 'Peace and Order',
    description: 'Loud karaoke party past midnight at Purok 3',
    photos: [],
    location: { type: 'Point', coordinates: [121.3708, 16.4833], address: 'Purok 3, Demo Barangay' },
    status: 'pending',
    aiSuggestedCategory: 'Public Concerns',
    verifiedBy: null,
    acknowledgedBy: null,
    statusHistory: [{ status: 'pending', updatedBy: 'demo-resident-1', timestamp: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'report-2',
    submittedBy: 'demo-resident-1',
    category: 'Emergency Situations',
    committee: null,
    description: 'Elderly resident collapsed, needs medical assistance',
    photos: [],
    location: { type: 'Point', coordinates: [121.3718, 16.4843], address: 'Purok 1, Demo Barangay' },
    status: 'en_route',
    aiSuggestedCategory: 'Emergency Situations',
    verifiedBy: 'demo-secretary-1',
    acknowledgedBy: 'demo-responder-1',
    statusHistory: [
      { status: 'pending', updatedBy: 'demo-resident-1', timestamp: new Date().toISOString() },
      { status: 'verified', updatedBy: 'demo-secretary-1', timestamp: new Date().toISOString() },
      { status: 'en_route', updatedBy: 'demo-responder-1', timestamp: new Date().toISOString() },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'report-3',
    submittedBy: 'demo-resident-1',
    category: 'Infrastructure Damage',
    committee: 'Infrastructure',
    description: 'Broken streetlight on path to barangay hall',
    photos: [],
    location: { type: 'Point', coordinates: [121.3698, 16.4823], address: 'Barangay Hall road' },
    status: 'resolved',
    aiSuggestedCategory: 'Infrastructure Damage',
    verifiedBy: 'demo-secretary-1',
    acknowledgedBy: 'demo-kagawad-1',
    statusHistory: [
      { status: 'pending', updatedBy: 'demo-resident-1', timestamp: new Date().toISOString() },
      { status: 'verified', updatedBy: 'demo-secretary-1', timestamp: new Date().toISOString() },
      { status: 'resolved', updatedBy: 'demo-kagawad-1', timestamp: new Date().toISOString() },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function createSeedDb(): DemoDb {
  const now = new Date().toISOString();
  return {
    categories: categorySeed,
    users: demoUsers,
    reports: reportSeed.map((report) => ({ ...report, createdAt: now, updatedAt: now })),
    notifications: [
      {
        _id: 'notif-1',
        recipientUid: 'demo-responder-1',
        recipientRole: 'responder',
        reportId: 'report-2',
        type: 'incident_verified',
        message: 'Verified incident: Emergency Situations',
        read: false,
        urgent: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: 'notif-2',
        recipientUid: 'demo-captain-1',
        recipientRole: 'captain',
        reportId: 'report-2',
        type: 'incident_verified',
        message: 'Verified incident: Emergency Situations',
        read: false,
        urgent: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    auditLogs: [
      {
        _id: 'audit-1',
        action: 'report_submitted',
        actorUid: 'demo-resident-1',
        reportId: 'report-1',
        ip: '127.0.0.1',
        userAgent: 'Demo mode',
        metadata: { category: 'Public Concerns' },
        timestamp: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function readDb(): DemoDb {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    const seed = createSeedDb();
    localStorage.setItem(DB_KEY, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(raw) as DemoDb;
}

function writeDb(db: DemoDb) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function getDemoSession(): DemoSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as DemoSession) : null;
}

export function setDemoSession(session: DemoSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event('anyareport-demo-auth-changed'));
}

export function clearDemoSession() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event('anyareport-demo-auth-changed'));
}

function getRoleFromEmail(email: string): DemoRole {
  const lowered = email.toLowerCase();
  if (lowered.includes('admin')) return 'admin';
  if (lowered.includes('captain')) return 'captain';
  if (lowered.includes('secretary')) return 'secretary';
  if (lowered.includes('kagawad')) return 'kagawad';
  if (lowered.includes('responder')) return 'responder';
  if (lowered.includes('tanod')) return 'tanod';
  return 'resident';
}

function sessionToProfile(session: DemoSession): UserProfile {
  const db = readDb();
  const existing = db.users.find((user) => user.firebaseUid === session.firebaseUid || user.email === session.email);
  return existing || {
    _id: session.firebaseUid,
    firebaseUid: session.firebaseUid,
    email: session.email,
    name: session.name,
    phone: '09170000000',
    address: 'Demo Barangay',
    role: session.role,
    committee: session.committee,
    status: 'active',
    emailVerified: true,
    flaggedReportCount: 0,
  };
}

export function getDemoProfile(): UserProfile | null {
  const session = getDemoSession();
  return session ? sessionToProfile(session) : null;
}

export function demoLogin(email: string, name = 'Demo User') {
  const role = getRoleFromEmail(email);
  const session: DemoSession = {
    firebaseUid: `demo-${role}-${email}`,
    email,
    name,
    role,
    committee: role === 'kagawad' ? 'Peace and Order' : null,
  };
  setDemoSession(session);
  return sessionToProfile(session);
}

export function demoRegister(payload: { email: string; name: string }) {
  return demoLogin(payload.email, payload.name);
}

export function demoLogout() {
  clearDemoSession();
}

export function demoGetIdToken() {
  const session = getDemoSession();
  return session ? `demo:${session.firebaseUid}` : null;
}

export function getDemoDbSnapshot() {
  return readDb();
}

export function setDemoDbSnapshot(db: DemoDb) {
  writeDb(db);
}

export function getDemoAnalytics(): Analytics {
  const db = readDb();
  const total = db.reports.length;
  const resolved = db.reports.filter((report) => report.status === 'resolved').length;
  const pending = db.reports.filter((report) => report.status === 'pending').length;

  const byCategoryMap = new Map<string, number>();
  const byStatusMap = new Map<string, number>();
  const last30DaysMap = new Map<string, number>();

  db.reports.forEach((report) => {
    byCategoryMap.set(report.category, (byCategoryMap.get(report.category) || 0) + 1);
    byStatusMap.set(report.status, (byStatusMap.get(report.status) || 0) + 1);
    const key = report.createdAt.slice(0, 10);
    last30DaysMap.set(key, (last30DaysMap.get(key) || 0) + 1);
  });

  return {
    total,
    resolved,
    pending,
    resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    byCategory: Array.from(byCategoryMap.entries()).map(([key, value]) => ({ _id: key, count: value })),
    byStatus: Array.from(byStatusMap.entries()).map(([key, value]) => ({ _id: key, count: value })),
    last30Days: Array.from(last30DaysMap.entries()).map(([key, value]) => ({ _id: key, count: value })),
  };
}

export function createReportId() {
  return `report-${Date.now()}`;
}

export function createNotificationId() {
  return `notif-${Date.now()}`;
}

export function createAuditId() {
  return `audit-${Date.now()}`;
}
