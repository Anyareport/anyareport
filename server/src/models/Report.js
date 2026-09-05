import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    submittedBy: { type: String, required: true, index: true },
    category: { type: String, required: true },
    committee: { type: String, default: null },
    description: { type: String, required: true },
    photos: [{ type: String }],
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
      address: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'en_route', 'on_scene', 'resolved', 'flagged'],
      default: 'pending',
    },
    aiSuggestedCategory: { type: String, default: null },
    verifiedBy: { type: String, default: null },
    acknowledgedBy: { type: String, default: null },
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
reportSchema.index({ committee: 1, status: 1 });

export default mongoose.model('Report', reportSchema);
