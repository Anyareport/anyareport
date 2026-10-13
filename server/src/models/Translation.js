import mongoose from 'mongoose';

// Cache of machine translations, keyed by a hash of the source text.
// Editing a report changes its text hash, so stale translations are never served.
const translationSchema = new mongoose.Schema(
  {
    hash: { type: String, required: true },
    lang: { type: String, required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

translationSchema.index({ hash: 1, lang: 1 }, { unique: true });
// Drop cached translations after 180 days so the collection stays small.
translationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export default mongoose.model('Translation', translationSchema);