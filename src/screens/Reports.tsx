import React, { useState } from 'react';
import { CheckCircle, Gift } from 'lucide-react';
import { Phone, Card } from '../components/Phone';
import { useApp } from '../state/AppContext';
import { fmtDate, fmtMonth, peso } from '../lib/dates';
import { progress, sortSlots } from '../lib/engine';
import { can } from '../lib/permissions';
import { Stat, Title } from '../components/ui';

export default function Reports() {
  const { user, snap, nameOf } = useApp();
  const [tab, setTab] = useState<'sum' | 'sched' | 'tx'>('sum');
  if (!snap || !user) return null;
  const c = snap.cycle, staff = can(user.role, 'finance.view');
  if (!c) return <Phone title="Reports" active={2} back><Card><p className="muted">No cycle data yet.</p></Card></Phone>;
  const p = progress(c, snap.eligible, snap.slots, snap.payouts);
  const T = (k: typeof tab, t: string) => <span onClick={() => setTab(k)}>{tab === k ? <b>{t}</b> : t}</span>;
  const collected = snap.contributions.filter(x => x.status === 'PAID').reduce((a, x) => a + x.amount, 0);
  const mine = snap.payouts.filter(x => staff || x.memberId === user.memberId);
  return (
    <Phone title="Reports" active={2} back>
      <div className="tabs report-tabs">{T('sum', 'Summary')}{T('sched', 'Payout Schedule')}{T('tx', 'Transactions')}</div>
      {tab === 'sum' && <>
        <Card className="cycle"><header>Cycle Overview<small>{c.name} · {c.status.replace(/_/g, ' ')}</small></header>
          <div className="chart-row"><div className="donut" style={{ border: 0, background: `conic-gradient(#0bb37a ${p.pct}%, #f3a11a 0)`, boxShadow: 'inset 0 0 0 16px var(--donut-hole)' }}><b>{p.pct}%</b></div>
            <div><p>🟢 Paid out ({p.paid})</p><p>🟠 Awaiting ({p.awaiting})</p><small className="muted">Based on confirmed releases</small></div></div></Card>
        <div className="stats"><Stat a="Eligible" b={p.eligible} /><Stat a="Scheduled" b={p.scheduled} /><Stat a="Remaining months" b={p.remainingMonths} /></div>
        <div className="stats"><Stat a="Scheduled amount" b={peso(p.scheduledAmount)} /><Stat a="Released" b={peso(p.releasedAmount)} /><Stat a="Collected" b={peso(collected)} /></div>
        {staff && <><Title>Recent Activities</Title><Card className="activities">{snap.audit.slice(0, 6).map(a => (
          <div className="activity" key={a.id}><span>{a.action.startsWith('payout') ? <Gift /> : <CheckCircle />}</span><div><b>{a.action.replace(/[._]/g, ' ')}</b><small>{a.userName ?? 'User'} • {fmtDate(a.at.slice(0, 10))}</small></div></div>))}
          {snap.audit.length === 0 && <p className="muted">No activity yet.</p>}</Card></>}
      </>}
      {tab === 'sched' && sortSlots(snap.slots).map(s => <Card key={s.id}><div className="between"><b>{nameOf(s.memberId)}</b><span>{fmtMonth(s.month)} · {fmtDate(s.date)}</span></div><small className="muted">{s.status === 'RELEASED' ? 'Released' : 'Not yet released'}</small></Card>)}
      {tab === 'tx' && (mine.length ? mine.map(x => <Card key={x.id}><div className="between"><b>{nameOf(x.memberId)}</b><strong>{peso(x.amount)}</strong></div><small className="muted">Scheduled {fmtDate(x.scheduledDate)} • Released {fmtDate(x.releasedOn)}{x.ref ? ' • Ref ' + x.ref : ''}</small></Card>) : <Card><p className="muted">No confirmed payouts yet.</p></Card>)}
    </Phone>
  );
}
