import React, { useState } from 'react';
import { Phone, Card, Pill } from '../components/Phone';
import { useApp } from '../state/AppContext';
import { Btn, Field, Note } from '../components/ui';
import { can } from '../lib/permissions';

export default function Members() {
  const { user, snap, run } = useApp();
  const [name, setName] = useState('');
  if (!user || !snap) return null;
  const manage = can(user.role, 'member.manage'); const inCycle = new Set(snap.eligible);
  return (
    <Phone title="Members" active={3} back>
      {manage && <Card className="form"><Field label="Add member"><input value={name} placeholder="Full name" onChange={e => setName(e.target.value)} /></Field>
        <Btn disabled={!name.trim()} onClick={async () => { if (await run(r => r.addMember(name), snap.cycle && snap.cycle.status !== 'CLOSED' ? 'Added. Admin must decide current or next cycle.' : 'Member added')) setName(''); }}>Add member</Btn></Card>}
      <Note>Archiving keeps a member's history and any payout they are still owed in the running cycle.</Note>
      {snap.members.map(m => (
        <Card key={m.id} className="mrow"><div className="between"><b>{m.name}</b>
          {m.pendingDecision ? <Pill tone="orange">Awaiting decision</Pill> : m.archived ? <Pill tone="blue">Archived</Pill> : <Pill>Active</Pill>}</div>
          <small className="muted">{inCycle.has(m.id) ? 'In current cycle' : 'Not in current cycle'}</small>
          {manage && !m.archived && <Btn tone="danger" onClick={() => window.confirm(`Archive ${m.name}? Their history and any owed payout are kept.`) && run(r => r.archiveMember(m.id), 'Member archived')}>Archive</Btn>}</Card>))}
    </Phone>
  );
}
