import React, { useState } from 'react';
import { CalendarDays, Users } from 'lucide-react';
import { Phone, Card, Pill } from '../components/Phone';
import { useApp } from '../state/AppContext';
import { fmtMonth, monthOf, peso, todayISO } from '../lib/dates';
import { lastMonth } from '../lib/engine';
import { monthRange } from '../components/ui';
import { can } from '../lib/permissions';

export default function Collection() {
  const { user, snap, today, run, nameOf, go } = useApp();
  const [period, setPeriod] = useState(monthOf(today)); const [method, setMethod] = useState('Cash');
  if (!snap || !user) return null;
  const c = snap.cycle; const staff = can(user.role, 'contribution.confirm');
  if (!c) return <Phone title="Do Collection" active={1} back right="home"><Card><p className="muted">No payout cycle yet. An Admin must create one.</p></Card></Phone>;
  const end = [lastMonth(snap.slots), monthOf(today)].sort().reverse()[0] || monthOf(today);
  const months = monthRange(c.startMonth < monthOf(today) ? c.startMonth : monthOf(today), end);
  const paidOf = (id: string) => snap.contributions.find(x => x.memberId === id && x.month === period && x.status === 'PAID');
  const paid = snap.eligible.filter(id => paidOf(id)).length, total = snap.eligible.length, pct = total ? Math.round(paid / total * 100) : 0;
  const open = c.status === 'ACTIVE' || c.status === 'AWAITING_COMPLETION';
  const toggle = (id: string) => {
    if (!staff || !open) return;
    const isPaid = !!paidOf(id);
    if (isPaid && !window.confirm(`Mark ${nameOf(id)} as NOT paid for ${fmtMonth(period)}?`)) return;
    run(r => r.setContribution({ cycleId: c.id, memberId: id, month: period, status: isPaid ? 'PENDING' : 'PAID', method: isPaid ? undefined : method, paidOn: isPaid ? undefined : todayISO() }), isPaid ? 'Marked pending' : `${nameOf(id)} confirmed paid`);
  };
  return (
    <Phone title="Do Collection" active={1} back right="home">
      <Card className="period"><CalendarDays /><div><small>Collection Period</small>
        <select value={period} onChange={e => setPeriod(e.target.value)}>{months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}</select></div></Card>
      <Card className="progress-card"><Users /><div><small>Group Progress</small><b>{paid} / {total} Members</b><div className="progress"><i style={{ width: pct + '%' }} /></div></div><strong>{pct}%</strong></Card>
      {staff && open && <div className="method-row"><small>Payment method</small><select value={method} onChange={e => setMethod(e.target.value)}>{['Cash', 'GCash', 'Bank Transfer'].map(m => <option key={m}>{m}</option>)}</select></div>}
      <div className="member-list">{snap.eligible.map(id => { const m = snap.members.find(x => x.id === id); const p = paidOf(id); return (
        <div className="member" key={id} onClick={() => toggle(id)}>
          <div className="mini-avatar">{nameOf(id).split(' ').map(x => x[0]).join('').slice(0, 2)}</div><b>{nameOf(id)}{m?.archived ? ' (archived)' : ''}</b><strong>{peso(c.contribution)}</strong>
          <Pill tone={p ? 'green' : 'orange'}>{p ? '✓ Paid' : 'Pending'}</Pill></div>); })}</div>
      <Card className="totals"><div><small>Total Collected</small><b>{peso(paid * c.contribution)}</b></div><div><small>Expected Amount</small><b>{peso(total * c.contribution)}</b></div></Card>
      {staff && open && <p className="muted center">Tap a member to confirm or undo their payment.</p>}
      <button className="wide" onClick={() => go('reports')}>▥　View Details</button>
    </Phone>
  );
}
