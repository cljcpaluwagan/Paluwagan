import React, { useEffect, useState } from 'react';
import { Phone, Card, Pill } from '../components/Phone';
import { useApp } from '../state/AppContext';
import { Note } from '../components/ui';
import { can } from '../lib/permissions';
import type { Profile, Role } from '../types';

export default function Users() {
  const { user, run } = useApp();
  const [list, setList] = useState<Profile[] | null>(null);
  const load = () => run(async r => { setList(await r.listUsers()); });
  useEffect(() => { if (user && can(user.role, 'users.manage')) load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return null;
  if (!can(user.role, 'users.manage')) return <Phone title="Users & Roles" active={3} back><Note tone="warn">Only the Admin can manage users and roles.</Note></Phone>;
  const change = async (p: Profile, role: Role) => {
    if (role === p.role) return;
    if (!window.confirm(`Change ${p.name} from ${p.role} to ${role}?`)) return;
    if (await run(r => r.setRole(p.id, role), 'Role updated')) await load();
  };
  return (
    <Phone title="Users & Roles" active={3} back>
      <Note>Cashiers can record payments and release payouts. Only Admins can close cycles and manage users. New accounts are Members until you change them.</Note>
      {!list ? <Card><p className="muted">Loading…</p></Card> : list.map(p => (
        <Card key={p.id} className="mrow"><div className="mrow-in">
          <div className="mrow-info"><b>{p.name}{p.id === user.id ? ' (you)' : ''}</b><small className="muted">{p.email ?? '—'}</small></div>
          <div className="mrow-act">
            <Pill tone={p.role === 'ADMIN' ? 'orange' : p.role === 'CASHIER' ? 'blue' : 'green'}>{p.role[0] + p.role.slice(1).toLowerCase()}</Pill>
            <select value={p.role} disabled={p.id === user.id} onChange={e => change(p, e.target.value as Role)}>{(['MEMBER', 'CASHIER', 'ADMIN'] as Role[]).map(r => <option key={r} value={r}>{r[0] + r.slice(1).toLowerCase()}</option>)}</select>
          </div></div></Card>))}
    </Phone>
  );
}
