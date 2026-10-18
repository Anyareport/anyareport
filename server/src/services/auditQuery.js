export const AUDIT_ROLES = ['resident', 'tanod', 'responder', 'captain', 'secretary', 'admin'];

export function parseAuditRole(value) {
  return typeof value === 'string' && AUDIT_ROLES.includes(value) ? value : null;
}

// Limits a filter to entries written by the given users (the users with one role).
// If a specific actor was also requested, that actor must be one of them.
export function restrictActorToUids(filter, uids) {
  if (typeof filter.actorUid === 'string') {
    return uids.includes(filter.actorUid) ? filter : { ...filter, actorUid: { $in: [] } };
  }
  return { ...filter, actorUid: { $in: uids } };
}
// Turns audit-log query-string filters into a Mongo query. Pure, so it is easy to test.
export const DEFAULT_AUDIT_LIMIT = 200;
export const MAX_AUDIT_LIMIT = 500;

function parseDate(value) {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildAuditFilter(params = {}) {
  const filter = {};

  // If a specific actor was requested, we need to ensure that the actor is one of the allowed users.
  if (typeof params.actor === 'string' && params.actor) filter.actorUid = params.actor;
  if (typeof params.action === 'string' && params.action) filter.action = params.action;

  // `from` is inclusive and `to` is exclusive, so the client can send
  // "start of the day" and "start of the next day" for a date or month.
  const from = parseDate(params.from);
  const to = parseDate(params.to);
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = from;
    if (to) filter.timestamp.$lt = to;
  }

  return filter;
}

export function parseAuditLimit(value) {
  const limit = Number.parseInt(value, 10);
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_AUDIT_LIMIT;
  return Math.min(limit, MAX_AUDIT_LIMIT);
}