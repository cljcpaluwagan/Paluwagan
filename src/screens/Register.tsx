import React, { useState } from 'react';
import { UserRound, Phone as PhoneIcon, Mail, LockKeyhole } from 'lucide-react';
import logo from '../assets/logo.png';
import { useApp } from '../state/AppContext';
import { DEMO_MODE } from '../config';
import { demoRegister } from '../data/demoRepo';
import { currentUser, signUp } from '../data/supabaseRepo';
import { clean, passwordIssues, validEmail, validName, validPhone } from '../lib/validate';

export default function Register() {
  const { back, login, brand } = useApp();
  const [f, setF] = useState({ name: '', phone: '', email: '', pw: '', pw2: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    const name = clean(f.name); const issues = passwordIssues(f.pw);
    if (!validName(name)) return setErr('Enter your full name (2 to 80 letters).');
    if (!validPhone(f.phone)) return setErr('Phone number looks wrong. Use digits, +, spaces or dashes.');
    if (!validEmail(f.email)) return setErr('Enter a valid email address.');
    if (issues.length) return setErr('Password needs ' + issues.join(', ') + '.');
    if (f.pw !== f.pw2) return setErr('The two passwords do not match.');
    setErr(''); setBusy(true);
    try {
      if (DEMO_MODE) { demoRegister({ name, phone: f.phone.trim() || undefined, email: f.email.trim() }); setDone('Demo registration sent. Log in as Admin or Cashier, then open Settings → Members to approve it.'); return; }
      const r = await signUp({ email: f.email, password: f.pw, name, phone: f.phone.trim() });
      if (!r.needsConfirm) { await login(await currentUser()); return; }
      setDone('Almost done. Check your email and tap the confirmation link, then log in. The Admin or Cashier will approve your membership.');
    } catch (e: any) { setErr(e.message || 'Could not create the account.'); } finally { setBusy(false); }
  };
  return (
    <section className="phone login" style={brand.bg ? { backgroundImage: `linear-gradient(rgba(3,10,35,.55),rgba(3,10,35,.74)), url(${brand.bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      <div className="login-hero small"><img className="login-logo" src={brand.logo || logo} alt="Paluwagan" /></div>
      <div className="login-form scroll">
        {done ? <><b>Registration sent</b><p className="center">{done}</p><button onClick={back}>Back to login</button></> : <>
          <b className="select-role">Create your account</b>
          <label><UserRound /><input placeholder="Full name" autoComplete="name" value={f.name} onChange={set('name')} maxLength={80} /></label>
          <label><PhoneIcon /><input placeholder="Mobile number (optional)" inputMode="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} maxLength={20} /></label>
          <label><Mail /><input placeholder="Email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={f.email} onChange={set('email')} /></label>
          <label><LockKeyhole /><input placeholder="Password (8+ with a number)" type="password" autoComplete="new-password" value={f.pw} onChange={set('pw')} maxLength={72} /></label>
          <label><LockKeyhole /><input placeholder="Repeat password" type="password" autoComplete="new-password" value={f.pw2} onChange={set('pw2')} maxLength={72} onKeyDown={e => e.key === 'Enter' && submit()} /></label>
          {err && <p className="err">{err}</p>}
          <button onClick={submit} disabled={busy}>{busy ? 'Please wait…' : 'Register'}</button>
          <a className="link" onClick={back}>I already have an account</a>
          <small className="center muted">After you register, the Admin or Cashier must approve you before you can see any data.</small></>}
      </div>
    </section>
  );
}
