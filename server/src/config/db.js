import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<username>')) {
    console.warn(
      '[DB] MONGODB_URI is not configured. Set it in server/.env to connect to MongoDB Atlas.'
    );
    return false;
  }

  try {
    await mongoose.connect(uri);
    console.log('[DB] Connected to MongoDB');
    return true;
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    return false;
  }
}
