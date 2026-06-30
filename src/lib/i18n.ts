// Lightweight i18n: loads translations client-side, stores preference in localStorage.
// Full next-intl middleware setup is intentionally avoided to keep the build simple.

export const LOCALES = ["en", "zh", "es", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
  fr: "Français",
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  zh: "🇨🇳",
  es: "🇪🇸",
  fr: "🇫🇷",
};

type Messages = Record<string, Record<string, string>>;

const messageCache: Partial<Record<Locale, Messages>> = {};

export async function loadMessages(locale: Locale): Promise<Messages> {
  if (messageCache[locale]) return messageCache[locale]!;
  try {
    const mod = await import(`./messages/${locale}.json`);
    messageCache[locale] = mod.default as Messages;
    return mod.default as Messages;
  } catch {
    // Fallback to English
    if (locale !== "en") return loadMessages("en");
    return {};
  }
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem("agentmark.locale");
  if (stored && LOCALES.includes(stored as Locale)) return stored as Locale;
  // Auto-detect from browser
  const nav = window.navigator.language.slice(0, 2).toLowerCase();
  if (LOCALES.includes(nav as Locale)) return nav as Locale;
  return "en";
}

export function setStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("agentmark.locale", locale);
}

// Simple translation function: t("sidebar.dashboard") -> "Dashboard"
export function translate(messages: Messages, key: string): string {
  const parts = key.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : key;
}
