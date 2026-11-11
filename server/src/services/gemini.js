import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  SUBCATEGORY_MAP,
  VALID_CATEGORIES,
  VALID_SEVERITIES,
} from './reportClassification.js';

function getValidImageFiles(files) {
  if (!Array.isArray(files)) return [];
  return files.filter((file) => file?.buffer && file?.mimetype);
}

export function getClassificationInputMode(description, files) {
  const hasText = typeof description === 'string' && description.trim().length > 0;
  const hasImages = getValidImageFiles(files).length > 0;

  if (hasText && hasImages) return 'text and photos';
  if (hasImages) return 'photos only';
  return 'text only';
}

export async function classifyReport(description, files) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('your-gemini')) {
    return {
      category: null,
      subcategory: null,
      severity: null,
      title: null,
      summary: null,
      error: 'classification_unavailable',
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite',
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    });

    const imageFiles = getValidImageFiles(files);
    const inputMode = getClassificationInputMode(description, imageFiles);
    const inputGuidance =
      inputMode === 'text and photos'
        ? 'Use both the written description and attached photos as evidence. Consider them together, and do not invent details that neither supports.'
        : inputMode === 'photos only'
          ? 'There is no written description. Classify the incident using only the attached photos; do not assume details that are not visible.'
          : 'There are no attached photos. Classify the incident using only the written description.';
    const prompt = `You are classifying an incident report for Barangay Don Mariano Marcos. Respond with ONLY a valid JSON object.

INPUT MODE: ${inputMode}
${inputGuidance}

CATEGORIES:
- Public Concerns: everyday community problems that need attention but not an urgent response.
  - Sanitation: garbage, animal waste, pests, or stray/wild animal sightings when nobody is hurt or threatened; also cleanliness and environmental health issues.
  - Infrastructure: damaged roads, drainage, streetlights, or other public facilities.
- Blotter Cases: disputes or offenses between people that need to be recorded or mediated.
  - Civil: neighbor disputes, unpaid debts, or noise complaints.
  - Criminal: theft, physical fights, threats, or vandalism.
- Emergency Situations: only an immediate danger or active harm requiring responders now, such as a fire, medical crisis, vehicular accident, or dangerous flooding.
  - Public: the emergency affects a public place or wider community.
  - Private: the emergency involves a specific person or household.

RULES:
- An unusual-looking or potentially unsafe situation is not automatically an emergency.
- An animal sighting is Public Concerns / Sanitation unless the animal has attacked someone or is actively threatening people.
- When unsure between categories, choose the less urgent category.
- Emergency Situations must not have Low severity.

Severity levels:
- Low: minor issue, nobody at risk, can wait several days.
- Medium: should be handled within a day; minor risk or inconvenience.
- High: possible harm to people or property; needs a response within hours.
- Critical: life-threatening or actively spreading danger that needs an immediate response.

Return this exact shape:
{"category":"<one of the categories above>","subcategory":"<matching subcategory>","severity":"<Low|Medium|High|Critical>","title":"<concise incident title, 3-8 words>","summary":"<1-3 sentence brief synthesized description of the incident>"}

For "title": always write a neutral, factual headline in simple English, even when the description is in another language. Translate its meaning when needed, then rewrite it as a concise third-person incident headline in 3-8 words. Use sentence case: capitalize the first word and proper nouns, but do not capitalize every word. Preserve acronyms. Do not copy the description verbatim or use the reporter's first-person wording. Do not begin a title with "Reported" just because the incident was submitted as a report; use it only when the incident itself is uncertain or alleged. Do not add details or judgments that the user did not provide, and do not end the title with a period. Example: "Napilitan akong sumali sa misa" becomes "Pressure to attend Mass".

For "summary": synthesize a concise 1-3 sentence incident description based only on the available input described above. Use objective, factual language suitable for barangay officials.

Written description: ${description?.trim() || '(none provided)'}`;

    const parts = [{ text: prompt }];

    // Add all images (max 3)
    for (const file of imageFiles) {
      parts.push({
        inlineData: {
          data: file.buffer.toString('base64'),
          mimeType: file.mimetype,
        },
      });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text().trim();

    // Strip optional markdown code fences the model may add
    const jsonText = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    const parsed = JSON.parse(jsonText);

    const parsedCategory = typeof parsed.category === 'string' ? parsed.category.toLowerCase() : '';
    const category = VALID_CATEGORIES.find(
      (candidate) => candidate.toLowerCase() === parsedCategory
    );
    const parsedSubcategory =
      typeof parsed.subcategory === 'string' ? parsed.subcategory.toLowerCase() : '';
    const subcategory = category
      ? SUBCATEGORY_MAP[category].find((candidate) => candidate.toLowerCase() === parsedSubcategory)
      : undefined;
    const parsedSeverity = typeof parsed.severity === 'string' ? parsed.severity.toLowerCase() : '';
    const severity = VALID_SEVERITIES.find(
      (candidate) => candidate.toLowerCase() === parsedSeverity
    );

    if (
      !category ||
      !subcategory ||
      !severity ||
      (category === 'Emergency Situations' && severity === 'Low')
    ) {
      return {
        category: null,
        subcategory: null,
        severity: null,
        title: null,
        summary: null,
        error: 'classification_unavailable',
      };
    }

    const title =
      typeof parsed.title === 'string' && parsed.title.trim().length > 0
        ? parsed.title.trim().replace(/\s+/g, ' ').split(' ').slice(0, 8).join(' ')
        : null;
    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : null;

    return { category, subcategory, severity, title, summary, error: null };
  } catch (err) {
    console.error('[Gemini] Classification failed:', err.message);
    return {
      category: null,
      subcategory: null,
      severity: null,
      title: null,
      summary: null,
      error: 'classification_unavailable',
    };
  }
}

export async function analyzeHeatmapRisk(zones) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('your-gemini')) {
    return { error: 'analysis_unavailable' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite',
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    });
    const prompt = `You are a barangay safety decision-support analyst. Analyze these incident counts by purok and return ONLY valid JSON.
Do not invent incidents or claim certainty. Risk level must be Low, Medium, High, or Critical.
Return exactly: {"overallSummary":"<1-2 sentences>","riskZones":[{"purok":"<name>","riskLevel":"<level>","rationale":"<brief evidence-based reason>","recommendation":"<2-4 sentences with prioritized preventive actions, suggested timeframe, responsible responder or office, and what should be monitored>"}]}
Include every purok in the input, ordered highest risk first.
Recommendations must be practical and proportionate to the evidence. Mention relevant actions such as inspection, cleanup, lighting or infrastructure checks, community advisories, patrol coordination, referral, or emergency escalation only when supported by the incident categories, severity, and status. Do not prescribe medical, legal, or disciplinary decisions.
Use short sentences and common words that barangay staff and residents can easily understand. Avoid uncommon words, technical terms, jargon, abbreviations, and formal phrases; say "check the area" instead of "conduct an assessment" and "tell residents" instead of "issue a public advisory."

Incident data:
${JSON.stringify(zones)}`;
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(
      result.response
        .text()
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()
    );
    if (
      typeof parsed.overallSummary !== 'string' ||
      !Array.isArray(parsed.riskZones) ||
      parsed.riskZones.some(
        (zone) =>
          typeof zone?.purok !== 'string' ||
          !['Low', 'Medium', 'High', 'Critical'].includes(zone.riskLevel) ||
          typeof zone.rationale !== 'string' ||
          typeof zone.recommendation !== 'string'
      )
    ) {
      return { error: 'analysis_unavailable' };
    }
    return {
      overallSummary: parsed.overallSummary.trim(),
      riskZones: parsed.riskZones.map((zone) => ({
        purok: zone.purok.trim(),
        riskLevel: zone.riskLevel,
        rationale: zone.rationale.trim(),
        recommendation: zone.recommendation.trim(),
      })),
      error: null,
    };
  } catch (err) {
    console.error('[Gemini] Heatmap risk analysis failed:', err.message);
    return { error: 'analysis_unavailable' };
  }
}

export async function analyzeAnalyticsInsights(metrics) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('your-gemini')) {
    return { error: 'analysis_unavailable' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite',
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    });
    const prompt = `You are a barangay safety decision-support analyst. Review the aggregated incident analytics and return ONLY valid JSON.
Use only the supplied counts. Do not invent incidents, claim certainty, or infer causes.
Return exactly: {"overallSummary":"<1-2 short sentences>","recommendations":[{"title":"<short action title>","evidence":"<specific supporting counts>","recommendation":"<one or two practical next steps>"}]}
Return no more than 3 recommendations. Prioritize urgent open cases, notable severity or category patterns, and areas with the most reports. Always state the supplied resolved and endorsed counts in the summary. If the data does not support a recommendation, return fewer recommendations rather than guessing.
Use plain, friendly language. Recommendations are advisory; do not prescribe medical, legal, or disciplinary decisions.

Aggregated analytics:
${JSON.stringify(metrics)}`;
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(
      result.response
        .text()
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()
    );
    if (
      typeof parsed.overallSummary !== 'string' ||
      !parsed.overallSummary.trim() ||
      !Array.isArray(parsed.recommendations) ||
      parsed.recommendations.some(
        (item) =>
          typeof item?.title !== 'string' ||
          !item.title.trim() ||
          typeof item.evidence !== 'string' ||
          !item.evidence.trim() ||
          typeof item.recommendation !== 'string' ||
          !item.recommendation.trim()
      )
    ) {
      return { error: 'analysis_unavailable' };
    }

    return {
      overallSummary: parsed.overallSummary.trim(),
      recommendations: parsed.recommendations.slice(0, 3).map((item) => ({
        title: item.title.trim(),
        evidence: item.evidence.trim(),
        recommendation: item.recommendation.trim(),
      })),
      error: null,
    };
  } catch (err) {
    console.error('[Gemini] Analytics insights failed:', err.message);
    return { error: 'analysis_unavailable' };
  }
}

export { VALID_CATEGORIES };
