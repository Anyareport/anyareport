import { getIdToken } from './firebase';
import { isDemoMode } from './mode';
import { demoRequest } from './demoApi';

const API_URL = import.meta.env.VITE_API_URL || '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (isDemoMode) {
    return demoRequest<T>(path, options);
  }

  const token = await getIdToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return res.json();
  }
  return res as unknown as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  download: async (path: string) => {
    if (isDemoMode) {
      return demoRequest<Blob>(path, {});
    }

    const token = await getIdToken();
    const res = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Download failed');
    return res.blob();
  },
};

export interface UserProfile {
  _id: string;
  firebaseUid: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  role: string;
  committee: string | null;
  status: string;
  emailVerified: boolean;
  flaggedReportCount: number;
}

export interface Report {
  _id: string;
  submittedBy: string;
  category: string;
  committee: string | null;
  description: string;
  photos: string[];
  location: {
    type: string;
    coordinates: [number, number];
    address: string;
  };
  status: string;
  subcategory: string | null;
  severity: 'Low' | 'Medium' | 'High' | 'Critical' | null;
  aiSuggestedCategory: string | null;
  verifiedBy: string | null;
  acknowledgedBy: string | null;
  statusHistory: { status: string; updatedBy: string; timestamp: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  _id: string;
  name: string;
  committee: string | null;
  description: string;
}

export interface Notification {
  _id: string;
  recipientUid: string;
  recipientRole: string;
  reportId: string;
  type: string;
  message: string;
  read: boolean;
  urgent: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  _id: string;
  action: string;
  actorUid: string | null;
  reportId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Analytics {
  total: number;
  resolved: number;
  pending: number;
  resolutionRate: number;
  byCategory: { _id: string; count: number }[];
  byStatus: { _id: string; count: number }[];
  last30Days: { _id: string; count: number }[];
}
