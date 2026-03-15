/** 學生名單「選修語言」維度之選項，存於 localStorage，與系統設定共用 */

export const LANGUAGE_OPTIONS_KEY = 'edutrack_language_options';
export const DEFAULT_LANGUAGE_OPTIONS = ['閩南語', '客家語', '原住民族語', '新住民語', '手語', '無／未選'];

export function loadLanguageOptions(): string[] {
  try {
    const raw = localStorage.getItem(LANGUAGE_OPTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [...DEFAULT_LANGUAGE_OPTIONS];
}

export function saveLanguageOptions(options: string[]): void {
  localStorage.setItem(LANGUAGE_OPTIONS_KEY, JSON.stringify(options));
}
