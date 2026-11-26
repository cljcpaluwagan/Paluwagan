// Slows down password guessing on this device: 5 free tries, then 30s, 60s, 2min ... up to 15 min. (The server has its own rate limits too.)
export interface Lock { fails: number; until: number }
export const MAX_FREE = 5;
export const fresh = (): Lock => ({ fails: 0, until: 0 });
export function onFail(s: Lock, now: number): Lock {
  const fails = s.fails + 1;
  if (fails < MAX_FREE) return { fails, until: 0 };
  return { fails, until: now + Math.min(15 * 60000, 30000 * 2 ** (fails - MAX_FREE)) };
}
export const remainingSeconds = (s: Lock, now: number) => Math.max(0, Math.ceil((s.until - now) / 1000));
const K = 'paluwagan-lock';
export function loadLock(): Lock { try { return { ...fresh(), ...JSON.parse(localStorage.getItem(K) || '{}') }; } catch { return fresh(); } }
export function saveLock(s: Lock) { try { localStorage.setItem(K, JSON.stringify(s)); } catch { /* ignore */ } }
