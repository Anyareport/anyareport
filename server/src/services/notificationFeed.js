import {
  BLOTTER_REPORT_CATEGORY,
  CRIMINAL_BLOTTER_SUBCATEGORY,
  normalizeReportStatus,
} from './reportWorkflow.js';

const FEED_ID_PATTERN = /^(?:status|notification):[a-f\d]{24}$/i;

export function encodeNotificationCursor(createdAt, id) {
  return Buffer.from(JSON.stringify({ createdAt: new Date(createdAt).toISOString(), id })).toString(
    'base64url'
  );
}

export function decodeNotificationCursor(value) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const createdAt = new Date(parsed.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || !FEED_ID_PATTERN.test(parsed.id)) {
      throw new Error('Invalid cursor');
    }
    return { createdAt, id: parsed.id };
  } catch {
    const error = new Error('Invalid notification cursor');
    error.statusCode = 400;
    throw error;
  }
}

export function buildNotificationFeedPipeline(recipientUid, limit, cursor) {
  const isAlert = {
    $or: [
      { $gt: ['$urgentCount', 0] },
      { $eq: ['$latest.type', 'backup_requested'] },
      { $eq: ['$reportCategory', 'Emergency Situations'] },
      {
        $and: [
          { $eq: ['$reportCategory', BLOTTER_REPORT_CATEGORY] },
          { $eq: ['$reportSubcategory', CRIMINAL_BLOTTER_SUBCATEGORY] },
        ],
      },
      {
        $in: [{ $toLower: { $ifNull: ['$reportSeverity', ''] } }, ['high', 'critical']],
      },
    ],
  };
  const statusGroupCondition = {
    $and: [
      { $eq: ['$type', 'report_status_updated'] },
      { $ne: [{ $ifNull: ['$reportId', null] }, null] },
    ],
  };
  const pageStages = [];

  if (cursor) {
    pageStages.push({
      $match: {
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
        ],
      },
    });
  }

  pageStages.push(
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: limit + 1 },
    {
      $project: {
        _id: 1,
        kind: 1,
        bucket: 1,
        createdAt: 1,
        read: 1,
        urgent: { $gt: ['$urgentCount', 0] },
        eventCount: 1,
        unreadEventCount: 1,
        latest: 1,
        events: 1,
      },
    }
  );

  return [
    { $match: { recipientUid } },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: {
          $cond: [
            statusGroupCondition,
            { $concat: ['status:', { $toString: '$reportId' }] },
            { $concat: ['notification:', { $toString: '$_id' }] },
          ],
        },
        latest: { $first: '$$ROOT' },
        events: { $push: '$$ROOT' },
        eventCount: { $sum: 1 },
        unreadEventCount: {
          $sum: {
            $cond: [{ $eq: [{ $ifNull: ['$read', false] }, false] }, 1, 0],
          },
        },
        urgentCount: {
          $max: {
            $cond: [{ $eq: [{ $ifNull: ['$urgent', false] }, true] }, 1, 0],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'reports',
        localField: 'latest.reportId',
        foreignField: '_id',
        as: 'reportMatches',
      },
    },
    {
      $addFields: {
        joinedReport: { $arrayElemAt: ['$reportMatches', 0] },
      },
    },
    {
      $addFields: {
        kind: {
          $cond: [{ $eq: ['$latest.type', 'report_status_updated'] }, 'status_group', 'event'],
        },
        reportCategory: {
          $ifNull: ['$latest.reportSnapshot.category', '$joinedReport.category'],
        },
        reportSubcategory: {
          $ifNull: ['$latest.reportSnapshot.subcategory', '$joinedReport.subcategory'],
        },
        reportSeverity: {
          $ifNull: ['$latest.reportSnapshot.severity', '$joinedReport.severity'],
        },
        createdAt: '$latest.createdAt',
        read: { $eq: ['$unreadEventCount', 0] },
      },
    },
    {
      $addFields: {
        bucket: {
          $cond: [
            { $eq: ['$kind', 'status_group'] },
            'updates',
            { $cond: [isAlert, 'alerts', 'updates'] },
          ],
        },
      },
    },
    {
      $unset: [
        'reportMatches',
        'joinedReport',
        'reportCategory',
        'reportSubcategory',
        'reportSeverity',
      ],
    },
    {
      $facet: {
        items: pageStages,
        counts: [
          {
            $group: {
              _id: null,
              all: { $sum: 1 },
              unread: { $sum: { $cond: ['$read', 0, 1] } },
              alerts: { $sum: { $cond: [{ $eq: ['$bucket', 'alerts'] }, 1, 0] } },
              updates: { $sum: { $cond: [{ $eq: ['$bucket', 'updates'] }, 1, 0] } },
              unreadEvents: { $sum: '$unreadEventCount' },
            },
          },
        ],
      },
    },
  ];
}

export function parseLegacyStatusNotification(message) {
  const match = message.match(/status was updated to (.+?) by (.+?)\.?$/i);
  if (!match) return { statusSnapshot: null, actorName: null };

  return {
    statusSnapshot: normalizeReportStatus(match[1].trim().toLowerCase().replace(/\s+/g, '_')),
    actorName: match[2].trim(),
  };
}
