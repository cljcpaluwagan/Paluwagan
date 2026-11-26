import React from 'react';
import { RotateCw } from 'lucide-react';
import { Phone, Card, Pill } from '../components/Phone';
import { useApp } from '../state/AppContext';
import { fmtDate, fmtMonth, todayISO } from '../lib/dates';
import { canRelease, payoutStage, sortSlots, progress } from '../lib/engine';
import { stageText } from '../lib/stage';
import { can } from '../lib/permissions';
import { Btn, Note, Title } from '../components/ui';
import type { Slot } from '../types';

export default function Schedule() {
  const { user, snap, today, run, nameOf } = useApp();
  if (!user || !snap) return null;
  const c = snap.cycle; const slots = sortSlots(snap.slots);
  if (!c) return <Phone title="Payout Schedule" active={1} back right="settings"><Card><p className="muted">No payout cycle yet.</p></Card></Phone>;
  const months = [...new Set(slots.map(s => s.month))];
  const pr = progress(c, snap.eligible, snap.slots, snap.payouts);
  const running = c.status === 'ACTIVE' || c.status === 'AWAITING_COMPLETION';
  const stage = (s: Slot) => payoutStage(s, snap.eligible, snap.contributions, today);
  const release = (s: Slot) => {
    const ref = window.prompt(`Release the payout to ${nameOf(s.memberId)}?\nTransaction reference (optional):`, '');
    if (ref === null) return;
    run(r => r.confirmPayout({ slotId: s.id, releasedOn: todayISO(), ref }), 'Payout released successfully');
  };
  return (
    <Phone title="Payout Schedule" active={1} back right="settings">
      <Card className="rotation"><RotateCw /><div><b>Automatic Payout Rotation</b><small>{c.perMonth} member{c.perMonth > 1 ? 's' : ''} per month • Starting: {slots[0] ? fmtDate(slots[0].date) : fmtMonth(c.startMonth)}</small></div></Card>
      {!c.scheduleFinal && <Note tone="warn">Schedule is not final yet. The Cashier is still preparing it.</Note>}
      {pr.extended && <Note>This cycle needs {pr.months} months. The 12-month target was extended automatically so everyone gets paid.</Note>}
      {months.map(m => (
        <Card className="schedule-row sched-col" key={m}>
          <div className="sr-top"><b>{fmtMonth(m)}</b>
            <div className="people-col">{slots.filter(s => s.month === m).map(s => {
              const i = stage(s), t = stageText(i);
              return (
                <div key={s.id}>
                  <div className={'person' + (s.memberId === user.memberId ? ' me' : '')}><span className="mini-avatar">{nameOf(s.memberId)[0]}</span><span>{nameOf(s.memberId)}<small> · {fmtDate(s.date)}</small></span>
                    {running && can(user.role, 'payout.release') && canRelease(i, s, today) ? <Btn onClick={() => release(s)}>Release</Btn> : <Pill tone={t.tone}>{t.short}</Pill>}</div>
                  {i.stage !== 'RELEASED' && i.stage !== 'SCHEDULED' && <small className="stage-note">{t.long}</small>}
                </div>);
            })}</div></div>
        </Card>))}
      <Title>What the status means</Title>
      <Card className="info legend">
        <small><b>Waiting 12/15</b> · other members have not paid yet</small>
        <small><b>Waiting</b> · everyone paid, waiting for the payout date</small>
        <small><b>Processing</b> · from the day before the date, the Cashier prepares the payout</small>
        <small><b>Released ✓</b> · the Cashier confirmed the payout was given</small>
        <small className="muted">A scheduled date never pays by itself. Only the Cashier's confirmation counts.</small>
      </Card>
    </Phone>
  );
}
