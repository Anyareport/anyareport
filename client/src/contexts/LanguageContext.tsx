import { createContext, useContext, useState, type ReactNode } from 'react';
import { labels, type LabelKey, type Lang } from '../i18n/labels';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: LabelKey) => string;
}

const LANGUAGE_STORAGE_KEY = 'anyareport-language';
const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguage(): Lang {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === 'fil' ? 'fil' : 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLanguage] = useState<Lang>(readStoredLanguage);

  const setLang = (nextLang: Lang) => {
    setLanguage(nextLang);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
    } catch {
      // Keep the in-memory selection if browser storage is unavailable.
    }
  };

  const t = (key: LabelKey) => labels[key]?.[lang] ?? labels[key].en;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
}

export function useLang() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLang must be used inside LanguageProvider');
  return context;
}
