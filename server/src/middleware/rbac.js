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

// ASSUMPTION: Kagawad can only access their own committee's data
export function scopeToCommittee(query, userRole, userCommittee) {
  if (userRole === 'kagawad' && userCommittee) {
    return { ...query, committee: userCommittee };
  }
  return query;
}

export function assertCommitteeAccess(req, reportCommittee) {
  // ASSUMPTION: Kagawad restricted to own committee
  if (req.userRole === 'kagawad') {
    if (reportCommittee !== req.userCommittee) {
      return false;
    }
  }
  return true;
}

export function canUpdateStatus(role) {
  // ASSUMPTION: Secretary and Kagawad can update status; Captain/Admin oversight only
  return ['secretary', 'kagawad', 'tanod', 'responder'].includes(role);
}

export function canVerifyReports(role) {
  // ASSUMPTION: Only Secretary verifies/intakes new reports
  return role === 'secretary';
}

export function canManageUsers(role) {
  // ASSUMPTION: Only Admin manages users/roles
  return role === 'admin';
}

export function getAuditScope(role, committee) {
  // ASSUMPTION: Audit trail visibility per role
  if (role === 'admin') return { scope: 'full' };
  if (role === 'captain') return { scope: 'all', readOnly: true };
  if (role === 'secretary') return { scope: 'case', readOnly: true };
  if (role === 'kagawad') return { scope: 'committee', committee, readOnly: true };
  return { scope: 'none' };
}
