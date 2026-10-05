import mongoose from 'mongoose';

const pushTokenSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('PushToken', pushTokenSchema);
