import React from 'react';
import { Home, Repeat2, ChartNoAxesColumn, Settings, Menu, Bell, ArrowLeft, House } from 'lucide-react';
import { useApp, Screen } from '../state/AppContext';

export function StatusBar() { return <div className="status"><b>9:41</b><span>▮▮ ◖ ▰</span></div>; }
export function Header({ title, back = false, right = 'bell' }: { title: string; back?: boolean; right?: string }) {
  const { back: goBack, go } = useApp();
  const target: Screen = right === 'home' ? 'home' : right === 'settings' ? 'settings' : 'messages';
  return (
    <div className="header">
      <span onClick={back ? goBack : () => go('settings', true)} role="button">{back ? <ArrowLeft /> : <Menu />}</span>
      <b>{title}</b>
      <span onClick={() => go(target, target !== 'messages')} role="button">{right === 'home' ? <House /> : right === 'settings' ? <Settings /> : <Bell />}</span>
    </div>
  );
}
export function BottomNav({ active = 0 }: { active?: number }) {
  const { go, user } = useApp();
  const items: { I: typeof Home; t: string; to: Screen }[] = [
    { I: Home, t: 'Home', to: 'home' }, { I: Repeat2, t: 'Collection', to: user?.role === 'MEMBER' ? 'payments' : 'collection' },
    { I: ChartNoAxesColumn, t: 'Report', to: 'reports' }, { I: Settings, t: 'Settings', to: 'settings' },
  ];
  return <nav className="bottom">{items.map(({ I, t, to }, i) => <div className={active === i ? 'selected' : ''} key={t} onClick={() => go(to, true)} role="button"><I /><small>{t}</small></div>)}</nav>;
}
export function Phone({ children, title, active = 0, back = false, right }: { children: React.ReactNode; title: string; active?: number; back?: boolean; right?: string }) {
  const { toast, busy } = useApp();
  return (
    <section className="phone">
      <StatusBar /><Header title={title} back={back} right={right} />
      <main className="screen">{children}</main>
      {(toast || busy) && <div className="toast">{busy ? 'Working…' : toast}</div>}
      <BottomNav active={active} />
    </section>
  );
}
export function Card({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) { return <div className={'card ' + className} onClick={onClick}>{children}</div>; }
export function Pill({ children, tone = 'green' }: { children: React.ReactNode; tone?: string }) { return <span className={'pill ' + tone}>{children}</span>; }
