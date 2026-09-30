import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    submittedBy: { type: String, required: true, index: true },
    referenceNumber: { type: String },
    category: { type: String, required: true },
    description: { type: String, default: '' },
    photos: [{ type: String }],
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
      address: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: [
        'pending',
        'coordinating',
        'verified',
        'acknowledged',
        'in_progress',
        'en_route',
        'on_scene',
        'resolved',
        'flagged',
      ],
      default: 'pending',
    },
    subcategory: { type: String, default: null },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: null },
    aiTitle: { type: String, default: null },
    aiSuggestedCategory: { type: String, default: null },
    aiSummary: { type: String, default: null },
    verifiedBy: { type: String, default: null },
    acknowledgedBy: { type: String, default: null },
    backupRequests: [
      {
        requestedBy: { type: String, required: true },
        requestedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['pending', 'closed'], default: 'pending' },
        joinedBy: [{ type: String }],
        closedBy: { type: String, default: null },
        closedAt: { type: Date, default: null },
        closeReason: { type: String, enum: ['enough_help', 'resolved'], default: null },
      },
    ],
    statusHistory: [
      {
        status: String,
        updatedBy: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

reportSchema.index({ location: '2dsphere' });
reportSchema.index({ referenceNumber: 1 }, { unique: true, sparse: true });

export default mongoose.model('Report', reportSchema);
