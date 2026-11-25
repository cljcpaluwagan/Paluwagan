import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Snapshot, User } from '../types';
import type { Repo } from '../data/repo';
import { DEMO_MODE } from '../config';
import { makeDemoRepo, DEMO_USERS } from '../data/demoRepo';
import { currentUser, makeSupabaseRepo, signOut } from '../data/supabaseRepo';
import { todayISO } from '../lib/dates';

export type Screen = 'login' | 'home' | 'payments' | 'collection' | 'schedule' | 'reports' | 'messages' | 'settings' | 'payoutSettings' | 'cycle' | 'members' | 'branding';
interface Ctx {
  brand: { logo: string | null; bg: string | null };
  user: User | null; snap: Snapshot | null; screen: Screen; today: string; busy: boolean; toast: string;
  go(s: Screen, reset?: boolean): void; back(): void;
  login(u: User): Promise<void>; logout(): Promise<void>;
  run(fn: (r: Repo) => Promise<void>, okMsg?: string): Promise<boolean>;
  notify(m: string): void; reload(): Promise<void>; nameOf(id: string): string;
}
const BKEY = 'paluwagan-branding';
const readBrand = (): { logo: string | null; bg: string | null } => { try { return JSON.parse(localStorage.getItem(BKEY) || '') || { logo: null, bg: null }; } catch { return { logo: null, bg: null }; } };
const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [stack, setStack] = useState<Screen[]>(['login']);
  const [busy, setBusy] = useState(false);
  const [brand, setBrand] = useState(readBrand);
  const [toast, setToast] = useState('');
  const [today, setToday] = useState(todayISO());
  const repo = useRef<Repo | null>(null);
  const timer = useRef<number>();

  const notify = useCallback((m: string) => { setToast(m); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(''), 3500); }, []);
  const reload = useCallback(async () => {
    if (!repo.current) return;
    try {
      const s = await repo.current.load(); setSnap(s); setToday(todayISO());
      const b = { logo: s.logo ?? null, bg: s.background ?? null }; setBrand(b);
      try { localStorage.setItem(BKEY, JSON.stringify(b)); } catch { /* too big or blocked: ignore */ }
    } catch (e: any) { notify(e.message || 'Could not load data'); }
  }, [notify]);

  const login = useCallback(async (u: User) => {
    repo.current = DEMO_MODE ? makeDemoRepo(u) : makeSupabaseRepo(u);
    setUser(u); setStack(['home']);
    if (DEMO_MODE) try { localStorage.setItem('paluwagan-demo-user', u.id); } catch { /* ignore */ }
    await reload();
  }, [reload]);
  const logout = useCallback(async () => {
    if (!DEMO_MODE) await signOut();
    try { localStorage.removeItem('paluwagan-demo-user'); } catch { /* ignore */ }
    repo.current = null; setUser(null); setSnap(null); setStack(['login']);
  }, []);

  useEffect(() => { // restore session
    (async () => {
      try {
        if (DEMO_MODE) { const id = localStorage.getItem('paluwagan-demo-user'); const u = DEMO_USERS.find(x => x.id === id); if (u) await login(u); }
        else await login(await currentUser());
      } catch { /* not signed in */ }
    })();
  }, [login]);
  useEffect(() => { // keep dates/status fresh: every minute and when the app is reopened
    const t = window.setInterval(reload, 60000); const v = () => { if (!document.hidden) reload(); };
    document.addEventListener('visibilitychange', v); return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', v); };
  }, [reload]);

  const run: Ctx['run'] = useCallback(async (fn, okMsg) => {
    if (!repo.current) return false;
    setBusy(true);
    try { await fn(repo.current); await reload(); if (okMsg) notify(okMsg); return true; }
    catch (e: any) { notify(e.message || 'Something went wrong'); return false; }
    finally { setBusy(false); }
  }, [reload, notify]);

  const go = useCallback((s: Screen, reset = false) => setStack(st => (reset ? [s] : st[st.length - 1] === s ? st : [...st, s])), []);
  const back = useCallback(() => setStack(st => (st.length > 1 ? st.slice(0, -1) : ['home'])), []);
  const nameOf = useCallback((id: string) => snap?.members.find(m => m.id === id)?.name ?? 'Unknown member', [snap]);

  return <C.Provider value={{ brand, user, snap, screen: stack[stack.length - 1], today, busy, toast, go, back, login, logout, run, notify, reload, nameOf }}>{children}</C.Provider>;
}
