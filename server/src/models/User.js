import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, default: '' },
    role: {
      type: String,
      enum: ['resident', 'tanod', 'responder', 'captain', 'secretary', 'kagawad', 'admin'],
      default: 'resident',
    },
    committee: { type: String, default: null },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    flaggedReportCount: { type: Number, default: 0 },
    emailVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
