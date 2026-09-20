import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const SYSTEM_PROMPT = `You are a professional nutrition analyst with expertise in food identification and portion estimation.
Analyze the food photo and respond ONLY with valid JSON — no markdown, no explanations, just raw JSON.

{
  "items": [
    {
      "name": "grilled chicken breast",
      "quantity": 1,
      "unit": "piece",
      "estimated_weight_g": 150,
      "confidence": 0.91
    }
  ],
  "overall_confidence": 0.88,
  "notes": "Optional note about the image"
}

Rules:
- Be specific (not "meat" → "grilled chicken breast"; not "drink" → "whole milk")
- Estimate weight in grams using visual references (plate size, hand size, utensils)
- confidence is 0.0–1.0 per item; lower if partially visible or ambiguous
- Include ALL visible food items including condiments, sides, and drinks
- If multiple candidates exist for one item, pick the most likely one`;
export async function analyzeImageWithGemini(imageUrl) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    // Fetch image and convert to base64
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mimeType = (response.headers.get('content-type') ?? 'image/jpeg');
    const result = await model.generateContent({
        contents: [{
                role: 'user',
                parts: [
                    { text: SYSTEM_PROMPT },
                    { inlineData: { mimeType, data: base64 } },
                ],
            }],
        generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            maxOutputTokens: 1024,
        },
    });
    const text = result.response.text().trim();
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
}
//# sourceMappingURL=gemini.js.map