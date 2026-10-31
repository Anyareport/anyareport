export function applyResidentReactivation(user, { actorUid, reason }) {
  const auditRecord = {
    action: 'resident_account_reactivated',
    actorUid,
    reportId: null,
    metadata: {
      targetUid: user.firebaseUid,
      targetEmail: user.email,
      targetName: user.name,
      reason,
      previousFlaggedReportCount: user.flaggedReportCount,
      resetFlaggedReportCount: 0,
    },
  };
  user.status = 'active';
  user.flaggedReportCount = 0;
  return auditRecord;
}
