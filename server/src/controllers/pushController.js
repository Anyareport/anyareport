import PushToken from '../models/PushToken.js';

export async function registerPushToken(req, res) {
  const { token } = req.body || {};
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
    return res.status(400).json({ error: 'A valid push token is required' });
  }

  await PushToken.findOneAndUpdate(
    { token },
    { firebaseUid: req.firebaseUser.uid, token, userAgent: req.get('user-agent') || '' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return res.status(204).send();
}

export async function removePushToken(req, res) {
  const { token } = req.body || {};
  if (typeof token !== 'string') return res.status(400).json({ error: 'A valid push token is required' });
  await PushToken.deleteOne({ token, firebaseUid: req.firebaseUser.uid });
  return res.status(204).send();
}
