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
    resolution: {
      summary: { type: String, default: null },
      actionsTaken: { type: String, default: null },
      outcome: { type: String, default: null },
      furtherActionRequired: { type: Boolean, default: null },
      furtherActionRecommendation: { type: String, default: null },
      assistanceRequested: { type: Boolean, default: null },
      supportingEvidence: [{ type: String }],
      resolvedBy: { type: String, default: null },
      resolvedByName: { type: String, default: null },
      resolvedAt: { type: Date, default: null },
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified'],
        default: null,
      },
      verifiedBy: { type: String, default: null },
      verifiedByName: { type: String, default: null },
      verifiedAt: { type: Date, default: null },
    },
    backupRequests: [
      {
        requestedBy: { type: String, required: true },
        requestedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['pending', 'closed'], default: 'pending' },
        joinedBy: [{ type: String }],
        closedBy: { type: String, default: null },
        closedAt: { type: Date, default: null },
        closeReason: { type: String, enum: ['enough_help', 'resolved', 'flagged'], default: null },
      },
    ],
    dispatchInvites: [
      {
        responderUid: { type: String, required: true },
        status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
        invitedAt: { type: Date, default: Date.now },
        respondedAt: { type: Date, default: null },
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
