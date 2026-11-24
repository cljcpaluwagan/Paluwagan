import test from 'node:test';
import assert from 'node:assert/strict';
import { payoutDate, addMonths } from '../src/lib/dates.ts';
import { generateSchedule, recalculate, validateSchedule, progress, deriveStatus, canSubmitForReview, slotStatus } from '../src/lib/engine.ts';
import type { Cycle, Payout, Slot } from '../src/types.ts';

const ids = (n: number) => Array.from({ length: n }, (_, i) => 'm' + (i + 1));
const cfg = (perMonth: number, startMonth = '2026-12', payoutDay = 15) => ({ cycleId: 'c1', startMonth, payoutDay, perMonth });
const cycle = (o: Partial<Cycle> = {}): Cycle => ({ id: 'c1', name: 'C1', status: 'ACTIVE', startMonth: '2026-12', payoutDay: 15, dueDay: 5, reminderDays: 3, perMonth: 2, contribution: 1000, scheduleFinal: true, reconciled: false, createdAt: '', ...o });
const pay = (s: Slot): Payout => ({ id: 'p' + s.id, cycleId: 'c1', slotId: s.id, memberId: s.memberId, scheduledMonth: s.month, scheduledDate: s.date, releasedOn: s.date, amount: 20000, cashierId: 'u' });

test('one recipient per month', () => {
  const s = generateSchedule(cfg(1), ids(5));
  assert.equal(s.length, 5); assert.deepEqual(s.map(x => x.month), ['2026-12', '2027-01', '2027-02', '2027-03', '2027-04']);
});
test('20 members, 2 per month = 10 months, each member once', () => {
  const s = generateSchedule(cfg(2), ids(20));
  assert.equal(new Set(s.map(x => x.month)).size, 10);
  assert.equal(new Set(s.map(x => x.memberId)).size, 20);
  assert.equal(validateSchedule(s, ids(20), 2).errors.length, 0);
});
test('more than 12 months extends automatically', () => {
  const s = generateSchedule(cfg(1), ids(30));
  assert.equal(new Set(s.map(x => x.month)).size, 30);
  assert.equal(progress(cycle({ perMonth: 1 }), ids(30), s, []).extended, true);
});
test('invalid dates clamp to last valid day, never skip a month', () => {
  assert.equal(payoutDate('2026-11', 31), '2026-11-30');
  assert.equal(payoutDate('2026-04', 31), '2026-04-30');
  assert.equal(payoutDate('2027-02', 31), '2027-02-28');
  assert.equal(payoutDate('2028-02', 31), '2028-02-29'); // leap
  assert.equal(payoutDate('2100-02', 29), '2100-02-28'); // not leap
  assert.equal(payoutDate('2000-02', 30), '2000-02-29'); // leap (div by 400)
  const s = generateSchedule(cfg(1, '2027-01', 31), ids(4));
  assert.deepEqual(s.map(x => x.date), ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  assert.equal(addMonths('2026-12', 1), '2027-01');
});
test('manual assignment survives recalculation; no duplicates', () => {
  let s = generateSchedule(cfg(2), ids(6));
  s = s.map(x => (x.memberId === 'm6' ? { ...x, month: '2026-12', date: '2026-12-15', manual: true } : x));
  const r = recalculate(cfg(2), ids(6), s, '2026-11-24');
  assert.equal(r.find(x => x.memberId === 'm6')!.month, '2026-12');
  assert.equal(new Set(r.map(x => x.memberId)).size, 6);
});
test('released slots are never moved by recalculation', () => {
  let s = generateSchedule(cfg(2), ids(6));
  s = s.map(x => (x.memberId === 'm1' ? { ...x, status: 'RELEASED' as const } : x));
  const r = recalculate(cfg(3, '2026-12', 20), ids(6), s, '2026-12-20');
  const m1 = r.find(x => x.memberId === 'm1')!;
  assert.equal(m1.status, 'RELEASED'); assert.equal(m1.date, '2026-12-15');
});
test('duplicate assignment is rejected by validation', () => {
  const s = generateSchedule(cfg(2), ids(4)); s.push({ ...s[0], id: 'dup' });
  assert.ok(validateSchedule(s, ids(4), 2).errors.some(e => e.includes('twice')));
});
test('archived member keeps their obligation (stays eligible + scheduled)', () => {
  const s = generateSchedule(cfg(2), ids(4));
  assert.equal(recalculate(cfg(2), ids(4), s, '2026-11-24').length, 4);
});
test('partial completion: pct from actual releases, cycle stays ACTIVE', () => {
  const s = generateSchedule(cfg(2), ids(20)).map((x, i) => (i < 12 ? { ...x, status: 'RELEASED' as const } : x));
  const p = progress(cycle(), ids(20), s, s.filter(x => x.status === 'RELEASED').map(pay));
  assert.equal(p.paid, 12); assert.equal(p.awaiting, 8); assert.equal(p.pct, 60);
  assert.equal(deriveStatus(cycle(), s, 8, '2026-12-20'), 'ACTIVE');
});
test('all dates passed but members unpaid -> AWAITING_COMPLETION, never CLOSED', () => {
  const s = generateSchedule(cfg(2), ids(4));
  assert.equal(deriveStatus(cycle(), s, 4, '2030-01-01'), 'AWAITING_COMPLETION');
  assert.equal(deriveStatus(cycle({ status: 'FOR_ADMIN_REVIEW' }), s, 0, '2030-01-01'), 'FOR_ADMIN_REVIEW');
});
test('scheduled is not paid: READY is derived, RELEASED needs confirmation', () => {
  const s = generateSchedule(cfg(1), ids(1))[0];
  assert.equal(slotStatus(s, '2026-12-14'), 'SCHEDULED');
  assert.equal(slotStatus(s, '2026-12-15'), 'READY_FOR_RELEASE');
  assert.equal(slotStatus({ ...s, status: 'RELEASED' }, '2026-12-15'), 'RELEASED');
});
test('cannot submit for review until everyone is paid', () => {
  const all = generateSchedule(cfg(2), ids(4));
  assert.equal(canSubmitForReview(cycle(), ids(4), all, []).ok, false);
  const rel = all.map(x => ({ ...x, status: 'RELEASED' as const }));
  assert.equal(canSubmitForReview(cycle(), ids(4), rel, rel.map(pay)).ok, true);
});
