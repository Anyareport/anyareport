import { GoogleGenerativeAI } from '@google/generative-ai';

// ASSUMPTION: Unified category list reconciles two manuscript lists
const VALID_CATEGORIES = [
  'Public Concerns',
  'Blotter Cases',
  'Emergency Situations',
  'Infrastructure Damage',
  'Health and Sanitation',
  'Environmental',
];

export async function classifyReport(description, imageBuffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('your-gemini')) {
    return { category: null, error: 'classification_unavailable' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Classify this barangay incident report into exactly one of these categories: ${VALID_CATEGORIES.join(', ')}.
Respond with ONLY the category name, nothing else.

Description: ${description}`;

    const parts = [{ text: prompt }];
    if (imageBuffer && mimeType) {
      parts.push({
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType,
        },
      });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text().trim();
    const matched = VALID_CATEGORIES.find(
      (c) => c.toLowerCase() === text.toLowerCase()
    );

    return { category: matched || text, error: null };
  } catch (err) {
    console.error('[Gemini] Classification failed:', err.message);
    return { category: null, error: 'classification_unavailable' };
  }
}

export { VALID_CATEGORIES };
