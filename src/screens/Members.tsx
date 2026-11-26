import React, { useState } from 'react';
import { Phone, Card, Pill } from '../components/Phone';
import { useApp } from '../state/AppContext';
import { Btn, Field, Note } from '../components/ui';
import { can } from '../lib/permissions';
import { clean, validName } from '../lib/validate';
import { fmtDate, fmtMonth, peso } from '../lib/dates';
import { payoutStage } from '../lib/engine';
import { stageText } from '../lib/stage';
import type { Member, Registration } from '../types';

type Tab = 'waiting' | 'active' | 'paid' | 'archived';

function RegCard({ reg, free }: { reg: Registration; free: Member[] }) {
  const { run } = useApp(); const [pick, setPick] = useState('');
  return (
    <Card className="mrow">
      <div className="mrow-in"><div className="mrow-info"><b>{reg.name}</b><small className="muted">{reg.email ?? '—'}{reg.phone ? ` · ${reg.phone}` : ''}</small></div><Pill tone="orange">New · needs approval</Pill></div>
      <Field label="Link this account to"><select value={pick} onChange={e => setPick(e.target.value)}><option value="">Create a new member</option>{free.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
      <div className="btn-row"><Btn onClick={() => run(r => r.approveRegistration(reg.id, pick || undefined), 'Approved')}>Approve</Btn>
        <Btn tone="ghost" onClick={() => { const why = window.prompt(`Reject ${reg.name}? Reason (optional):`, ''); if (why !== null) run(r => r.rejectRegistration(reg.id, why), 'Rejected'); }}>Reject</Btn></div>
    </Card>
  );
}

export default function Members() {
  const { user, snap, today, run, notify, nameOf } = useApp();
  const [tab, setTab] = useState<Tab>('active'); const [name, setName] = useState('');
  if (!user || !snap) return null;
  const manage = can(user.role, 'member.manage'), admin = can(user.role, 'member.decide');
  const inCycle = new Set(snap.eligible);
  const payoutOf = new Map(snap.payouts.map(p => [p.memberId, p]));
  const slotOf = new Map(snap.slots.map(s => [s.memberId, s]));
  const waitingMembers = snap.members.filter(m => m.pendingDecision && !m.archived);
  const active = snap.members.filter(m => !m.archived && !m.pendingDecision && !payoutOf.has(m.id));
  const paid = snap.members.filter(m => !m.archived && payoutOf.has(m.id));
  const archived = snap.members.filter(m => m.archived);
  const waitingCount = (manage ? snap.registrations.length : 0) + waitingMembers.length;
  const add = async () => {
    const n = clean(name); if (!validName(n)) return notify('Enter the full name (2 to 80 letters).');
    if (await run(r => r.addMember(n), snap.cycle && snap.cycle.status !== 'CLOSED' ? 'Added. Admin must decide current or next cycle.' : 'Member added')) setName('');
  };
  const archiveBtn = (m: Member) => manage && !m.archived && <button className="archive-btn" onClick={() => window.confirm(`Archive ${m.name}? Their history and any owed payout are kept.`) && run(r => r.archiveMember(m.id), 'Member archived')}>Archive</button>;
  const T = (k: Tab, label: string, n: number) => <span onClick={() => setTab(k)}>{tab === k ? <b>{label} {n}</b> : `${label} ${n}`}</span>;

  const row = (m: Member, info: React.ReactNode, pill: React.ReactNode, extra?: React.ReactNode) => (
    <Card key={m.id} className="mrow"><div className="mrow-in">
      <div className="mrow-info"><b>{m.name}</b><small className="muted">{info}{m.linked ? ' · has an account' : ''}</small></div>
      <div className="mrow-act">{pill}{extra}</div></div></Card>);

  return (
    <Phone title="Members" active={3} back>
      {manage && <Card className="form"><Field label="Add member"><input value={name} placeholder="Full name" maxLength={80} onChange={e => setName(e.target.value)} /></Field>
        <Btn disabled={!name.trim()} onClick={add}>Add member</Btn></Card>}
      <div className="tabs four">{T('waiting', 'Waiting', waitingCount)}{T('active', 'Active', active.length)}{T('paid', 'Paid', paid.length)}{T('archived', 'Archived', archived.length)}</div>

      {tab === 'waiting' && <>
        {manage && snap.registrations.map(r => <RegCard key={r.id} reg={r} free={snap.members.filter(m => !m.archived && !m.linked)} />)}
        {waitingMembers.map(m => (
          <Card key={m.id} className="mrow"><div className="mrow-in"><div className="mrow-info"><b>{m.name}</b><small className="muted">Joined while a cycle is running</small></div><Pill tone="orange">Awaiting decision</Pill></div>
            {admin ? <div className="btn-row"><Btn onClick={() => run(r => r.decideMember(m.id, 'CURRENT'), 'Added to the current cycle. The Cashier must schedule them.')}>Current cycle</Btn><Btn tone="ghost" onClick={() => run(r => r.decideMember(m.id, 'NEXT'), 'Set for the next cycle')}>Next cycle</Btn></div>
              : <small className="muted">The Admin decides if they join this cycle or the next.</small>}</Card>))}
        {waitingCount === 0 && <Card><p className="muted">Nobody is waiting for approval.</p></Card>}
      </>}

      {tab === 'active' && <>
        <Note>Members who are active and have not received their payout yet.</Note>
        {active.map(m => { const s = slotOf.get(m.id); const t = s ? stageText(payoutStage(s, snap.eligible, snap.contributions, today)) : null;
          return row(m, s ? `Payout: ${fmtMonth(s.month)}` : inCycle.has(m.id) ? 'In current cycle' : 'Not in current cycle', t ? <Pill tone={t.tone}>{t.short}</Pill> : <Pill>Active</Pill>, archiveBtn(m)); })}
        {active.length === 0 && <Card><p className="muted">No active members waiting for a payout.</p></Card>}
      </>}

      {tab === 'paid' && <>
        <Note>Members who already received their payout in this cycle.</Note>
        {paid.map(m => { const p = payoutOf.get(m.id)!; return row(m, `Received ${fmtDate(p.releasedOn)} · ${peso(p.amount)}${p.ref ? ' · Ref ' + p.ref : ''}`, <Pill>Released ✓</Pill>, archiveBtn(m)); })}
        {paid.length === 0 && <Card><p className="muted">No payouts released yet.</p></Card>}
      </>}

      {tab === 'archived' && <>
        <Note>Archived members keep their full history. If they are still owed a payout in the running cycle, it stays on the schedule.</Note>
        {archived.map(m => { const owed = inCycle.has(m.id) && !payoutOf.has(m.id); return row(m, owed ? 'Still owed a payout in this cycle' : payoutOf.has(m.id) ? `Received ${fmtDate(payoutOf.get(m.id)!.releasedOn)}` : 'History kept', <Pill tone={owed ? 'orange' : 'blue'}>{owed ? 'Payout owed' : 'Archived'}</Pill>); })}
        {archived.length === 0 && <Card><p className="muted">No archived members.</p></Card>}
      </>}
    </Phone>
  );
}
