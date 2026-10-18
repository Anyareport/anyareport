import AuditLog from '../models/AuditLog.js';

// Writes one audit entry. `req` is optional: when given, the actor, IP and user agent
// come from the request; system-initiated entries leave them empty.
// Auditing never blocks the action being audited, so failures are logged, not thrown.
export async function writeAudit(action, { req = null, reportId = null, metadata = {} } = {}) {
  try {
    return await AuditLog.create({
      action,
      actorUid: req?.firebaseUser?.uid || null,
      reportId,
      ip: req?.ip || req?.headers?.['x-forwarded-for'] || null,
      userAgent: req?.headers?.['user-agent'] || null,
      metadata,
    });
  } catch (error) {
    console.error(`[Audit] Failed to record ${action}:`, error.message);
    return null;
  }
}