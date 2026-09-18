import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Category from '../models/Category.js';

const REMOVE = ['Environmental', 'Health and Sanitation', 'Infrastructure Damage'];

async function clean() {
  const connected = await connectDB();
  if (!connected) {
    console.error('[Clean] Cannot connect to MongoDB. Check MONGODB_URI in server/.env');
    process.exit(1);
  }

  const result = await Category.deleteMany({ name: { $in: REMOVE } });
  console.log(`[Clean] Deleted ${result.deletedCount} categor${result.deletedCount === 1 ? 'y' : 'ies'}:`);
  REMOVE.forEach((n) => console.log(`  - ${n}`));

  const remaining = await Category.find({}, 'name').lean();
  console.log('[Clean] Remaining categories:');
  remaining.forEach((c) => console.log(`  ✓ ${c.name}`));

  await mongoose.disconnect();
}

clean().catch((err) => {
  console.error('[Clean] Failed:', err);
  process.exit(1);
});
