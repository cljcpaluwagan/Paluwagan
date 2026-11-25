import React, { useState } from 'react';
import { UserRound, LockKeyhole, Eye } from 'lucide-react';
import logo from '../assets/logo.png';
import { useApp } from '../state/AppContext';
import { DEMO_MODE, DEVELOPER_CREDIT } from '../config';
import { DEMO_USERS } from '../data/demoRepo';
import { signIn } from '../data/supabaseRepo';
import type { Role } from '../types';

const ROLES: Role[] = ['ADMIN', 'CASHIER', 'MEMBER'];
export default function Login() {
  const { login, notify, toast, brand } = useApp();
  const [role, setRole] = useState<Role>('MEMBER');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      if (DEMO_MODE) { await login(DEMO_USERS.find(u => u.role === role)!); return; }
      const u = await signIn(email.trim(), pw);
      if (u.role !== role) { notify(`This account is a ${u.role}, not a ${role}. Pick ${u.role}.`); return; }
      await login(u);
    } catch (e: any) { notify(e.message || 'Login failed'); } finally { setBusy(false); }
  };
  return (
    <section className="phone login" style={brand.bg ? { backgroundImage: `linear-gradient(rgba(3,10,35,.55),rgba(3,10,35,.74)), url(${brand.bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      <div className="login-hero"><img className="login-logo" src={brand.logo || logo} alt="Paluwagan" /></div>
      <div className="login-form">
        <label><UserRound /><input placeholder={DEMO_MODE ? 'Demo mode: just pick a role' : 'Email or Username'} value={email} onChange={e => setEmail(e.target.value)} disabled={DEMO_MODE} autoCapitalize="none" /></label>
        <label><LockKeyhole /><input placeholder="Password" type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} disabled={DEMO_MODE} onKeyDown={e => e.key === 'Enter' && submit()} /><Eye className="eye" onClick={() => setShow(!show)} /></label>
        <a>Forgot Password?</a>
        <button onClick={submit} disabled={busy}>{busy ? 'Please wait…' : 'Login'}</button>
        <div className="or">or</div><b className="select-role">Select Role</b>
        <div className="roles">{ROLES.map(r => <div key={r} className={r === role ? 'on' : ''} onClick={() => setRole(r)} role="button"><UserRound /><small>{r[0] + r.slice(1).toLowerCase()}</small></div>)}</div>
        {toast && <p className="center muted">{toast}</p>}
        <footer>Church Community<br />{DEVELOPER_CREDIT}</footer>
      </div>
    </section>
  );
}
