import React, { useState } from 'react';
import { Phone, Card, Pill } from '../components/Phone';
import { useApp } from '../state/AppContext';
import { addMonths, fmtDate, monthOf, peso } from '../lib/dates';
import { canSubmitForReview, progress, reconciliation } from '../lib/engine';
import { can } from '../lib/permissions';
import { Btn, Field, Note, Stat, Title } from '../components/ui';
import type { CycleStatus } from '../types';

const LABEL: Record<CycleStatus, string> = { DRAFT: 'Draft', ACTIVE: 'Active', AWAITING_COMPLETION: 'Awaiting completion', FOR_ADMIN_REVIEW: 'For Admin review', CLOSED: 'Closed' };
export default function CycleScreen() {
  const { user, snap, today, run, nameOf, go } = useApp();
  const [note, setNote] = useState('');
  const c0 = snap?.cycle;
  const [f, setF] = useState({ name: '', start: addMonths(monthOf(today), 1), day: c0?.payoutDay ?? 15, due: c0?.dueDay ?? 5, remind: c0?.reminderDays ?? 3, per: c0?.perMonth ?? 2, amount: c0?.contribution ?? 1000 });
  const [out, setOut] = useState<Record<string, boolean>>({});
  if (!user || !snap) return null;
  const c = snap.cycle; const admin = can(user.role, 'cycle.close'), cashier = can(user.role, 'cycle.submitReview');
  const p = c ? progress(c, snap.eligible, snap.slots, snap.payouts) : null;
  const rec = c ? reconciliation(c, snap.eligible, snap.payouts, snap.contributions) : null;
  const gate = c ? canSubmitForReview(c, snap.eligible, snap.slots, snap.payouts) : null;
  const pending = snap.members.filter(m => m.pendingDecision);
  const canStart = admin && (!c || c.status === 'CLOSED');
  const pool = snap.members.filter(m => !m.archived);
  const chosen = pool.filter(m => out[m.id] !== false).map(m => m.id);
  const num = snap.closedCycles.length + (c ? 1 : 0) + 1;
  return (
    <Phone title="Cycle Management" active={3} back>
      {c && p && <>
        <Card className="cyc-head"><div className="between"><b>{c.name}</b><Pill tone={c.status === 'CLOSED' ? 'blue' : c.status === 'FOR_ADMIN_REVIEW' ? 'orange' : 'green'}>{LABEL[c.status]}</Pill></div>
          <div className="progress"><i style={{ width: p.pct + '%' }} /></div><small>{p.paid} of {p.eligible} members actually paid out · {p.pct}%</small></Card>
        <div className="stats"><Stat a="Eligible" b={p.eligible} /><Stat a="Scheduled" b={p.scheduled} /><Stat a="Paid" b={p.paid} /></div>
        <div className="stats"><Stat a="Awaiting" b={p.awaiting} /><Stat a="Scheduled ₱" b={peso(p.scheduledAmount)} /><Stat a="Released ₱" b={peso(p.releasedAmount)} /></div>
        <small className="muted">Remaining payout months: {p.remainingMonths}{p.extended ? ` · extended to ${p.months} months` : ''}</small>
        {c.status === 'AWAITING_COMPLETION' && <Note tone="warn">All scheduled dates have passed but {p.awaiting} member(s) are still awaiting payout. The cycle stays open.</Note>}
      </>}

      {admin && pending.length > 0 && <><Title>Member decisions needed</Title>{pending.map(m => (
        <Card key={m.id}><b>{m.name}</b><p className="muted">New member during an open cycle. Include now, or start in the next cycle?</p>
          <div className="btn-row"><Btn onClick={() => run(r => r.decideMember(m.id, 'CURRENT'), 'Added to current cycle. Cashier must schedule them.')}>Current cycle</Btn><Btn tone="ghost" onClick={() => run(r => r.decideMember(m.id, 'NEXT'), 'Set for next cycle')}>Next cycle</Btn></div></Card>))}</>}
      {!admin && pending.length > 0 && <Note tone="warn">{pending.length} new member(s) waiting for an Admin decision (current or next cycle).</Note>}

      {c?.status === 'DRAFT' && <Card><b>Draft cycle</b><p className="muted">{c.scheduleFinal ? 'Schedule is finalized and ready for authorization.' : 'The Cashier must finalize the schedule first.'}</p>
        {admin ? <Btn disabled={!c.scheduleFinal} onClick={() => run(r => r.activateCycle(c.id), 'Cycle activated')}>Authorize & activate cycle</Btn> : cashier && <Btn onClick={() => go('payoutSettings')}>Configure schedule</Btn>}</Card>}

      {c && rec && (c.status === 'ACTIVE' || c.status === 'AWAITING_COMPLETION') && cashier && <Card><b>Final reconciliation</b>
        <p className="muted">Collected {peso(rec.totalCollected)} · Released {peso(rec.totalReleased)}</p>
        {gate && !gate.ok && gate.reasons.map(r => <Note key={r} tone="warn">{r}</Note>)}
        <Field label="Reconciliation note"><input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional summary for the Admin" /></Field>
        <Btn disabled={!gate?.ok} onClick={() => run(r => r.submitForReview(c.id, note), 'Submitted for Admin review')}>Submit for Admin review</Btn></Card>}

      {c && rec && c.status === 'FOR_ADMIN_REVIEW' && <><Title>Completed cycle report</Title><Card>
        <p>Collected <b>{peso(rec.totalCollected)}</b> · Released <b>{peso(rec.totalReleased)}</b></p>{rec.mismatch && <Note tone="warn">Collected and released totals differ. Check the note below.</Note>}
        {c.reviewNote && <p className="muted">Cashier note: {c.reviewNote}</p>}
        {snap.payouts.map(x => <small className="block" key={x.id}>{nameOf(x.memberId)} · {fmtDate(x.releasedOn)} · {peso(x.amount)}{x.ref ? ' · ' + x.ref : ''}</small>)}</Card>
        {admin ? <div className="btn-row"><Btn onClick={() => window.confirm('Authorize final closure of this cycle? This cannot be undone.') && run(r => r.closeCycle(c.id), 'Cycle closed')}>Authorize closure</Btn>
          <Btn tone="ghost" onClick={() => { const why = window.prompt('Reason for returning to the Cashier:'); if (why) run(r => r.rejectReview(c.id, why), 'Returned to Cashier'); }}>Return</Btn></div> : <Note>Waiting for Admin review. Only the Admin can close the cycle.</Note>}</>}

      {c?.status === 'CLOSED' && <Note>This cycle is closed. Its records are kept permanently for reports.</Note>}

      {canStart && <><Title>Start next cycle</Title><Card className="form">
        <Field label="Cycle name"><input value={f.name} placeholder={`Cycle ${num}`} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Starting month"><input type="month" value={f.start} onChange={e => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="Contribution per member"><input type="number" value={f.amount} onChange={e => setF({ ...f, amount: Number(e.target.value) })} /></Field>
        <Field label="Recipients per month"><input type="number" min={1} value={f.per} onChange={e => setF({ ...f, per: Number(e.target.value) })} /></Field>
        <b>Members joining this cycle ({chosen.length})</b>
        {pool.map(m => <label className="chk" key={m.id}><input type="checkbox" checked={out[m.id] !== false} onChange={e => setOut({ ...out, [m.id]: e.target.checked })} />{m.name}</label>)}
        <Btn disabled={chosen.length === 0 || f.amount <= 0} onClick={() => run(r => r.createCycle({ name: f.name || `Cycle ${num}`, startMonth: f.start, payoutDay: f.day, dueDay: f.due, reminderDays: f.remind, perMonth: f.per, contribution: f.amount, memberIds: chosen }), 'New cycle created. Cashier can now build the schedule.')}>Create cycle</Btn></Card></>}
      {!c && !admin && <Card><p className="muted">No cycle yet. The Admin must authorize one.</p></Card>}
      {snap.closedCycles.length > 0 && <><Title>Past cycles</Title>{snap.closedCycles.map(x => <Card key={x.id}><b>{x.name}</b> <small className="muted">closed · records kept</small></Card>)}</>}
    </Phone>
  );
}
