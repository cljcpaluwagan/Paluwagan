import React, { useState } from 'react';
import { Phone, Card, Pill } from '../components/Phone';
import { useApp } from '../state/AppContext';
import { addMonths, fmtMonth, payoutDate, fmtDate } from '../lib/dates';
import { diffSchedule, lastMonth, recalculate, sortSlots, validateSchedule, TARGET_MONTHS } from '../lib/engine';
import { can } from '../lib/permissions';
import { Btn, Field, Note, Title, monthRange } from '../components/ui';
import type { Slot } from '../types';

export default function PayoutSettings() {
  const { user, snap, today, run, nameOf, go } = useApp();
  const c = snap?.cycle;
  const [start, setStart] = useState(c?.startMonth ?? ''); const [day, setDay] = useState(c?.payoutDay ?? 15); const [per, setPer] = useState(c?.perMonth ?? 2);
  const [due, setDue] = useState(c?.dueDay ?? 5); const [remind, setRemind] = useState(c?.reminderDays ?? 3);
  const [draft, setDraft] = useState<Slot[] | null>(null); const [review, setReview] = useState(false);
  if (!user || !snap) return null;
  if (!c) return <Phone title="Payout Settings" active={3} back><Card><p className="muted">No cycle yet. An Admin must create and authorize a new payout cycle first.</p></Card></Phone>;
  const editable = can(user.role, 'schedule.edit') && c.status !== 'CLOSED' && c.status !== 'FOR_ADMIN_REVIEW';
  const cfg = { cycleId: c.id, startMonth: start, payoutDay: Math.min(31, Math.max(1, day)), perMonth: Math.max(1, per) };
  const val = draft ? validateSchedule(draft, snap.eligible, cfg.perMonth) : null;
  const diff = draft ? diffSchedule(snap.slots, draft) : null;
  const monthsUsed = draft ? new Set(draft.map(s => s.month)).size : 0;
  const options = draft ? monthRange(start, addMonths(lastMonth(draft) || start, 1)) : [];

  const preview = () => { setDraft(recalculate(cfg, snap.eligible, snap.slots, today)); setReview(false); };
  const edit = (id: string, month: string) => setDraft(d => d && d.map(s => s.id === id ? { ...s, month, date: payoutDate(month, cfg.payoutDay), manual: true } : s));
  const save = async (finalize: boolean) => {
    const ok = await run(r => r.saveSchedule({ cycleId: c.id, startMonth: cfg.startMonth, payoutDay: cfg.payoutDay, dueDay: due, reminderDays: remind, perMonth: cfg.perMonth, slots: draft ?? snap.slots, finalize }), finalize ? 'Schedule finalized' : 'Schedule saved');
    if (ok) { setDraft(null); setReview(false); }
  };
  const pretty = (e: string) => [...snap.members].sort((a, b) => b.id.length - a.id.length).reduce((t, m) => t.split(m.id).join(m.name), e);
  const ro = !editable;
  return (
    <Phone title="Payout Settings" active={3} back>
      {ro && <Note>{user.role === 'CASHIER' ? 'This cycle is locked for editing.' : 'View only. The Cashier configures the payout schedule.'}</Note>}
      <Card className="form">
        <Field label="Starting payout month"><input type="month" value={start} disabled={ro} onChange={e => setStart(e.target.value)} /></Field>
        <Field label="Preferred payout date (1–31)"><input type="number" min={1} max={31} value={day} disabled={ro} onChange={e => setDay(Number(e.target.value))} /></Field>
        <small className="muted">Days that don't exist use the month's last day: {fmtDate(payoutDate('2027-02', cfg.payoutDay))} in Feb 2027, {fmtDate(payoutDate('2028-02', cfg.payoutDay))} in Feb 2028.</small>
        <Field label="Recipients per month"><input type="number" min={1} value={per} disabled={ro} onChange={e => setPer(Number(e.target.value))} /></Field>
        <Field label="Contribution due date (1–31)"><input type="number" min={1} max={31} value={due} disabled={ro} onChange={e => setDue(Number(e.target.value))} /></Field>
        <Field label="Send reminder (days before due)"><input type="number" min={0} max={28} value={remind} disabled={ro} onChange={e => setRemind(Number(e.target.value))} /></Field>
        {editable && <div className="btn-row"><Btn onClick={preview}>Generate / recalculate</Btn><Btn tone="ghost" onClick={() => save(c.scheduleFinal)}>Save dates only</Btn></div>}
      </Card>
      {draft && val && diff && <>
        <Title>Proposed schedule · {draft.length} members · {monthsUsed} months</Title>
        {monthsUsed > TARGET_MONTHS && <Note>Needs {monthsUsed} months. The 12-month target extends automatically; the cycle stays open until everyone is actually paid.</Note>}
        {val.errors.map(e => <Note key={e} tone="bad">{pretty(e)}</Note>)}
        {val.warnings.map(w => <Note key={w} tone="warn">{w}</Note>)}
        <Card className="assign">{sortSlots(draft).map(s => (
          <div className="assign-row" key={s.id}><b>{nameOf(s.memberId)}</b>
            {s.status === 'RELEASED' ? <Pill>✓ Released {fmtMonth(s.month)}</Pill>
              : <select value={s.month} onChange={e => edit(s.id, e.target.value)}>{options.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}</select>}</div>))}</Card>
        {!review ? <Btn disabled={val.errors.length > 0} onClick={() => setReview(true)}>Review changes</Btn> : <>
          <Card><b>Review before saving</b>
            <p className="muted">{diff.added.length} added · {diff.moved.length} moved · {diff.removed.length} removed. Released payouts and past history are never changed.</p>
            {diff.moved.map(m => <small key={m.memberId} className="block">{nameOf(m.memberId)}: {fmtMonth(m.from)} → {fmtMonth(m.to)}</small>)}
            {diff.added.map(id => <small key={id} className="block">+ {nameOf(id)}</small>)}
            {diff.removed.map(id => <small key={id} className="block">− {nameOf(id)}</small>)}</Card>
          <div className="btn-row"><Btn tone="ghost" onClick={() => save(false)}>Confirm & save draft</Btn><Btn onClick={() => save(true)}>Confirm & finalize</Btn></div></>}
      </>}
      {!draft && snap.slots.length > 0 && <><Title>Current schedule</Title><Card className="assign">{sortSlots(snap.slots).map(s => <div className="assign-row" key={s.id}><b>{nameOf(s.memberId)}</b><small>{fmtMonth(s.month)} · {s.status === 'RELEASED' ? 'Released' : 'Scheduled'}</small></div>)}</Card></>}
      <Btn tone="ghost" onClick={() => go('cycle')}>Open Cycle Management</Btn>
    </Phone>
  );
}
