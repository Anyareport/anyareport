export type Role = 'resident' | 'tanod' | 'responder' | 'captain' | 'secretary' | 'kagawad' | 'admin';

export const officialRoles: Role[] = ['tanod', 'responder', 'captain', 'secretary', 'kagawad', 'admin'];

export const adminDashboardRoles: Role[] = ['admin', 'captain', 'secretary', 'kagawad'];

export function getRoleLabel(role?: string | null) {
  switch (role) {
    case 'resident':
      return 'Resident';
    case 'tanod':
      return 'Tanod';
    case 'responder':
      return 'Responder';
    case 'captain':
      return 'Barangay Captain';
    case 'secretary':
      return 'Barangay Secretary';
    case 'kagawad':
      return 'Kagawad';
    case 'admin':
      return 'System Admin';
    default:
      return 'Guest';
  }
}

export function getHomePath(role?: string | null) {
  if (role === 'resident') return '/resident';
  if (role === 'tanod' || role === 'responder') return '/responder';
  if (role && ['admin', 'captain', 'secretary', 'kagawad'].includes(role)) return '/admin';
  return '/login';
}

export function canEditCommitteeData(role?: string | null) {
  return role === 'secretary' || role === 'kagawad' || role === 'tanod' || role === 'responder';
}