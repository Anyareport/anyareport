import mongoose from 'mongoose';

const reportReferenceCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    sequence: { type: Number, required: true, default: 0 },
  },
  { collection: 'report_reference_counters', versionKey: false }
);

export default mongoose.model('ReportReferenceCounter', reportReferenceCounterSchema);
