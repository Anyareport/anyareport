import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Report from '../models/Report.js';
import ReportReferenceCounter from '../models/ReportReferenceCounter.js';
import { getNextReportReference } from '../services/reportReference.js';

const MISSING_REFERENCE = {
  $or: [
    { referenceNumber: { $exists: false } },
    { referenceNumber: null },
    { referenceNumber: '' },
  ],
};

async function migrateReportReferences() {
  const connected = await connectDB();
  if (!connected) {
    console.error(
      '[Report Reference Migration] Cannot connect to MongoDB. Set MONGODB_URI in server/.env'
    );
    process.exitCode = 1;
    return;
  }

  try {
    const existingReports = await Report.find({ referenceNumber: { $type: 'string' } })
      .select('referenceNumber')
      .lean();
    const maxSequenceByYear = new Map();

    for (const report of existingReports) {
      const match = /^AR-(\d{4})-(\d+)$/.exec(report.referenceNumber);
      if (!match) continue;

      const [, year, sequenceText] = match;
      const sequence = Number(sequenceText);
      maxSequenceByYear.set(year, Math.max(maxSequenceByYear.get(year) || 0, sequence));
    }

    for (const [year, sequence] of maxSequenceByYear) {
      await ReportReferenceCounter.updateOne(
        { _id: year },
        { $max: { sequence } },
        { upsert: true }
      );
    }

    const reportsToMigrate = await Report.find(MISSING_REFERENCE)
      .select('_id createdAt')
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    let migratedCount = 0;

    for (const report of reportsToMigrate) {
      const referenceNumber = await getNextReportReference(
        report.createdAt ? new Date(report.createdAt) : new Date()
      );
      const result = await Report.updateOne(
        { _id: report._id, ...MISSING_REFERENCE },
        { $set: { referenceNumber } }
      );
      migratedCount += result.modifiedCount;
    }

    await Report.collection.createIndex({ referenceNumber: 1 }, { unique: true, sparse: true });
    console.log(`[Report Reference Migration] Assigned references to ${migratedCount} reports.`);
  } finally {
    await mongoose.disconnect();
  }
}

migrateReportReferences().catch((error) => {
  console.error('[Report Reference Migration] Failed:', error.message);
  process.exitCode = 1;
});
