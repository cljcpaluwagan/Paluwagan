// Offline demo: same rules as the SQL functions, stored in localStorage. Used when no Supabase keys are set.
import type { Contribution, Cycle, Member, Payout, Slot, Snapshot, User, AuditEntry, Registration, Profile, Role } from '../types';
import type { Repo } from './repo';
import { assertCan } from '../lib/permissions';
import { addMonths, monthOf, payoutDate, todayISO } from '../lib/dates';
import { deriveStatus, generateSchedule, progress, uid, validateSchedule } from '../lib/engine';

interface DB { regs?: Registration[]; linked?: string[]; prof?: Record<string, { name: string; phone?: string }>; roles?: Record<string, Role>; logo?: string | null; bg?: string | null; title: string; members: Member[]; cycles: Cycle[]; cm: Record<string, string[]>; slots: Slot[]; payouts: Payout[]; contributions: Contribution[]; audit: AuditEntry[] }
const KEY = 'paluwagan-demo-v1';
export const DEMO_USERS: User[] = [
  { id: 'u-admin', name: 'Admin', role: 'ADMIN', approved: true, email: 'admin@demo' }, { id: 'u-cashier', name: 'Cashier', role: 'CASHIER', approved: true, email: 'cashier@demo' },
  { id: 'u-maria', name: 'Maria Santos', role: 'MEMBER', memberId: 'm1', approved: true, email: 'maria@demo' },
];
const NAMES = ['Maria Santos','Juan Dela Cruz','Ana Reyes','Pedro Garcia','Liza Torres','Carlo Navarro','Rosa Mendoza','Mark Santos','Grace Cruz','Diana Garcia','Eric Navarro','Benita Cruz','Jose Ramos','Nena Bautista','Tomas Lim'];

function seed(): DB {
  const members: Member[] = NAMES.map((n, i) => ({ id: 'm' + (i + 1), name: n, archived: false, pendingDecision: false }));
  const month = monthOf(todayISO());
  const cycle: Cycle = { id: 'c1', name: 'Cycle 1', status: 'ACTIVE', startMonth: month, payoutDay: 15, dueDay: 5, reminderDays: 3, perMonth: 2, contribution: 1000, scheduleFinal: true, reconciled: false, createdAt: new Date().toISOString() };
  const slots = generateSchedule({ cycleId: 'c1', startMonth: month, payoutDay: 15, perMonth: 2 }, members.map(m => m.id));
  const contributions: Contribution[] = members.slice(0, 12).map(m => ({ id: uid(), cycleId: 'c1', memberId: m.id, month, amount: 1000, status: 'PAID', method: 'GCash', paidOn: todayISO(), confirmedBy: 'u-cashier' }));
  return { title: 'Paluwagan', members, cycles: [cycle], cm: { c1: members.map(m => m.id) }, slots, payouts: [], contributions, audit: [] };
}
const read = (): DB => { try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* ignore */ } const d = seed(); write(d); return d; };
const write = (d: DB) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ } };
/** Demo sign-up: creates a PENDING registration, exactly like the real app. */
export function demoRegister(a: { name: string; phone?: string; email: string }) {
  const d = read(); (d.regs ||= []).push({ id: uid(), userId: uid(), name: a.name, phone: a.phone, email: a.email, status: 'PENDING', createdAt: new Date().toISOString() }); write(d);
}
/** Demo user with any edits (name, phone, role) applied. */
export function getDemoUser(id: string): User | null {
  const base = DEMO_USERS.find(u => u.id === id); if (!base) return null; const d = read();
  return { ...base, ...(d.prof?.[id] ?? {}), role: d.roles?.[id] ?? base.role };
}
export const resetDemo = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

export function makeDemoRepo(user: User): Repo {
  const log = (d: DB, action: string, detail: unknown) => d.audit.unshift({ id: uid(), at: new Date().toISOString(), userId: user.id, userName: user.name, action, detail: JSON.stringify(detail) });
  const open = (d: DB) => d.cycles.find(c => c.status !== 'CLOSED');
  const cyc = (d: DB, id: string) => { const c = d.cycles.find(x => x.id === id); if (!c) throw new Error('Unknown cycle'); return c; };
  const refresh = (d: DB, c: Cycle) => {
    const slots = d.slots.filter(s => s.cycleId === c.id);
    const p = progress(c, d.cm[c.id] || [], slots, d.payouts.filter(x => x.cycleId === c.id));
    c.status = deriveStatus(c, slots, p.awaiting, todayISO());
  };
  const tx = async (fn: (d: DB) => void) => { const d = read(); fn(d); write(d); };

  return {
    async load() {
      const d = read();
      const cur = open(d) || [...d.cycles].reverse()[0] || null;
      if (cur) { refresh(d, cur); write(d); }
      const id = cur?.id;
      return {
        title: d.title, logo: d.logo ?? null, background: d.bg ?? null, members: d.members.map(m => ({ ...m, linked: (d.linked ?? []).includes(m.id) || DEMO_USERS.some(u => u.memberId === m.id) })), cycle: cur, eligible: id ? d.cm[id] || [] : [],
        slots: d.slots.filter(s => s.cycleId === id), payouts: d.payouts.filter(p => p.cycleId === id),
        contributions: d.contributions.filter(c => c.cycleId === id), audit: d.audit.slice(0, 50),
        closedCycles: d.cycles.filter(c => c.status === 'CLOSED' && c.id !== id),
        registrations: (d.regs ?? []).filter(r => r.status === 'PENDING'),
      } as Snapshot;
    },
    addMember: n => tx(d => {
      assertCan(user.role, 'member.manage');
      const id = uid(); d.members.push({ id, name: n.trim(), archived: false, pendingDecision: !!open(d) });   // never silently joins the running cycle
      log(d, 'member.add', { id, name: n });
    }),
    archiveMember: id => tx(d => {
      assertCan(user.role, 'member.manage');
      const m = d.members.find(x => x.id === id); if (m) m.archived = true;   // cycle membership, slots, payouts untouched
      log(d, 'member.archive', { id });
    }),
    decideMember: (id, dec) => tx(d => {
      assertCan(user.role, 'member.decide');
      const c = open(d); const m = d.members.find(x => x.id === id); if (!m) throw new Error('Unknown member');
      if (dec === 'CURRENT') { if (!c) throw new Error('No open cycle'); if (!d.cm[c.id].includes(id)) d.cm[c.id].push(id); if (c.status === 'DRAFT') c.scheduleFinal = false; }
      m.pendingDecision = false; log(d, 'member.decide', { id, dec });
    }),
    createCycle: a => tx(d => {
      assertCan(user.role, 'cycle.create');
      if (open(d)) throw new Error('Close the current cycle first.');
      const id = uid();
      d.cycles.push({ id, name: a.name, status: 'DRAFT', startMonth: a.startMonth, payoutDay: a.payoutDay, dueDay: a.dueDay, reminderDays: a.reminderDays, perMonth: a.perMonth, contribution: a.contribution, scheduleFinal: false, reconciled: false, createdAt: new Date().toISOString() });
      d.cm[id] = a.memberIds.filter(m => d.members.find(x => x.id === m && !x.archived));
      log(d, 'cycle.create', { id, members: d.cm[id].length });
    }),
    saveSchedule: a => tx(d => {
      assertCan(user.role, 'schedule.edit');
      const c = cyc(d, a.cycleId);
      if (c.status === 'CLOSED' || c.status === 'FOR_ADMIN_REVIEW') throw new Error(`Cycle is ${c.status}`);
      const released = d.slots.filter(s => s.cycleId === c.id && s.status === 'RELEASED');
      const relIds = new Set(released.map(s => s.memberId));
      const next = [...released, ...a.slots.filter(s => !relIds.has(s.memberId)).map(s => ({ ...s, cycleId: c.id, status: 'SCHEDULED' as const, date: payoutDate(s.month, a.payoutDay) }))];
      const v = validateSchedule(next, d.cm[c.id], a.perMonth);
      const dup = v.errors.filter(e => e.includes('twice') || e.includes('Not an eligible'));
      if (dup.length) throw new Error(dup[0]);
      if (a.finalize && v.errors.length) throw new Error(v.errors[0]);
      Object.assign(c, { startMonth: a.startMonth, payoutDay: a.payoutDay, dueDay: a.dueDay, reminderDays: a.reminderDays, perMonth: a.perMonth });
      c.scheduleFinal = a.finalize ? true : c.status === 'DRAFT' ? false : c.scheduleFinal;
      d.slots = d.slots.filter(s => s.cycleId !== c.id).concat(next);
      log(d, 'schedule.save', { cycle: c.id, slots: next.length, finalized: a.finalize });
    }),
    activateCycle: id => tx(d => {
      assertCan(user.role, 'cycle.activate');
      const c = cyc(d, id); if (c.status !== 'DRAFT' || !c.scheduleFinal) throw new Error('Cycle must be DRAFT with a finalized schedule');
      c.status = 'ACTIVE'; log(d, 'cycle.activate', { id });
    }),
    setContribution: a => tx(d => {
      assertCan(user.role, 'contribution.confirm');
      const c = cyc(d, a.cycleId); if (c.status !== 'ACTIVE' && c.status !== 'AWAITING_COMPLETION') throw new Error('Cycle is not collecting');
      const i = d.contributions.findIndex(x => x.cycleId === c.id && x.memberId === a.memberId && x.month === a.month);
      const row: Contribution = { id: i >= 0 ? d.contributions[i].id : uid(), cycleId: c.id, memberId: a.memberId, month: a.month, amount: c.contribution, status: a.status, method: a.method, paidOn: a.paidOn, confirmedBy: user.id };
      if (i >= 0) d.contributions[i] = row; else d.contributions.push(row);
      log(d, 'contribution.set', a);
    }),
    confirmPayout: a => tx(d => {
      assertCan(user.role, 'payout.release');   // only CASHIER
      const s = d.slots.find(x => x.id === a.slotId); if (!s) throw new Error('Unknown payout slot');
      const c = cyc(d, s.cycleId); if (c.status !== 'ACTIVE' && c.status !== 'AWAITING_COMPLETION') throw new Error('Cycle is not running');
      if (s.status === 'RELEASED' || d.payouts.some(p => p.cycleId === c.id && p.memberId === s.memberId)) throw new Error('Already released');
      if (s.date > todayISO()) throw new Error(`Not ready for release until ${s.date}`);
      const amount = c.contribution * (d.cm[c.id] || []).length;
      d.payouts.push({ id: uid(), cycleId: c.id, slotId: s.id, memberId: s.memberId, scheduledMonth: s.month, scheduledDate: s.date, releasedOn: a.releasedOn, amount, cashierId: user.id, ref: a.ref?.trim() || undefined });
      s.status = 'RELEASED'; refresh(d, c); log(d, 'payout.release', { member: s.memberId, amount, ref: a.ref });
    }),
    submitForReview: (id, note) => tx(d => {
      assertCan(user.role, 'cycle.submitReview');
      const c = cyc(d, id); const paid = new Set(d.payouts.filter(p => p.cycleId === id).map(p => p.memberId));
      const waiting = (d.cm[id] || []).filter(m => !paid.has(m)).length;
      if (waiting) throw new Error(`${waiting} eligible member(s) have not received an actual payout`);
      c.status = 'FOR_ADMIN_REVIEW'; c.reconciled = true; c.reviewNote = note; log(d, 'cycle.submit_review', { id, note });
    }),
    rejectReview: (id, reason) => tx(d => {
      assertCan(user.role, 'cycle.rejectReview'); const c = cyc(d, id);
      if (c.status === 'FOR_ADMIN_REVIEW') { c.status = 'ACTIVE'; c.reconciled = false; } log(d, 'cycle.reject_review', { id, reason });
    }),
    closeCycle: id => tx(d => {
      assertCan(user.role, 'cycle.close');   // only ADMIN
      const c = cyc(d, id); if (c.status !== 'FOR_ADMIN_REVIEW' || !c.reconciled) throw new Error('Cycle must be FOR_ADMIN_REVIEW and reconciled');
      c.status = 'CLOSED'; log(d, 'cycle.close', { id });
    }),
    setBranding: a => tx(d => { assertCan(user.role, 'settings.general'); if ('logo' in a) d.logo = a.logo ?? null; if ('background' in a) d.bg = a.background ?? null; log(d, 'settings.branding', Object.keys(a)); }),
    updateMyProfile: a => tx(d => {
      const name = a.name.trim(); if (name.length < 2 || name.length > 80) throw new Error('Name must be 2-80 characters');
      (d.prof ||= {})[user.id] = { name, phone: a.phone?.trim() || undefined }; log(d, 'profile.update', { user: user.id });
    }),
    listUsers: async () => { assertCan(user.role, 'users.manage'); const d = read(); return DEMO_USERS.map(u => ({ id: u.id, name: d.prof?.[u.id]?.name ?? u.name, phone: d.prof?.[u.id]?.phone, email: u.email, role: d.roles?.[u.id] ?? u.role, memberId: u.memberId } as Profile)); },
    setRole: (id, role) => tx(d => {
      assertCan(user.role, 'users.manage'); if (id === user.id) throw new Error('You cannot change your own role');
      const cur = d.roles?.[id] ?? DEMO_USERS.find(u => u.id === id)?.role; if (!cur) throw new Error('Unknown user');
      const admins = DEMO_USERS.filter(u => (d.roles?.[u.id] ?? u.role) === 'ADMIN').length;
      if (cur === 'ADMIN' && role !== 'ADMIN' && admins <= 1) throw new Error('There must be at least one Admin');
      (d.roles ||= {})[id] = role; log(d, 'role.change', { id, from: cur, to: role });
    }),
    approveRegistration: (regId, memberId) => tx(d => {
      assertCan(user.role, 'member.manage');
      const r = (d.regs ?? []).find(x => x.id === regId && x.status === 'PENDING'); if (!r) throw new Error('Registration not found or already decided');
      let m = memberId;
      if (!m) { m = uid(); d.members.push({ id: m, name: r.name, archived: false, pendingDecision: !!open(d) }); }
      else if (!d.members.some(x => x.id === m && !x.archived)) throw new Error('Member not found');
      else if ((d.linked ?? []).includes(m) || DEMO_USERS.some(u => u.memberId === m)) throw new Error('That member is already linked to an account');
      (d.linked ||= []).push(m); r.status = 'APPROVED'; log(d, 'registration.approve', { regId, member: m });
    }),
    rejectRegistration: (regId, reason) => tx(d => {
      assertCan(user.role, 'member.manage'); const r = (d.regs ?? []).find(x => x.id === regId && x.status === 'PENDING'); if (!r) throw new Error('Registration not found or already decided');
      r.status = 'REJECTED'; log(d, 'registration.reject', { regId, reason: reason.slice(0, 200) });
    }),
    setTitle: t => tx(d => { assertCan(user.role, 'settings.general'); d.title = t.trim() || d.title; log(d, 'settings.title', { t }); }),
  };
}
export { addMonths };
