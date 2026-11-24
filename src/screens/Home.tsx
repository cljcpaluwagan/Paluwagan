import React from 'react';
import { CalendarDays, FileText, Mail, Megaphone, Gift, Users, ClipboardList, Wallet } from 'lucide-react';
import { Phone, Card, Pill } from '../components/Phone';
import { useApp, Screen } from '../state/AppContext';
import { fmtDate, fmtMonth, monthOf, peso } from '../lib/dates';
import { slotStatus, progress } from '../lib/engine';

export default function Home() {
  const { user, snap, today, go } = useApp();
  if (!user || !snap) return null;
  const month = monthOf(today), isMember = user.role === 'MEMBER', c = snap.cycle;
  const mine = snap.contributions.find(x => x.memberId === user.memberId && x.month === month);
  const slot = snap.slots.find(s => s.memberId === user.memberId);
  const pr = c ? progress(c, snap.eligible, snap.slots, snap.payouts) : null;
  const paidNow = snap.contributions.filter(x => x.month === month && x.status === 'PAID').length;
  const tiles: [typeof Mail, string, Screen][] = isMember
    ? [[CalendarDays, 'My Payout Schedule', 'schedule'], [FileText, 'My Payment History', 'payments'], [Mail, 'Message Admin', 'messages'], [Megaphone, 'Announcements', 'messages']]
    : [[Wallet, 'Do Collection', 'collection'], [CalendarDays, 'Payout Schedule', 'schedule'], [ClipboardList, 'Cycle', 'cycle'], [Users, 'Members', 'members']];
  const st = slot ? slotStatus(slot, today) : null;
  return (
    <Phone title={snap.title} active={0}>
      <Card className="profile">
        <div className="profile-row"><div className="avatar photo">{user.name.split(' ').map(x => x[0]).join('').slice(0, 2)}</div><div><b>{user.name}</b><p>{user.role[0] + user.role.slice(1).toLowerCase()}</p><Pill>✓ Active</Pill></div></div>
        <div className="contribution"><CalendarDays />
          {isMember
            ? <div><small>My Contribution Status</small><b>{fmtMonth(month)}</b><strong>{peso(c?.contribution ?? 0)}</strong></div>
            : <div><small>{c ? c.name + ' · ' + c.status.replace(/_/g, ' ') : 'No cycle yet'}</small><b>{fmtMonth(month)}</b><strong>{paidNow} / {snap.eligible.length} paid</strong></div>}
          {isMember && (mine?.status === 'PAID' ? <Pill>✓ Paid</Pill> : <Pill tone="orange">Pending</Pill>)}
        </div>
      </Card>
      <div className="tiles">{tiles.map(([I, t, to]) => <Card key={t} onClick={() => go(to)}><I /><b>{t}</b></Card>)}</div>
      {isMember
        ? <Card className="next-payout" onClick={() => go('schedule')}><Gift /><div><b>Next Payout</b><strong>{slot ? fmtDate(slot.date) : 'Not scheduled'}</strong></div>{st && <Pill tone={st === 'RELEASED' ? 'green' : st === 'READY_FOR_RELEASE' ? 'orange' : 'blue'}>{st === 'RELEASED' ? '✓ Received' : st === 'READY_FOR_RELEASE' ? 'Ready' : 'Scheduled'}</Pill>}</Card>
        : <Card className="next-payout" onClick={() => go('cycle')}><Gift /><div><b>Payout Progress</b><strong>{pr ? `${pr.paid} of ${pr.eligible} paid out (${pr.pct}%)` : '—'}</strong></div></Card>}
    </Phone>
  );
}
