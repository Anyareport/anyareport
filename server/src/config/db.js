import mongoose from 'mongoose';

const CONNECTION_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export function getDatabaseStatus() {
  const state = mongoose.connection.readyState;
  return {
    connected: state === 1,
    state: CONNECTION_STATES[state] || 'unknown',
  };
}

export function buildHealthResponse(database, timestamp = new Date().toISOString()) {
  const ready = database.connected;
  return {
    statusCode: ready ? 200 : 503,
    body: {
      status: ready ? 'ok' : 'unavailable',
      database: database.state,
      timestamp,
    },
  };
}

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
