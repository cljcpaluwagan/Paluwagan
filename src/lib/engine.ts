// Pure payout-cycle rules. No UI, no database. Used by the demo repo and by the screens; mirrored by the SQL functions.
import type { Cycle, CycleStatus, Payout, ScheduleCfg, Slot, SlotStatus, Contribution } from '../types.ts';
import { addMonths, monthIndex, monthOf, payoutDate } from './dates.ts';

export const TARGET_MONTHS = 12; // a target, never a termination limit

export const uid = (): string =>
  (globalThis as any).crypto?.randomUUID?.() ?? 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36);

const byMonth = (a: Slot, b: Slot) => a.month.localeCompare(b.month) || a.date.localeCompare(b.date);
export const sortSlots = (s: Slot[]) => [...s].sort(byMonth);

/** Distribute members across months, perMonth at a time, extending past 12 months when needed. `kept` slots are never touched. */
export function generateSchedule(cfg: ScheduleCfg, memberIds: string[], kept: Slot[] = []): Slot[] {
  const per = Math.max(1, Math.floor(cfg.perMonth));
  const done = new Set(kept.map(s => s.memberId));
  const load = new Map<string, number>();
  kept.forEach(s => load.set(s.month, (load.get(s.month) || 0) + 1));
  const out: Slot[] = [...kept];
  let off = 0;
  for (const id of memberIds) {
    if (done.has(id)) continue; // exactly one assignment per member
    while ((load.get(addMonths(cfg.startMonth, off)) || 0) >= per) off++;
    const month = addMonths(cfg.startMonth, off);
    out.push({ id: uid(), cycleId: cfg.cycleId, memberId: id, month, date: payoutDate(month, cfg.payoutDay), status: 'SCHEDULED', manual: false });
    load.set(month, (load.get(month) || 0) + 1);
    done.add(id);
  }
  return sortSlots(out);
}

/** Recalculate the future only. Released slots, manual assignments and past-month slots are preserved. */
export function recalculate(cfg: ScheduleCfg, memberIds: string[], existing: Slot[], today: string): Slot[] {
  const nowMonth = monthOf(today);
  const keep = existing
    .filter(s => s.status === 'RELEASED' || ((s.manual || s.month < nowMonth) && memberIds.includes(s.memberId)))
    .map(s => (s.status === 'RELEASED' ? s : { ...s, date: payoutDate(s.month, cfg.payoutDay) }));
  return generateSchedule(cfg, memberIds, keep);
}

export const slotStatus = (s: Slot, today: string): SlotStatus =>
  s.status === 'RELEASED' ? 'RELEASED' : s.date <= today ? 'READY_FOR_RELEASE' : 'SCHEDULED';

export interface Validation { errors: string[]; warnings: string[] }
export function validateSchedule(slots: Slot[], eligible: string[], perMonth: number): Validation {
  const errors: string[] = [], warnings: string[] = [];
  const seen = new Set<string>();
  for (const s of slots) {
    if (seen.has(s.memberId)) errors.push(`Member assigned twice: ${s.memberId}`);
    seen.add(s.memberId);
    if (!eligible.includes(s.memberId)) errors.push(`Not an eligible member: ${s.memberId}`);
  }
  for (const id of eligible) if (!seen.has(id)) errors.push(`No payout assignment for member ${id}`);
  const load = new Map<string, number>();
  slots.forEach(s => load.set(s.month, (load.get(s.month) || 0) + 1));
  load.forEach((n, m) => { if (n > perMonth) warnings.push(`${m} has ${n} recipients (limit ${perMonth})`); });
  return { errors, warnings };
}

export const potPerRecipient = (c: Pick<Cycle, 'contribution'>, eligibleCount: number) => c.contribution * eligibleCount;

export interface Progress {
  eligible: number; scheduled: number; paid: number; awaiting: number;
  scheduledAmount: number; releasedAmount: number; remainingMonths: number; pct: number; extended: boolean; months: number;
}
/** Completion counts ACTUAL confirmed releases, never scheduled assignments. */
export function progress(cycle: Cycle, eligible: string[], slots: Slot[], payouts: Payout[]): Progress {
  const paidSet = new Set(payouts.filter(p => p.cycleId === cycle.id).map(p => p.memberId));
  const paid = eligible.filter(id => paidSet.has(id)).length;
  const pot = potPerRecipient(cycle, eligible.length);
  const open = slots.filter(s => s.status !== 'RELEASED');
  const months = new Set(slots.map(s => s.month)).size;
  return {
    eligible: eligible.length, scheduled: new Set(slots.map(s => s.memberId)).size, paid, awaiting: eligible.length - paid,
    scheduledAmount: slots.length * pot, releasedAmount: payouts.reduce((a, p) => a + p.amount, 0),
    remainingMonths: new Set(open.map(s => s.month)).size,
    pct: eligible.length ? Math.round((paid / eligible.length) * 100) : 0,
    extended: months > TARGET_MONTHS, months,
  };
}

/** ACTIVE <-> AWAITING_COMPLETION only. Never CLOSED, never FOR_ADMIN_REVIEW. Never closes after 12 months. */
export function deriveStatus(cycle: Cycle, slots: Slot[], awaiting: number, today: string): CycleStatus {
  if (cycle.status !== 'ACTIVE' && cycle.status !== 'AWAITING_COMPLETION') return cycle.status;
  const last = slots.reduce((m, s) => (s.date > m ? s.date : m), '');
  return awaiting > 0 && last !== '' && last < today ? 'AWAITING_COMPLETION' : 'ACTIVE';
}

export interface Reconciliation { totalCollected: number; totalReleased: number; expectedPot: number; unreleased: number; mismatch: boolean }
export function reconciliation(cycle: Cycle, eligible: string[], payouts: Payout[], contributions: Contribution[]): Reconciliation {
  const totalCollected = contributions.filter(c => c.cycleId === cycle.id && c.status === 'PAID').reduce((a, c) => a + c.amount, 0);
  const totalReleased = payouts.reduce((a, p) => a + p.amount, 0);
  return { totalCollected, totalReleased, expectedPot: potPerRecipient(cycle, eligible.length), unreleased: Math.max(0, totalCollected - totalReleased), mismatch: totalCollected !== totalReleased };
}

/** Cashier may submit for Admin review only when every eligible member has an actual confirmed payout. */
export function canSubmitForReview(cycle: Cycle, eligible: string[], slots: Slot[], payouts: Payout[]): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (cycle.status !== 'ACTIVE' && cycle.status !== 'AWAITING_COMPLETION') reasons.push('Cycle is not running.');
  const paid = new Set(payouts.map(p => p.memberId));
  const waiting = eligible.filter(id => !paid.has(id));
  if (waiting.length) reasons.push(`${waiting.length} eligible member(s) still awaiting an actual payout.`);
  const slotIds = new Set(slots.map(s => s.id));
  if (payouts.some(p => !slotIds.has(p.slotId))) reasons.push('A payout transaction has no matching schedule.');
  if (slots.some(s => s.status !== 'RELEASED')) reasons.push('Some scheduled slots are not released.');
  return { ok: reasons.length === 0, reasons };
}

export interface Diff { added: string[]; moved: { memberId: string; from: string; to: string }[]; removed: string[] }
export function diffSchedule(before: Slot[], after: Slot[]): Diff {
  const b = new Map(before.map(s => [s.memberId, s])), a = new Map(after.map(s => [s.memberId, s]));
  return {
    added: after.filter(s => !b.has(s.memberId)).map(s => s.memberId),
    removed: before.filter(s => !a.has(s.memberId)).map(s => s.memberId),
    moved: after.filter(s => b.has(s.memberId) && b.get(s.memberId)!.month !== s.month).map(s => ({ memberId: s.memberId, from: b.get(s.memberId)!.month, to: s.month })),
  };
}
export const lastMonth = (slots: Slot[]) => slots.reduce((m, s) => (monthIndex(s.month) > (m ? monthIndex(m) : -1) ? s.month : m), '');
