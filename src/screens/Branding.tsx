import React, { useRef } from 'react';
import { Phone, Card } from '../components/Phone';
import { useApp } from '../state/AppContext';
import { can } from '../lib/permissions';
import { fileToDataUrl } from '../lib/image';
import { Btn, Note, Title } from '../components/ui';
import defaultLogo from '../assets/logo.png';

export default function Branding() {
  const { user, brand, run, notify } = useApp();
  const logoIn = useRef<HTMLInputElement>(null), bgIn = useRef<HTMLInputElement>(null);
  if (!user) return null;
  if (!can(user.role, 'settings.general')) return <Phone title="Logo & Background" active={3} back><Note tone="warn">Only the Admin can change the logo and background.</Note></Phone>;
  const pick = async (f: File | undefined, kind: 'logo' | 'background') => {
    if (!f) return;
    try {
      const data = kind === 'logo' ? await fileToDataUrl(f, 320, 'image/png') : await fileToDataUrl(f, 960, 'image/jpeg', 0.72);
      await run(r => r.setBranding(kind === 'logo' ? { logo: data } : { background: data }), kind === 'logo' ? 'Logo updated' : 'Background updated');
    } catch (e: any) { notify(e.message || 'Upload failed'); }
  };
  return (
    <Phone title="Logo & Background" active={3} back>
      <Note>Shared with everyone in the group. The phone's home-screen app icon is part of the app build and does not change here.</Note>
      <Title>Group logo</Title>
      <Card className="brand-card"><img className="brand-logo" src={brand.logo || defaultLogo} alt="Logo" />
        <div className="btn-row"><Btn onClick={() => logoIn.current?.click()}>Upload image</Btn><Btn tone="ghost" onClick={() => run(r => r.setBranding({ logo: null }), 'Logo reset')}>Use default</Btn></div>
        <input ref={logoIn} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files?.[0], 'logo'); e.target.value = ''; }} /></Card>
      <Title>App background</Title>
      <Card className="brand-card"><div className="brand-bg" style={brand.bg ? { backgroundImage: `url(${brand.bg})` } : undefined}>{!brand.bg && <small>Default dark blue</small>}</div>
        <div className="btn-row"><Btn onClick={() => bgIn.current?.click()}>Upload image</Btn><Btn tone="ghost" onClick={() => run(r => r.setBranding({ background: null }), 'Background reset')}>Use default</Btn></div>
        <input ref={bgIn} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files?.[0], 'background'); e.target.value = ''; }} /></Card>
    </Phone>
  );
}
