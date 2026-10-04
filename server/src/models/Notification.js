import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientUid: { type: String, required: true, index: true },
    recipientRole: { type: String, required: true },
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
    type: { type: String, required: true },
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
    actorName: String,
  },
  { timestamps: true }
);

notificationSchema.index({ recipientUid: 1, createdAt: -1, _id: -1 });

export default mongoose.model('Notification', notificationSchema);
