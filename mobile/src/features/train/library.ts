import type { Language } from "./domain";
const files: Record<Language, () => Record<string, string[]>> = {
  en: () => require("./data/en.json"),
  hi: () => require("./data/hi.json"),
  es: () => require("./data/es.json"),
  fr: () => require("./data/fr.json"),
  it: () => require("./data/it.json"),
  tr: () => require("./data/tr.json"),
  ru: () => require("./data/ru.json"),
  zh: () => require("./data/zh.json"),
  ko: () => require("./data/ko.json"),
  pl: () => require("./data/pl.json"),
};
export async function loadInstructions(language: Language) {
  return files[language]();
}
