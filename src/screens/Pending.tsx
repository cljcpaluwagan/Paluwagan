import React, { useEffect, useState } from 'react';
import logo from '../assets/logo.png';
import { useApp } from '../state/AppContext';

export default function Pending() {
  const { user, refreshUser, logout, notify, brand } = useApp();
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = window.setInterval(() => { refreshUser(); }, 30000); return () => window.clearInterval(t); }, [refreshUser]);   // moves on by itself once approved
  const check = async () => { setBusy(true); const u = await refreshUser(); setBusy(false); if (u && !u.approved) notify('Not approved yet. Please wait for the Admin or Cashier.'); };
  return (
    <section className="phone login" style={brand.bg ? { backgroundImage: `linear-gradient(rgba(3,10,35,.55),rgba(3,10,35,.74)), url(${brand.bg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      <div className="login-hero"><img className="login-logo" src={brand.logo || logo} alt="Paluwagan" /></div>
      <div className="login-form">
        <b className="select-role">Waiting for approval</b>
        <p className="center">Hello {user?.name}. Your account is created. The Admin or Cashier needs to approve your membership before you can open the app.</p>
        <button onClick={check} disabled={busy}>{busy ? 'Checking…' : 'Check again'}</button>
        <a className="link" onClick={logout}>Log out</a>
      </div>
    </section>
  );
}
