import {
  MAX_TEXTS,
  MAX_TEXT_LENGTH,
  SUPPORTED_LANGS,
  translateTexts,
} from '../services/translate.js';

export async function translateHandler(req, res) {
  const { texts, lang = 'fil' } = req.body || {};

  if (!Object.hasOwn(SUPPORTED_LANGS, lang)) {
    return res.status(400).json({ code: 'UNSUPPORTED_LANGUAGE', error: 'Unsupported language' });
  }
  if (
    !Array.isArray(texts) ||
    texts.length === 0 ||
    texts.length > MAX_TEXTS ||
    texts.some((text) => typeof text !== 'string' || text.length > MAX_TEXT_LENGTH)
  ) {
    return res.status(400).json({
      code: 'INVALID_TRANSLATION_REQUEST',
      error: `Send 1-${MAX_TEXTS} texts of at most ${MAX_TEXT_LENGTH} characters`,
    });
  }

  const translations = await translateTexts(texts, lang);
  res.json({ lang, translations });
}