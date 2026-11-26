import React, { useEffect, useState } from 'react';
import { UserRound, LockKeyhole, Eye } from 'lucide-react';
import logo from '../assets/logo.png';
import { useApp } from '../state/AppContext';
import { DEMO_MODE, DEVELOPER_CREDIT } from '../config';
import { DEMO_USERS, getDemoUser } from '../data/demoRepo';
import { resetPassword, signIn } from '../data/supabaseRepo';
import { fresh, loadLock, onFail, remainingSeconds, saveLock } from '../lib/throttle';
import { validEmail } from '../lib/validate';
import type { Role } from '../types';

const ROLES: Role[] = ['ADMIN', 'CASHIER', 'MEMBER'];
export default function Login() {
  const { login, notify, toast, brand, go } = useApp();
  const [role, setRole] = useState<Role>('MEMBER');   // demo only: the real app takes the role from the server
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false);
  const [lock, setLock] = useState(loadLock()); const [now, setNow] = useState(Date.now());
  const wait = remainingSeconds(lock, now);
  useEffect(() => { if (wait <= 0) return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, [wait]);

  const submit = async () => {
    if (busy) return;
    if (!DEMO_MODE) {
      if (remainingSeconds(lock, Date.now()) > 0) return;
      if (!validEmail(email) || !pw) { notify('Enter your email and password.'); return; }
    }
    setBusy(true);
    try {
      if (DEMO_MODE) { await login(getDemoUser(DEMO_USERS.find(u => u.role === role)!.id)!); return; }
      const u = await signIn(email, pw);
      setLock(fresh()); saveLock(fresh()); setPw('');
      await login(u);
    } catch (e: any) {
      const l = onFail(lock, Date.now()); setLock(l); saveLock(l); setNow(Date.now());
      notify(e.message || 'Login failed');
    } finally { setBusy(false); }
  };
  const forgot = async () => {
    if (DEMO_MODE) { notify('Password reset works with a real account.'); return; }
    if (!validEmail(email)) { notify('Type your email above first.'); return; }
    await resetPassword(email); notify('If that email has an account, a reset link was sent.');
  };
  return (
    <section className="phone login" style={brand.bg ? { backgroundImage: `linear-gradient(rgba(3,10,35,.55),rgba(3,10,35,.74)), url(${brand.bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      <div className="login-hero"><img className="login-logo" src={brand.logo || logo} alt="Paluwagan" /></div>
      <div className="login-form">
        <label><UserRound /><input type="email" inputMode="email" autoComplete="username" autoCapitalize="none" placeholder={DEMO_MODE ? 'Demo mode: just pick a role' : 'Email'} value={email} onChange={e => setEmail(e.target.value)} disabled={DEMO_MODE} /></label>
        <label><LockKeyhole /><input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} disabled={DEMO_MODE} onKeyDown={e => e.key === 'Enter' && submit()} /><Eye className="eye" onClick={() => setShow(!show)} /></label>
        <a onClick={forgot}>Forgot Password?</a>
        <button onClick={submit} disabled={busy || wait > 0}>{wait > 0 ? `Too many tries. Wait ${wait}s` : busy ? 'Please wait…' : 'Login'}</button>
        {DEMO_MODE && <><div className="or">or</div><b className="select-role">Select Role</b>
          <div className="roles">{ROLES.map(r => <div key={r} className={r === role ? 'on' : ''} onClick={() => setRole(r)} role="button"><UserRound /><small>{r[0] + r.slice(1).toLowerCase()}</small></div>)}</div></>}
        <a className="link" onClick={() => go('register')}>New here? Create an account</a>
        {toast && <p className="center muted">{toast}</p>}
        <footer>Church Community<br />{DEVELOPER_CREDIT}</footer>
      </div>
    </section>
  );
}
