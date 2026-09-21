import User from '../models/User.js';

export async function getUsernameByUid(firebaseUid) {
  const user = await User.findOne({ firebaseUid }).select('name').lean();
  return user?.name ?? null;
}