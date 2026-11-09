import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientUid: { type: String, required: true, index: true },
    recipientRole: { type: String, required: true },
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
    dedupeKey: { type: String },
    type: { type: String, required: true },
    announcementCategory: { type: String, default: null },
    announcementTitle: { type: String, default: null },
    announcementId: { type: String, default: null, index: true },
    announcementAuthorUid: { type: String, default: null, index: true },
    announcementImages: { type: [String], default: [] },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    urgent: { type: Boolean, default: false },
    reportSnapshot: {
      referenceNumber: String,
      category: String,
      subcategory: String,
      title: String,
      severity: String,
      location: String,
    },
    statusSnapshot: String,
    actorRole: String,
    actorUid: String,
    actorName: String,
    dispatchResponse: { type: String, enum: ['accepted', 'declined'], default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientUid: 1, createdAt: -1, _id: -1 });
notificationSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } }
);

export default mongoose.model('Notification', notificationSchema);
