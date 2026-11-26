import React, { useState } from 'react';
import { Phone, Card, Pill } from '../components/Phone';
import { useApp } from '../state/AppContext';
import { Btn, Field, Title } from '../components/ui';
import { DEMO_MODE, IDLE_MINUTES } from '../config';
import { changePassword } from '../data/supabaseRepo';
import { clean, passwordIssues, validName, validPhone } from '../lib/validate';

export default function Profile() {
  const { user, run, notify, logout, refreshUser } = useApp();
  const [name, setName] = useState(user?.name ?? ''); const [phone, setPhone] = useState(user?.phone ?? '');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  if (!user) return null;
  const save = async () => {
    if (!validName(name)) return notify('Enter your full name (2 to 80 letters).');
    if (!validPhone(phone)) return notify('Phone number looks wrong.');
    if (await run(r => r.updateMyProfile({ name: clean(name), phone: phone.trim() || undefined }), 'Profile saved')) await refreshUser();
  };
  const newPassword = async () => {
    const issues = passwordIssues(pw);
    if (issues.length) return notify('Password needs ' + issues.join(', ') + '.');
    if (pw !== pw2) return notify('The two passwords do not match.');
    try { await changePassword(pw); setPw(''); setPw2(''); notify('Password changed'); } catch (e: any) { notify(e.message || 'Could not change the password'); }
  };
  return (
    <Phone title="My Profile" active={3} back right="settings">
      <Card className="form">
        <div className="between"><b>{user.name}</b><Pill tone="blue">{user.role[0] + user.role.slice(1).toLowerCase()}</Pill></div>
        <small className="muted">{user.email ?? '—'}</small>
        <Field label="Full name"><input value={name} maxLength={80} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Mobile number"><input value={phone} inputMode="tel" maxLength={20} onChange={e => setPhone(e.target.value)} /></Field>
        <Btn onClick={save}>Save profile</Btn>
        <small className="muted">Your role and membership can only be changed by an Admin.</small>
      </Card>
      {!DEMO_MODE && <><Title>Change password</Title><Card className="form">
        <Field label="New password (8+ characters, letters and a number)"><input type="password" autoComplete="new-password" value={pw} maxLength={72} onChange={e => setPw(e.target.value)} /></Field>
        <Field label="Repeat new password"><input type="password" autoComplete="new-password" value={pw2} maxLength={72} onChange={e => setPw2(e.target.value)} /></Field>
        <Btn onClick={newPassword}>Change password</Btn></Card></>}
      <Title>Security</Title>
      <Card className="form"><small className="muted">For your safety the app signs you out after {IDLE_MINUTES} minutes without use.</small><Btn tone="danger" onClick={logout}>Log out</Btn></Card>
    </Phone>
  );
}
