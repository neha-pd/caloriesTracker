export function cleanModelText(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .replace(/<\|[^>]*\|>/g, "")
    .replace(/^\s*assistant(?:\s*:\s*|\s*\n)/i, "")
    .trim();
}
export function assistantText(
  messages: readonly { role: string; content?: unknown }[],
) {
  const content = [...messages]
    .reverse()
    .find((m) => m.role === "assistant")?.content;
  return cleanModelText(
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.filter((p) => typeof p === "string").join(" ")
        : "",
  );
}
export function parseFoodSuggestions(response: string): string[] {
  const text = cleanModelText(response)
    .replace(/```(?:json)?/gi, "")
    .trim();
  const lines = text
    .split(/\n|,|;/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (lines.length > 5 && new Set(lines).size < lines.length / 2) return [];
  let values: unknown[] = [];
  for (const candidate of [
    text,
    text.match(/\[[\s\S]*\]/)?.[0],
    text.match(/\{[\s\S]*\}/)?.[0],
  ]) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed === null || typeof parsed !== "object") return [];
      const list = Array.isArray(parsed)
        ? parsed
        : (parsed.foods ?? parsed.items ?? parsed.suggestions);
      if (Array.isArray(list)) {
        values = list;
        break;
      }
      return [];
    } catch {}
  }
  if (
    !values.length &&
    !/^(?:\[\]|no food|none|i (?:cannot|can't)|unable to)/i.test(text)
  ) {
    const quoted = [...text.matchAll(/["“]([^"”\n]{2,65})["”]/g)].map(
      (m) => m[1],
    );
    values = quoted.length
      ? quoted
      : text
          .split(/\n|,|;/)
          .map((v) => v.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ""));
  }
  return [
    ...new Set(
      values
        .map((v) =>
          typeof v === "string"
            ? v
            : v && typeof v === "object" && "name" in v
              ? String(v.name)
              : "",
        )
        .map((v) =>
          v
            .replace(/\*\*/g, "")
            .replace(
              /^(?:foods?|visible foods?|the image shows|i see)\s*:\s*/i,
              "",
            )
            .trim(),
        )
        .filter(
          (v) =>
            v.length >= 2 &&
            v.length <= 65 &&
            v.split(/\s+/).length <= 8 &&
            !/[{}\[\]]|\b(?:calories|kcal|cannot|sorry|identify|photo|image)\b/i.test(
              v,
            ),
        ),
    ),
  ].slice(0, 6);
}
export const foodPrompt =
  "What food is shown in this image? List up to four visible dishes, separated by commas. Do not include ingredients you cannot see. Do not estimate calories. If this is not food, answer NO FOOD.";
