import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'nl' | 'en';

const LANG_STORAGE_KEY = 'lang';

const MESSAGES = {
  nl: {
    'intro.aria': 'Info',
    'intro.title': 'Kleine opmerking',
    'intro.line1':
      'Zoeken kan in het begin wat traag zijn. Dit komt omdat de app nog in testfase zit en op gratis services draait.',
    'intro.line2':
      'Krijg je niet meteen resultaten? Refresh even of wacht een minuutje - dan is de service waarschijnlijk aan het opstarten.',
    'intro.ok': 'Oké, begrepen',

    'server.aria': 'Server status',
    'server.title': 'Server status',
    'server.connecting': 'Verbinden met server...',
    'server.booting': 'Server is aan het opstarten...',
    'server.progress': 'Voortgang (indicatie): {percent}%',
    'server.note': 'Deze server draait op een gratis tier en kan even nodig hebben om op te starten.',
    'server.retry': 'Opnieuw proberen',

    'settings.aria': 'Instellingen',
    'settings.title': 'Instellingen',
    'settings.language.label': 'Taal',
    'settings.language.nl': 'Nederlands',
    'settings.language.en': 'Engels',

    'app.brand': 'MusicDiscovery',
    'app.openSettings': 'Instellingen',

    'home.title': 'Ontdek nieuwe artiesten',
    'home.subtitle': 'Typ een artiest die je leuk vindt en ontdek meteen nieuwe muziek om te beluisteren.',

    'search.label': 'Zoek naar een artiest',
    'search.placeholder': 'Bijvoorbeeld: Stromae',
    'search.idle': 'Begin met typen om artiesten te zoeken.',
    'search.loading': 'Resultaten laden…',
    'search.noResults': 'Geen artiesten gevonden voor "{query}".',

    'details.title': 'Artiestdetails',
    'details.empty': 'Selecteer een artiest om de details te bekijken.',

    'theme.label': 'Thema',
    'theme.dark': 'Donker',
    'theme.light': 'Licht',

    'background.label': 'Achtergrondanimatie',
    'background.on': 'Aan',
    'background.off': 'Uit'
  },
  en: {
    'intro.aria': 'Info',
    'intro.title': 'Quick note',
    'intro.line1':
      'Searching can be a bit slow at first. This is because the app is still in testing and runs on free services.',
    'intro.line2':
      'Not getting results right away? Refresh or wait a minute - the service is probably waking up.',
    'intro.ok': 'Got it',

    'server.aria': 'Server status',
    'server.title': 'Server status',
    'server.connecting': 'Connecting to server...',
    'server.booting': 'Server is starting up...',
    'server.progress': 'Progress (estimate): {percent}%',
    'server.note': 'This server runs on a free tier and can take a moment to wake up.',
    'server.retry': 'Retry now',

    'settings.aria': 'Settings',
    'settings.title': 'Settings',
    'settings.language.label': 'Language',
    'settings.language.nl': 'Dutch',
    'settings.language.en': 'English',

    'app.brand': 'MusicDiscovery',
    'app.openSettings': 'Settings',

    'home.title': 'Discover new artists',
    'home.subtitle': 'Type an artist you like and instantly discover new music to listen to.',

    'search.label': 'Search for an artist',
    'search.placeholder': 'For example: Stromae',
    'search.idle': 'Start typing to search for artists.',
    'search.loading': 'Loading results…',
    'search.noResults': 'No artists found for "{query}".',

    'details.title': 'Artist details',
    'details.empty': 'Select an artist to view the details.',

    'theme.label': 'Theme',
    'theme.dark': 'Dark',
    'theme.light': 'Light',

    'background.label': 'Background animation',
    'background.on': 'On',
    'background.off': 'Off'
  }
} as const;

export type MessageKey = keyof (typeof MESSAGES)['nl'];

type TemplateVars = Record<string, string | number | boolean | null | undefined>;

function normalizeLang(value: unknown): Lang {
  return value === 'en' ? 'en' : 'nl';
}

function detectBrowserLang(): Lang {
  if (typeof navigator === 'undefined') {
    return 'nl';
  }

  const raw = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
  if (raw.startsWith('en')) {
    return 'en';
  }

  return 'nl';
}

function readStoredLang(): Lang | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return normalizeLang(stored);
  } catch {
    return null;
  }
}

function writeStoredLang(lang: Lang) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // ignore
  }
}

function format(template: string, vars?: TemplateVars): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  });
}

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: TemplateVars) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const stored = readStoredLang();
  const [lang, setLangState] = useState<Lang>(() => stored ?? detectBrowserLang());

  const setLang = useCallback((next: Lang) => {
    const normalized = normalizeLang(next);
    setLangState(normalized);
    writeStoredLang(normalized);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: TemplateVars) => {
      const template = MESSAGES[lang]?.[key] ?? MESSAGES.nl[key] ?? key;
      return format(template, vars);
    },
    [lang]
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
