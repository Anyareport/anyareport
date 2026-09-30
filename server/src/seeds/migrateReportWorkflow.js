import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Report from '../models/Report.js';

async function migrateReportWorkflow() {
  const connected = await connectDB();
  if (!connected) {
    console.error('[Workflow Migration] Cannot connect to MongoDB. Set MONGODB_URI in server/.env');
    process.exitCode = 1;
    return;
  }

  try {
    const unownedAcknowledged = await Report.updateMany(
      { status: 'acknowledged', acknowledgedBy: null },
      { $set: { status: 'pending' } }
    );
    const acknowledged = await Report.updateMany(
      { status: 'acknowledged', acknowledgedBy: { $ne: null } },
      { $set: { status: 'coordinating' } }
    );
    const verified = await Report.updateMany(
      { status: 'verified' },
      { $set: { status: 'pending' } }
    );
    const enRoute = await Report.updateMany(
      { status: 'en_route' },
      { $set: { status: 'in_progress' } }
    );
    const onScene = await Report.updateMany(
      { status: 'on_scene' },
      { $set: { status: 'in_progress' } }
    );

    console.log('[Workflow Migration] Updated statuses:', {
      unownedAcknowledged: unownedAcknowledged.modifiedCount,
      acknowledged: acknowledged.modifiedCount,
      verified: verified.modifiedCount,
      enRoute: enRoute.modifiedCount,
      onScene: onScene.modifiedCount,
    });
  } finally {
    await mongoose.disconnect();
  }
}

migrateReportWorkflow().catch((error) => {
  console.error('[Workflow Migration] Failed:', error.message);
  process.exitCode = 1;
});
