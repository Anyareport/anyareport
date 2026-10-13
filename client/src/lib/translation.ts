import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';
import { api } from './api';

const MAX_BATCH = 20;
const MAX_TEXT_LENGTH = 2000;
const BATCH_DELAY_MS = 40;
const STAFF_ROLES = ['tanod', 'responder'];

interface Pending {
  text: string;
  resolve: (value: string | null) => void;
  reject: (error: unknown) => void;
}

let queue: Pending[] = [];
let timer: number | undefined;

async function flush() {
  timer = undefined;
  const batches = queue.splice(0);
  for (let i = 0; i < batches.length; i += MAX_BATCH) {
    const chunk = batches.slice(i, i + MAX_BATCH);
    try {
      const { translations } = await api.post<{ translations: (string | null)[] }>(
        '/api/reports/translate',
        { texts: chunk.map((item) => item.text), lang: 'fil' }
      );
      chunk.forEach((item, index) => item.resolve(translations[index] ?? null));
    } catch (error) {
      chunk.forEach((item) => item.reject(error));
    }
  }
}

// Collects every text requested within a few milliseconds into one API call,
// so a list of 20 incident cards makes one request, not 20.
export function requestTranslation(text: string): Promise<string | null> {
  if (!text.trim() || text.length > MAX_TEXT_LENGTH) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    queue.push({ text, resolve, reject });
    if (timer === undefined) timer = window.setTimeout(flush, BATCH_DELAY_MS);
  });
}

export function useCanTranslate() {
  const { role } = useAuth();
  const { lang } = useLang();
  return lang === 'fil' && STAFF_ROLES.includes(role || '');
}

/**
 * Manual translation of free text (descriptions, AI summaries, resolution
 * notes) for tanods and responders who use the app in Filipino. Translation
 * starts automatically when Filipino is selected. Always returns a string per input:
 * the translation when available, otherwise the original.
 */
export function useTranslatedTexts(sources: (string | null | undefined)[]) {
  const canTranslate = useCanTranslate();
  // Selecting Filipino translates automatically; switching back to English stops it.
  const enabled = canTranslate;
  const [showOriginal, setShowOriginal] = useState(false);

  const queries = useQueries({
    queries: sources.map((source) => {
      const text = source?.trim() || '';
      return {
        queryKey: ['translation', 'fil', text],
        queryFn: () => requestTranslation(text),
        enabled: enabled && text.length > 0,
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60,
        retry: 1,
      };
    }),
  });

  const translations = queries.map((query) => query.data ?? null);
  const hasTranslation = enabled && translations.some(Boolean);

  return {
    texts: sources.map((source, index) =>
      enabled && !showOriginal && translations[index] ? translations[index] : source || ''
    ),
    canTranslate,
    requested: enabled,
    retry: () => queries.forEach((query) => query.isError && query.refetch()),
    loading: enabled && queries.some((query) => query.isLoading),
    failed: enabled && !hasTranslation && queries.some((query) => query.isError),
    hasTranslation,
    showOriginal,
    toggleOriginal: () => setShowOriginal((value) => !value),
  };
}