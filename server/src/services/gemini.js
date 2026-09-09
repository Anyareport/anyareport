import { GoogleGenerativeAI } from "@google/generative-ai";

// ASSUMPTION: Unified category list reconciles two manuscript lists
const VALID_CATEGORIES = [
  "Public Concerns",
  "Blotter Cases",
  "Emergency Situations",
  "Infrastructure Damage",
  "Health and Sanitation",
  "Environmental",
];

const SUBCATEGORY_MAP = {
  "Public Concerns": ["Sanitation", "Infrastructure"],
  "Blotter Cases": ["Civil", "Criminal"],
  "Emergency Situations": ["Public", "Private"],
  "Infrastructure Damage": ["Roads", "Buildings", "Utilities"],
  "Health and Sanitation": ["Waste", "Water", "Disease"],
  Environmental: ["Flooding", "Pollution", "Deforestation"],
};

const VALID_SEVERITIES = ["Low", "Medium", "High", "Critical"];

export async function classifyReport(description, imageBuffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("your-gemini")) {
    return {
      category: null,
      subcategory: null,
      severity: null,
      error: "classification_unavailable",
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

    const prompt = `You are classifying a barangay incident report. Respond with ONLY a valid JSON object — no markdown, no extra text.

Categories and their subcategories:
${Object.entries(SUBCATEGORY_MAP)
  .map(([cat, subs]) => `- ${cat}: ${subs.join(", ")}`)
  .join("\n")}

Severity levels: ${VALID_SEVERITIES.join(", ")}

Return this exact shape:
{"category":"<one of the categories above>","subcategory":"<matching subcategory>","severity":"<Low|Medium|High|Critical>"}

Description: ${description}`;

    const parts = [{ text: prompt }];
    if (imageBuffer && mimeType) {
      parts.push({
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType,
        },
      });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text().trim();

    // Strip optional markdown code fences the model may add
    const jsonText = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(jsonText);

    const category =
      VALID_CATEGORIES.find(
        (c) => c.toLowerCase() === (parsed.category || "").toLowerCase(),
      ) || parsed.category;

    const validSubs = SUBCATEGORY_MAP[category] || [];
    const subcategory =
      validSubs.find(
        (s) => s.toLowerCase() === (parsed.subcategory || "").toLowerCase(),
      ) || parsed.subcategory;

    const severity =
      VALID_SEVERITIES.find(
        (s) => s.toLowerCase() === (parsed.severity || "").toLowerCase(),
      ) || "Low";

    return { category, subcategory, severity, error: null };
  } catch (err) {
    console.error("[Gemini] Classification failed:", err.message);
    return {
      category: null,
      subcategory: null,
      severity: null,
      error: "classification_unavailable",
    };
  }
}

export { VALID_CATEGORIES };
