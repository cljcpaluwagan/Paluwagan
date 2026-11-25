import React, { useState } from 'react';
import { CalendarDays, Info, Send } from 'lucide-react';
import { Phone, Card, Pill } from '../components/Phone';
import { useApp } from '../state/AppContext';
import { fmtDate, fmtMonth, monthOf, payoutDate, peso, addMonths } from '../lib/dates';

export default function Payments() {
  const { user, snap, today, go } = useApp();
  const [tab, setTab] = useState<'now' | 'history'>('now');
  if (!user || !snap) return null;
  const c = snap.cycle, month = monthOf(today);
  const mine = snap.contributions.filter(x => x.memberId === user.memberId).sort((a, b) => b.month.localeCompare(a.month));
  const cur = mine.find(x => x.month === month);
  const paidMonths = new Set(mine.filter(x => x.status === 'PAID').map(x => x.month));
  let due = month; while (paidMonths.has(due)) due = addMonths(due, 1);
  return (
    <Phone title="Collections" active={1} back>
      <div className="tabs"><span onClick={() => setTab('now')}>{tab === 'now' ? <b>My Payments</b> : 'My Payments'}</span><span onClick={() => setTab('history')}>{tab === 'history' ? <b>Payment History</b> : 'Payment History'}</span></div>
      {tab === 'now' ? <>
        <Card className="payment-card">
          <div className="between"><h2>{fmtMonth(month)}</h2>{cur?.status === 'PAID' ? <Pill>✓ Paid</Pill> : <Pill tone="orange">Pending</Pill>}</div>
          <p>Amount: <b>{peso(c?.contribution ?? 0)}</b></p>
          <p>Date: {cur?.paidOn ? fmtDate(cur.paidOn) : '—'}</p><p>Method: {cur?.method ?? '—'}</p><hr />
          <div className="between"><b>Payment Status</b>{cur?.status === 'PAID' ? <Pill>✓ Paid</Pill> : <Pill tone="orange">Awaiting confirmation</Pill>}</div>
        </Card>
        <Card className="due"><CalendarDays /><div><b>Next Due</b><strong>{c ? fmtDate(payoutDate(due, c.dueDay)) : '—'}</strong></div><Pill tone="blue">{paidMonths.has(month) ? 'Upcoming' : 'Due'}</Pill></Card>
        <Card className="reminder"><Info /><div><b>Payment Reminder</b><p>Please settle your monthly contribution before the due date{c ? ` (reminder ${c.reminderDays} days before)` : ''}.</p></div></Card>
        <button className="wide" onClick={() => go('messages')}><Send /> Message Admin</button>
      </> : mine.length === 0 ? <Card><p className="muted">No payments recorded yet.</p></Card> : mine.map(x => (
        <Card key={x.id}><div className="between"><b>{fmtMonth(x.month)}</b>{x.status === 'PAID' ? <Pill>✓ Paid</Pill> : <Pill tone="orange">Pending</Pill>}</div><p>{peso(x.amount)} · {x.method ?? '—'} · {x.paidOn ? fmtDate(x.paidOn) : '—'}</p></Card>
      ))}
    </Phone>
  );
}
