export type Theme = 'dark' | 'light';
const K = 'paluwagan-theme';
export const getTheme = (): Theme => { try { return localStorage.getItem(K) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } };
export const applyTheme = (t: Theme) => { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem(K, t); } catch { /* ignore */ } };
