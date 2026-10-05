import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNotificationFeedPipeline,
  decodeNotificationCursor,
  encodeNotificationCursor,
  parseLegacyStatusNotification,
} from './notificationFeed.js';
import { getNotificationRecipientRoles, getReportChangeRooms } from './notifications.js';

test('notification cursor round-trips its timestamp and stable feed id', () => {
  const createdAt = new Date('2026-10-04T10:15:00.000Z');
  const id = 'status:507f1f77bcf86cd799439011';

  assert.deepEqual(decodeNotificationCursor(encodeNotificationCursor(createdAt, id)), {
    createdAt,
    id,
  });
});

test('invalid notification cursors return a client error', () => {
  assert.throws(() => decodeNotificationCursor('not-a-cursor'), { statusCode: 400 });
});

test('legacy status messages normalize old status values and retain actor names', () => {
  assert.deepEqual(
    parseLegacyStatusNotification(
      'Your report (AR-2026-001) status was updated to On Scene by Alex.'
    ),
    { statusSnapshot: 'in_progress', actorName: 'Alex' }
  );
});

test('feed pipeline groups status events by report and leaves other events independent', () => {
  const pipeline = buildNotificationFeedPipeline('user-1', 20, null);
  const groupStage = pipeline.find((stage) => stage.$group);
  const groupId = groupStage.$group._id.$cond;
  const facet = pipeline.find((stage) => stage.$facet).$facet;

  assert.match(groupId[1].$concat[0], /^status:/);
  assert.match(groupId[2].$concat[0], /^notification:/);
  assert.equal(facet.items.find((stage) => stage.$sort).$sort.createdAt, -1);
  assert.equal(facet.items.find((stage) => stage.$limit).$limit, 21);
  assert.ok(facet.counts.length > 0);
});

test('alerts use urgency, emergency category, backup requests, and high severity', () => {
  const pipeline = buildNotificationFeedPipeline('user-1', 20, null);
  const bucketExpression = pipeline.find((stage) => stage.$addFields?.bucket).$addFields.bucket
    .$cond;
  const alertExpression = bucketExpression[2].$cond[0];
  const serializedAlertExpression = JSON.stringify(alertExpression);

  assert.equal(bucketExpression[1], 'updates');
  assert.match(serializedAlertExpression, /urgentCount/);
  assert.match(serializedAlertExpression, /backup_requested/);
  assert.match(serializedAlertExpression, /Emergency Situations/);
  assert.match(serializedAlertExpression, /Criminal/);
  assert.match(serializedAlertExpression, /critical/);
  assert.doesNotMatch(serializedAlertExpression, /incident_received/);
});

test('feed cursor constrains later pages after grouping', () => {
  const cursor = {
    createdAt: new Date('2026-10-04T10:15:00.000Z'),
    id: 'status:507f1f77bcf86cd799439011',
  };
  const pipeline = buildNotificationFeedPipeline('user-1', 20, cursor);
  const facet = pipeline.find((stage) => stage.$facet).$facet;
  const cursorStage = facet.items.find((stage) => stage.$match);

  assert.deepEqual(cursorStage.$match.$or[0].createdAt.$lt, cursor.createdAt);
  assert.equal(cursorStage.$match.$or[1]._id.$lt, cursor.id);
});

test('new-report notification recipients follow the three report categories', () => {
  assert.deepEqual(getNotificationRecipientRoles('Public Concerns'), ['tanod', 'responder']);
  assert.deepEqual(getNotificationRecipientRoles('Blotter Cases'), ['captain', 'secretary']);
  assert.deepEqual(getNotificationRecipientRoles('Blotter Cases', 'Criminal'), [
    'captain',
    'secretary',
    'tanod',
    'responder',
  ]);
  assert.deepEqual(getNotificationRecipientRoles('Emergency Situations'), [
    'captain',
    'tanod',
    'responder',
  ]);
  assert.deepEqual(getNotificationRecipientRoles('Unknown'), []);
});

test('report change rooms follow report visibility and include the submitter only', () => {
  assert.deepEqual(
    getReportChangeRooms({
      _id: 'report-1',
      category: 'Blotter Cases',
      submittedBy: 'resident-1',
    }),
    ['role:admin', 'role:captain', 'role:secretary', 'user:resident-1']
  );
  assert.deepEqual(
    getReportChangeRooms({
      _id: 'report-2',
      category: 'Emergency Situations',
      submittedBy: 'resident-2',
    }),
    [
      'role:admin',
      'role:captain',
      'role:tanod',
      'role:responder',
      'user:resident-2',
    ]
  );
  assert.deepEqual(
    getReportChangeRooms({
      _id: 'report-3',
      category: 'Blotter Cases',
      subcategory: 'Criminal',
      submittedBy: 'resident-3',
    }),
    [
      'role:admin',
      'role:captain',
      'role:secretary',
      'role:tanod',
      'role:responder',
      'user:resident-3',
    ]
  );
});
