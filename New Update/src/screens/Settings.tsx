import React from 'react';
import { ChevronRight, LogOut, Users, Bell, Smartphone, Info, CalendarCog, ClipboardList, Building2 } from 'lucide-react';
import { Phone, Card } from '../components/Phone';
import logo from '../assets/logo.png';
import { useApp, Screen } from '../state/AppContext';
import { can } from '../lib/permissions';
import { APP_VERSION, DEVELOPER_CREDIT } from '../config';
import { checkForUpdate, openUrl } from '../lib/updateCheck';

export default function Settings() {
  const { user, snap, go, logout, run, notify } = useApp();
  if (!user || !snap) return null;
  const staff = can(user.role, 'member.manage');
  const editTitle = () => { const t = window.prompt('Group / app title', snap.title); if (t && t.trim()) run(r => r.setTitle(t), 'Title updated'); };
  const update = async () => {
    const u = await checkForUpdate();
    if (!u) return notify(`You're up to date (v${APP_VERSION}).`);
    if (window.confirm(`Version ${u.version} is available. Download now?`)) openUrl(u.url);
  };
  const rows: [typeof Users, string, () => void, boolean][] = [
    [Building2, 'Group Information', editTitle, can(user.role, 'settings.general')],            // Admin only
    [CalendarCog, 'Payout Settings', () => go('payoutSettings'), staff],                           // Cashier full access, Admin read
    [ClipboardList, 'Cycle Management', () => go('cycle'), staff],
    [Users, 'Members', () => go('members'), staff],
    [CalendarCog, 'My Payout Schedule', () => go('schedule'), !staff],
    [Bell, 'Notification Settings', () => notify(`Reminders are set per cycle in Payout Settings.`), true],
    [Smartphone, `App Version v${APP_VERSION} · Check for updates`, update, true],
    [Info, 'About Application', () => notify(`Paluwagan v${APP_VERSION} · ${DEVELOPER_CREDIT}`), true],
  ];
  return (
    <Phone title="Settings" active={3} back right="settings">
      <Card className="group"><img className="group-pic" src={logo} alt="Paluwagan" /><div><b>{snap.title}</b><small>Faith • Unity • Sharing</small></div><ChevronRight /></Card>
      <Card className="settings-list">{rows.filter(r => r[3]).map(([I, t, fn]) => <div className="setting-row" key={t} onClick={fn} role="button"><I /><b>{t}</b><ChevronRight /></div>)}</Card>
      <button className="logout" onClick={logout}><LogOut /> Log Out</button>
      <p className="center muted version">{DEVELOPER_CREDIT}</p>
    </Phone>
  );
}
