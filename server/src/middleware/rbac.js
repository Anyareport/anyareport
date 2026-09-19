// ASSUMPTION: Role access matrix enforcement — see README for full matrix
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.userRole;
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function canUpdateStatus(role) {
  // ASSUMPTION: Secretary, tanod, and responder can update status; Captain/Admin oversight only
  return ['secretary', 'tanod', 'responder'].includes(role);
}

export function canVerifyReports(role) {
  // ASSUMPTION: Only Secretary verifies/intakes new reports
  return role === 'secretary';
}

export function canManageUsers(role) {
  // ASSUMPTION: Only Admin manages users/roles
  return role === 'admin';
}

export function getAuditScope(role) {
  // Audit logs are restricted to administrators.
  if (role === 'admin') return { scope: 'full' };
  return { scope: 'none' };
}
