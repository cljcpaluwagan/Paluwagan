import React from 'react';
import { RotateCw, Info } from 'lucide-react';
import { Phone, Card, Pill } from '../components/Phone';
import { useApp } from '../state/AppContext';
import { fmtDate, fmtMonth, todayISO } from '../lib/dates';
import { slotStatus, sortSlots, progress } from '../lib/engine';
import { can } from '../lib/permissions';
import { Btn, Note } from '../components/ui';

export default function Schedule() {
  const { user, snap, today, run, nameOf } = useApp();
  if (!user || !snap) return null;
  const c = snap.cycle; const slots = sortSlots(snap.slots);
  if (!c) return <Phone title="Payout Schedule" active={1} back right="settings"><Card><p className="muted">No payout cycle yet.</p></Card></Phone>;
  const months = [...new Set(slots.map(s => s.month))];
  const pr = progress(c, snap.eligible, snap.slots, snap.payouts);
  const canRelease = can(user.role, 'payout.release') && (c.status === 'ACTIVE' || c.status === 'AWAITING_COMPLETION');
  const release = (id: string) => {
    const ref = window.prompt(`Release payout to ${nameOf(slots.find(s => s.id === id)!.memberId)}?\nTransaction reference (optional):`, '');
    if (ref === null) return;
    run(r => r.confirmPayout({ slotId: id, releasedOn: todayISO(), ref }), 'Payout release confirmed');
  };
  return (
    <Phone title="Payout Schedule" active={1} back right="settings">
      <Card className="rotation"><RotateCw /><div><b>Automatic Payout Rotation</b><small>{c.perMonth} member{c.perMonth > 1 ? 's' : ''} per month • Starting: {slots[0] ? fmtDate(slots[0].date) : fmtMonth(c.startMonth)}</small></div></Card>
      {!c.scheduleFinal && <Note tone="warn">Schedule is not final yet. The Cashier is still preparing it.</Note>}
      {pr.extended && <Note>This cycle needs {pr.months} months. The 12-month target was extended automatically so everyone gets paid.</Note>}
      {months.map(m => {
        const ms = slots.filter(s => s.month === m); const sts = ms.map(s => slotStatus(s, today));
        const all = sts.every(x => x === 'RELEASED'), ready = sts.includes('READY_FOR_RELEASE');
        return (
          <Card className="schedule-row sched-col" key={m}>
            <div className="sr-top"><b>{fmtMonth(m)}</b>
              <div className="people-col">{ms.map(s => <div className={'person' + (s.memberId === user.memberId ? ' me' : '')} key={s.id}><span className="mini-avatar">{nameOf(s.memberId)[0]}</span><span>{nameOf(s.memberId)}<small> · {fmtDate(s.date)}</small></span>
                {s.status === 'RELEASED' ? <Pill>✓ Released</Pill> : canRelease && slotStatus(s, today) === 'READY_FOR_RELEASE' ? <Btn onClick={() => release(s.id)}>Release</Btn> : <Pill tone={slotStatus(s, today) === 'READY_FOR_RELEASE' ? 'orange' : 'blue'}>{slotStatus(s, today) === 'READY_FOR_RELEASE' ? 'Ready' : 'Scheduled'}</Pill>}</div>)}</div></div>
            <div className="sr-foot"><Pill tone={all ? 'green' : ready ? 'orange' : 'blue'}>{all ? '✓ Released' : ready ? 'Ready for release' : 'Scheduled'}</Pill></div>
          </Card>);
      })}
      <Card className="info"><Info />A scheduled payout is not a paid payout. It becomes Released only when the Cashier confirms the actual release.</Card>
    </Phone>
  );
}
