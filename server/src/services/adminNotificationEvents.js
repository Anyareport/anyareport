// Pure builders for admin notifications, so the wording and the audit trail are easy to test.

const ROLE_LABELS = {
  resident: 'Resident',
  tanod: 'Tanod',
  responder: 'Responder',
  captain: 'Captain',
  secretary: 'Secretary',
  admin: 'Admin',
};

export const ADMIN_NOTIFICATION_TYPES = [
  'admin_user_created',
  'admin_user_status_changed',
  'admin_user_role_changed',
  'admin_report_flagged',
];

const roleLabel = (role) => ROLE_LABELS[role] || role;

export function buildUserCreatedEvent({ actorName, target }) {
  return {
    type: 'admin_user_created',
    message: `${actorName} created a ${roleLabel(target.role)} account for ${target.name}.`,
    urgent: target.role === 'admin',
    auditAction: 'user_created',
    auditMetadata: {
      targetUid: target.firebaseUid,
      targetEmail: target.email,
      targetName: target.name,
      role: target.role,
    },
  };
}

export function buildUserStatusEvent({ actorName, target, previousStatus }) {
  const suspended = target.status === 'suspended';
  return {
    type: 'admin_user_status_changed',
    message: `${actorName} ${suspended ? 'suspended' : 'reactivated'} the account of ${target.name}.`,
    urgent: suspended && target.role === 'admin',
    auditAction: 'user_status_changed',
    auditMetadata: {
      targetUid: target.firebaseUid,
      targetName: target.name,
      from: previousStatus,
      to: target.status,
    },
  };
}

export function buildUserRoleEvent({ actorName, target, previousRole }) {
  return {
    type: 'admin_user_role_changed',
    message: `${actorName} changed the role of ${target.name} from ${roleLabel(previousRole)} to ${roleLabel(target.role)}.`,
    urgent: previousRole === 'admin' || target.role === 'admin',
    auditAction: 'user_role_changed',
    auditMetadata: {
      targetUid: target.firebaseUid,
      targetName: target.name,
      from: previousRole,
      to: target.role,
    },
  };
}

export function buildReportFlaggedEvent({ actorName, report }) {
  const reference = report.referenceNumber ? ` ${report.referenceNumber}` : '';
  return {
    type: 'admin_report_flagged',
    message: `${actorName} flagged report${reference} as abusive or invalid.`,
    urgent: false,
  };
}