import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Report from '../models/Report.js';
import Category from '../models/Category.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';

// ASSUMPTION: Unified category list reconciles two manuscript lists
const CATEGORIES = [
  { name: 'Public Concerns', committee: 'Peace and Order', description: 'General public safety concerns' },
  { name: 'Blotter Cases', committee: 'Peace and Order', description: 'Formal blotter entries' },
  { name: 'Emergency Situations', committee: null, description: 'Medical, fire, and other emergencies' },
  { name: 'Infrastructure Damage', committee: 'Infrastructure', description: 'Roads, bridges, public facilities' },
  { name: 'Health and Sanitation', committee: 'Health and Sanitation', description: 'Health hazards and sanitation issues' },
  { name: 'Environmental', committee: 'Environmental Protection', description: 'Environmental concerns and pollution' },
];

const BARANGAY_CENTER = [121.3708, 16.4833]; // Don Mariano Marcos, Nueva Vizcaya approx

const SEED_USERS = [
  { firebaseUid: 'seed-resident-1', email: 'juan.delacruz@example.com', name: 'Juan Dela Cruz', phone: '09171234567', role: 'resident', address: 'Purok 1, Brgy. Don Mariano Marcos' },
  { firebaseUid: 'seed-resident-2', email: 'maria.santos@example.com', name: 'Maria Santos', phone: '09181234567', role: 'resident', address: 'Purok 2, Brgy. Don Mariano Marcos' },
  { firebaseUid: 'seed-admin-1', email: 'admin@anyareport.local', name: 'System Admin', phone: '09191234567', role: 'admin', address: 'Barangay Hall' },
  { firebaseUid: 'seed-captain-1', email: 'captain@anyareport.local', name: 'Barangay Captain', phone: '09201234567', role: 'captain', address: 'Barangay Hall' },
  { firebaseUid: 'seed-secretary-1', email: 'secretary@anyareport.local', name: 'Barangay Secretary', phone: '09211234567', role: 'secretary', address: 'Barangay Hall' },
  { firebaseUid: 'seed-kagawad-po', email: 'kagawad.po@anyareport.local', name: 'Kagawad Peace & Order', phone: '09221234567', role: 'kagawad', committee: 'Peace and Order', address: 'Barangay Hall' },
  { firebaseUid: 'seed-kagawad-infra', email: 'kagawad.infra@anyareport.local', name: 'Kagawad Infrastructure', phone: '09231234567', role: 'kagawad', committee: 'Infrastructure', address: 'Barangay Hall' },
  { firebaseUid: 'seed-tanod-1', email: 'tanod@anyareport.local', name: 'Tanod Officer', phone: '09241234567', role: 'tanod', address: 'Barangay Hall' },
  { firebaseUid: 'seed-responder-1', email: 'responder@anyareport.local', name: 'Emergency Responder', phone: '09251234567', role: 'responder', address: 'Barangay Hall' },
];

const REPORT_TEMPLATES = [
  { category: 'Public Concerns', description: 'Loud karaoke party past midnight at Purok 3', status: 'pending', offset: [0.002, 0.001] },
  { category: 'Blotter Cases', description: 'Neighbor dispute over property boundary fence', status: 'verified', offset: [-0.001, 0.002] },
  { category: 'Emergency Situations', description: 'Elderly resident collapsed, needs medical assistance', status: 'en_route', offset: [0.003, -0.001] },
  { category: 'Infrastructure Damage', description: 'Large pothole on main barangay road causing accidents', status: 'pending', offset: [-0.002, -0.002] },
  { category: 'Health and Sanitation', description: 'Open drainage clogged, stagnant water breeding mosquitoes', status: 'verified', offset: [0.001, 0.003] },
  { category: 'Environmental', description: 'Illegal dumping of garbage near the creek', status: 'on_scene', offset: [-0.003, 0.001] },
  { category: 'Public Concerns', description: 'Stray dogs causing concern near elementary school', status: 'resolved', offset: [0.004, 0.002] },
  { category: 'Infrastructure Damage', description: 'Broken streetlight on path to barangay hall', status: 'pending', offset: [-0.001, -0.003] },
  { category: 'Emergency Situations', description: 'Grass fire reported near rice fields', status: 'resolved', offset: [0.002, -0.002] },
  { category: 'Health and Sanitation', description: 'Uncollected garbage for over a week in Purok 4', status: 'flagged', offset: [0.001, -0.001] },
  { category: 'Environmental', description: 'Smoke from burning plastics affecting residents', status: 'verified', offset: [-0.002, 0.003] },
  { category: 'Blotter Cases', description: 'Theft of motorcycle parts reported', status: 'pending', offset: [0.003, 0.001] },
  { category: 'Public Concerns', description: 'Suspicious individuals loitering near chapel at night', status: 'verified', offset: [-0.003, -0.001] },
  { category: 'Infrastructure Damage', description: 'Damaged footbridge over irrigation canal', status: 'en_route', offset: [0.001, 0.002] },
  { category: 'Health and Sanitation', description: 'Contaminated water source reported by residents', status: 'on_scene', offset: [-0.001, 0.001] },
  { category: 'Environmental', description: 'Trees being cut without permit near watershed', status: 'pending', offset: [0.002, 0.003] },
  { category: 'Emergency Situations', description: 'Child missing, last seen near basketball court', status: 'verified', offset: [-0.002, 0.002] },
  { category: 'Public Concerns', description: 'Illegal gambling operation reported', status: 'resolved', offset: [0.003, -0.003] },
];

function getCommittee(categoryName) {
  const cat = CATEGORIES.find((c) => c.name === categoryName);
  return cat?.committee || null;
}

async function seed() {
  const connected = await connectDB();
  if (!connected) {
    console.error('[Seed] Cannot connect to MongoDB. Set MONGODB_URI in server/.env');
    process.exit(1);
  }

  console.log('[Seed] Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Report.deleteMany({}),
    Category.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);

  console.log('[Seed] Creating categories...');
  await Category.insertMany(CATEGORIES);

  console.log('[Seed] Creating users...');
  await User.insertMany(SEED_USERS.map((u) => ({ ...u, status: 'active', emailVerified: true })));

  console.log('[Seed] Creating reports...');
  const reports = [];
  for (let i = 0; i < REPORT_TEMPLATES.length; i++) {
    const t = REPORT_TEMPLATES[i];
    const submitter = SEED_USERS[i % 2].firebaseUid;
    const report = await Report.create({
      submittedBy: submitter,
      category: t.category,
      committee: getCommittee(t.category),
      description: t.description,
      photos: [],
      location: {
        type: 'Point',
        coordinates: [BARANGAY_CENTER[0] + t.offset[0], BARANGAY_CENTER[1] + t.offset[1]],
        address: `Purok ${(i % 4) + 1}, Brgy. Don Mariano Marcos`,
      },
      status: t.status,
      aiSuggestedCategory: t.category,
      verifiedBy: ['verified', 'en_route', 'on_scene', 'resolved'].includes(t.status)
        ? 'seed-secretary-1'
        : null,
      statusHistory: [{ status: 'pending', updatedBy: submitter }],
    });
    reports.push(report);
  }

  console.log('[Seed] Creating notifications...');
  const verifiedReports = reports.filter((r) => r.status !== 'pending' && r.status !== 'flagged');
  for (const report of verifiedReports.slice(0, 5)) {
    await Notification.create({
      recipientUid: 'seed-captain-1',
      recipientRole: 'captain',
      reportId: report._id,
      type: 'incident_verified',
      message: `Verified incident: ${report.category}`,
      urgent: report.category === 'Emergency Situations',
    });
    await Notification.create({
      recipientUid: 'seed-tanod-1',
      recipientRole: 'tanod',
      reportId: report._id,
      type: 'incident_verified',
      message: `Verified incident: ${report.category}`,
    });
  }

  console.log('[Seed] Creating audit logs...');
  for (const report of reports.slice(0, 8)) {
    await AuditLog.create({
      action: 'report_submitted',
      actorUid: report.submittedBy,
      reportId: report._id,
      ip: '127.0.0.1',
      userAgent: 'Seed Script',
      metadata: { category: report.category },
    });
  }

  console.log('[Seed] Done!');
  console.log(`  Categories: ${CATEGORIES.length}`);
  console.log(`  Users: ${SEED_USERS.length}`);
  console.log(`  Reports: ${reports.length}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
