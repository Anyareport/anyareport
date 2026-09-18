import { GoogleGenerativeAI } from '@google/generative-ai';

// ASSUMPTION: Unified category list reconciles two manuscript lists
const VALID_CATEGORIES = ['Public Concerns', 'Blotter Cases', 'Emergency Situations'];

const SUBCATEGORY_MAP = {
  'Public Concerns': ['Sanitation', 'Infrastructure'],
  'Blotter Cases': ['Civil', 'Criminal'],
  'Emergency Situations': ['Public', 'Private'],
};

const VALID_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

export async function classifyReport(description, files) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('your-gemini')) {
    return {
      category: null,
      subcategory: null,
      severity: null,
      summary: null,
      error: 'classification_unavailable',
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

    const prompt = `You are classifying a barangay incident report. Respond with ONLY a valid JSON object — no markdown, no extra text.

Categories and their subcategories:
${Object.entries(SUBCATEGORY_MAP)
  .map(([cat, subs]) => `- ${cat}: ${subs.join(', ')}`)
  .join('\n')}

Severity levels: ${VALID_SEVERITIES.join(', ')}

Return this exact shape:
{"category":"<one of the categories above>","subcategory":"<matching subcategory>","severity":"<Low|Medium|High|Critical>","summary":"<1-3 sentence brief synthesized description of the incident>"}

For "summary": synthesize a concise 1-3 sentence incident description based on the user's description text and the attached image(s) (if any). Use objective, factual language suitable for barangay officials.

Description: ${description}`;

    const parts = [{ text: prompt }];

    // Add all images (max 3)
    if (Array.isArray(files)) {
      for (const file of files) {
        if (file.buffer && file.mimetype) {
          parts.push({
            inlineData: {
              data: file.buffer.toString('base64'),
              mimeType: file.mimetype,
            },
          });
        }
      }
    }

    const result = await model.generateContent(parts);
    const text = result.response.text().trim();

    // Strip optional markdown code fences the model may add
    const jsonText = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    const parsed = JSON.parse(jsonText);

    const category =
      VALID_CATEGORIES.find((c) => c.toLowerCase() === (parsed.category || '').toLowerCase()) ||
      parsed.category;

    const validSubs = SUBCATEGORY_MAP[category] || [];
    const subcategory =
      validSubs.find((s) => s.toLowerCase() === (parsed.subcategory || '').toLowerCase()) ||
      parsed.subcategory;

    const severity =
      VALID_SEVERITIES.find((s) => s.toLowerCase() === (parsed.severity || '').toLowerCase()) ||
      'Low';

    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : null;

    return { category, subcategory, severity, summary, error: null };
  } catch (err) {
    console.error('[Gemini] Classification failed:', err.message);
    return {
      category: null,
      subcategory: null,
      severity: null,
      summary: null,
      error: 'classification_unavailable',
    };
  }
}

export { VALID_CATEGORIES };
