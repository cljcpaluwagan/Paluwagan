import React, { useState } from 'react';
import { Phone, Card, Pill } from '../components/Phone';
import { useApp } from '../state/AppContext';
import { Btn, Field, Note, Title } from '../components/ui';
import { can } from '../lib/permissions';
import { clean, validName } from '../lib/validate';
import type { Member, Registration } from '../types';

function RegCard({ reg, free }: { reg: Registration; free: Member[] }) {
  const { run } = useApp(); const [pick, setPick] = useState('');
  return (
    <Card className="mrow">
      <b>{reg.name}</b><small className="muted">{reg.email ?? '—'}{reg.phone ? ` · ${reg.phone}` : ''}</small>
      <Field label="Link this account to"><select value={pick} onChange={e => setPick(e.target.value)}><option value="">Create a new member</option>{free.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
      <div className="btn-row"><Btn onClick={() => run(r => r.approveRegistration(reg.id, pick || undefined), 'Approved')}>Approve</Btn>
        <Btn tone="ghost" onClick={() => { const why = window.prompt(`Reject ${reg.name}? Reason (optional):`, ''); if (why !== null) run(r => r.rejectRegistration(reg.id, why), 'Rejected'); }}>Reject</Btn></div>
    </Card>
  );
}

export default function Members() {
  const { user, snap, run, notify } = useApp();
  const [name, setName] = useState('');
  if (!user || !snap) return null;
  const manage = can(user.role, 'member.manage'); const inCycle = new Set(snap.eligible);
  const add = async () => {
    const n = clean(name); if (!validName(n)) return notify('Enter the full name (2 to 80 letters).');
    if (await run(r => r.addMember(n), snap.cycle && snap.cycle.status !== 'CLOSED' ? 'Added. Admin must decide current or next cycle.' : 'Member added')) setName('');
  };
  return (
    <Phone title="Members" active={3} back>
      {manage && snap.registrations.length > 0 && <><Title>Registration requests ({snap.registrations.length})</Title>
        {snap.registrations.map(r => <RegCard key={r.id} reg={r} free={snap.members.filter(m => !m.archived && !m.linked)} />)}</>}
      {manage && <Card className="form"><Field label="Add member"><input value={name} placeholder="Full name" maxLength={80} onChange={e => setName(e.target.value)} /></Field>
        <Btn disabled={!name.trim()} onClick={add}>Add member</Btn></Card>}
      <Note>Archiving keeps a member's history and any payout they are still owed in the running cycle.</Note>
      {snap.members.map(m => (
        <Card key={m.id} className="mrow">
          <div className="mrow-in">
            <div className="mrow-info"><b>{m.name}</b><small className="muted">{inCycle.has(m.id) ? 'In current cycle' : 'Not in current cycle'}{m.linked ? ' · has an account' : ''}</small></div>
            <div className="mrow-act">
              {m.pendingDecision ? <Pill tone="orange">Awaiting decision</Pill> : m.archived ? <Pill tone="blue">Archived</Pill> : <Pill>Active</Pill>}
              {manage && !m.archived && <button className="archive-btn" onClick={() => window.confirm(`Archive ${m.name}? Their history and any owed payout are kept.`) && run(r => r.archiveMember(m.id), 'Member archived')}>Archive</button>}
            </div>
          </div>
        </Card>))}
    </Phone>
  );
}
