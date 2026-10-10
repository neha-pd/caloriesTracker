import type { Language } from "./domain";
export async function loadInstructions(
  language: Language,
): Promise<Record<string, string[]>> {
  const r = await fetch(`/exercises/${language}.json`);
  if (!r.ok)
    throw Error(
      "This language is not downloaded yet. Connect once to load it.",
    );
  return r.json();
}
