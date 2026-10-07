/**
 * The real language spread across all 43 IOFS member states, deduplicated —
 * 15 languages cover every member, from Suriname's Dutch to Somalia's
 * Somali. Used to populate the page's language switcher.
 *
 * Multilingual members (e.g. Morocco: Arabic + French) are represented once
 * per language they speak, not once per country — the switcher lets a
 * reader pick the language itself, not the country.
 *
 * `flag` is the real flag of one representative country for that language
 * (an actual IOFS member wherever one speaks it) — the same country-flag
 * convention Google Translate's own widget uses, since a language has no
 * flag of its own.
 */

export interface IofsLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  /** RTL script, for dir="rtl" on translated text. */
  rtl?: boolean;
}

export const IOFS_LANGUAGES: IofsLanguage[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦", rtl: true },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇸🇳" },
  { code: "ur", name: "Urdu", nativeName: "اردو", flag: "🇵🇰", rtl: true },
  { code: "fa", name: "Persian / Dari", nativeName: "فارسی", flag: "🇮🇷", rtl: true },
  { code: "ps", name: "Pashto", nativeName: "پښتو", flag: "🇦🇫", rtl: true },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇧🇩" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "kk", name: "Kazakh", nativeName: "Қазақша", flag: "🇰🇿" },
  { code: "uz", name: "Uzbek", nativeName: "Oʻzbekcha", flag: "🇺🇿" },
  { code: "tg", name: "Tajik", nativeName: "Тоҷикӣ", flag: "🇹🇯" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇲🇿" },
  { code: "so", name: "Somali", nativeName: "Soomaali", flag: "🇸🇴" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇸🇷" },
];

const BY_CODE = new Map(IOFS_LANGUAGES.map((l) => [l.code, l]));

export function iofsLanguage(code: string): IofsLanguage | undefined {
  return BY_CODE.get(code);
}

export const DEFAULT_LANGUAGE = "en";
