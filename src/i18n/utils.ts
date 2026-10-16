import { ui, type UIKey } from './ui';

export const languages = { en: 'EN', ja: '日本語', zh: '中文' } as const;
export type Lang = keyof typeof languages;
export const langs = Object.keys(languages) as Lang[];
export const defaultLang: Lang = 'en';

/** value for <html lang> */
export const htmlLang: Record<Lang, string> = { en: 'en', ja: 'ja', zh: 'zh-CN' };

export function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && (langs as string[]).includes(x);
}

export function useTranslations(lang: Lang) {
  return function t(key: UIKey, vars?: Record<string, string | number>): string {
    let s: string = (ui[lang] as Record<string, string>)[key] ?? ui[defaultLang][key];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
}

/** '/blog/' in `lang` -> '/blog/' (en, unprefixed), '/ja/blog/', '/zh/blog/' */
export function localePath(lang: Lang, path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return lang === defaultLang ? p : `/${lang}${p}`;
}

/** strip the locale prefix: '/ja/blog/' -> '/blog/' */
export function unlocalize(pathname: string): string {
  const m = pathname.match(/^\/(ja|zh)(\/.*|$)/);
  return m ? m[2] || '/' : pathname;
}

/** getStaticPaths for a page that exists in every language under [...locale] */
export function localeStaticPaths() {
  return langs.map((lang) => ({
    params: { locale: lang === defaultLang ? undefined : lang },
    props: { lang },
  }));
}
