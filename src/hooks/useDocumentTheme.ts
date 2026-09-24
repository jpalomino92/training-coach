/* Aplica data-theme y data-day en <html>.
   'auto' se resuelve con matchMedia('(prefers-color-scheme: dark)') y escucha cambios. */
import { useEffect, useState } from 'react';
import type { DayColor, ThemePref } from '../domain/types';

const query = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

export function useResolvedTheme(pref: ThemePref): 'light' | 'dark' {
  const [systemDark, setSystemDark] = useState(() => !!query()?.matches);
  useEffect(() => {
    const mq = query();
    if (!mq) return;
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return pref === 'auto' ? (systemDark ? 'dark' : 'light') : pref;
}

export function useDocumentTheme(pref: ThemePref, day: DayColor) {
  const theme = useResolvedTheme(pref);
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = theme;
    el.dataset.day = day;
    el.style.colorScheme = theme;
    const bg = getComputedStyle(el).getPropertyValue('--bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || (theme === 'dark' ? '#111419' : '#EDEFEB'));
  }, [theme, day]);
  return theme;
}
