import { writable, derived } from 'svelte/store';

const STORAGE_KEY = 'partygame.locale';

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export const locale = writable<string>('en');

const messages = writable<Record<string, string>>({});

async function loadLocale(l: string) {
  try {
    const mod = await import(`../locales/${l}.json`);
    messages.set(mod.default ?? mod);
  } catch (e) {
    console.warn('Failed to load locale', l, e);
    messages.set({});
  }
}

// initialize only in browser to avoid SSR errors
if (isBrowser()) {
  const initial = window.localStorage.getItem(STORAGE_KEY) || 'en';
  locale.set(initial);
  loadLocale(initial);

  locale.subscribe((l) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch (e) {
      // ignore quota errors
    }
    loadLocale(l);
  });
}

export const translate = derived(messages, ($messages) => {
  return (key: string) => $messages[key] ?? key;
});

export const availableLocales = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'zh-CN', label: '中文（简体）' },
  { value: 'zh-TW', label: '中文（繁體）' }
];
