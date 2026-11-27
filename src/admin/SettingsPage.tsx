import { useEffect, useState } from 'react';
import { CloudUpload, Database, Trash2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../data/store';
import { cacheStats, clearMediaCache, commitMedia, flushUploads, mb } from '../lib/media';
import { APP_VERSION } from '../env';
import { isVersion } from '../lib/version';
import type { Release } from '../types';
import { Field, ImagePicker, StoredImage, TopBar } from '../ui/kit';
import type { Nav } from './AdminApp';

function PublishUpdate() {
  const { repo, run, toast } = useApp();
  const [f, setF] = useState<Release>({ app: 'client', latestVersion: '', minVersion: '1.0.0', apkUrl: '', notes: '', forceUpdate: true });
  const [cur, setCur] = useState<Record<string, string>>({});
  useEffect(() => { void Promise.all((['client', 'admin'] as const).map(a => repo.latestRelease(a).then(r => [a, r?.latestVersion ?? '—'] as const))).then(x => setCur(Object.fromEntries(x))); }, [repo]);
  async function publish() {
    if (!isVersion(f.latestVersion) || !isVersion(f.minVersion)) return toast('Versions must look like 1.2.0', 'err');
    if (!/^https:\/\//.test(f.apkUrl.trim())) return toast('APK link must start with https://', 'err');
    await run(() => repo.publishRelease({ ...f, apkUrl: f.apkUrl.trim() }), `Update v${f.latestVersion} published for ${f.app}`);
  }
  return (
    <div className="card mt-4">
      <b className="font-display text-[17px]">Publish app update</b>
      <p className="mt-1 text-[12px] text-[color:var(--muted)]">Live now — Client: <b>{cur.client ?? '…'}</b> · Admin: <b>{cur.admin ?? '…'}</b>. This phone: v{APP_VERSION}. Phones show the popup only when the new version is higher than the one installed.</p>
      <Field label="App"><select className="input" value={f.app} onChange={e => setF({ ...f, app: e.target.value as Release['app'] })}><option value="client">Client app</option><option value="admin">Admin app</option></select></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="New version"><input className="input" placeholder="1.2.0" value={f.latestVersion} onChange={e => setF({ ...f, latestVersion: e.target.value })} /></Field><Field label="Minimum allowed"><input className="input" placeholder="1.0.0" value={f.minVersion} onChange={e => setF({ ...f, minVersion: e.target.value })} /></Field></div>
      <Field label="APK download link (https)"><input className="input" inputMode="url" placeholder="https://github.com/…/EatMate-Client-v1.2.0.apk" value={f.apkUrl} onChange={e => setF({ ...f, apkUrl: e.target.value })} /></Field>
      <Field label="What's new"><input className="input" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Faster ordering, bug fixes" /></Field>
      <label className="mt-3 flex items-center gap-2 text-[14px]"><input type="checkbox" className="h-5 w-5 accent-yellow-500" checked={f.forceUpdate} onChange={e => setF({ ...f, forceUpdate: e.target.checked })} /> Force update (users cannot skip)</label>
      <button className="btn mt-4" onClick={publish}>Publish update</button>
    </div>
  );
}

export function SettingsPage({ nav }: { nav: Nav }) {
  const { snap, repo, run, signOut, toast, online, refresh } = useApp(); const [bn, setBn] = useState({ path: snap.settings.bannerPath, title: snap.settings.bannerTitle, subtitle: snap.settings.bannerSubtitle }); const [bnBusy, setBnBusy] = useState(false); const [code, setCode] = useState(''); const [showCode, setShowCode] = useState(false);
  useEffect(() => { void repo.adminCode().then(setCode).catch(() => setCode('')); }, [repo]); const [s, setS] = useState(snap.settings); const [cache, setCache] = useState({ files: 0, bytes: 0, pending: 0 });
  useEffect(() => { void cacheStats().then(setCache); }, []);
  const n = (k: keyof typeof s) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) });
  return (
    <>
      <TopBar title="System Settings" onBack={() => nav.go({ more: null })} />
      <div className="scroll">
        <div className="card">
          <b className="font-display text-[17px]">Business</b>
          <Field label="Business name"><input className="input" value={s.businessName} onChange={e => setS({ ...s, businessName: e.target.value })} /></Field>
          <Field label="GCash number (shown to customers)"><input className="input" inputMode="tel" value={s.gcashNumber} onChange={e => setS({ ...s, gcashNumber: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Delivery fee (₱)"><input className="input" type="number" min="0" inputMode="decimal" value={s.deliveryFee} onChange={n('deliveryFee')} /></Field><Field label="Default orders / day"><input className="input" type="number" min="0" inputMode="numeric" value={s.defaultCapacity} onChange={n('defaultCapacity')} /></Field></div>
          <Field label={`Target profit margin: ${s.targetMarginPct}%`}><input type="range" min="10" max="90" step="5" className="w-full accent-yellow-500" value={s.targetMarginPct} onChange={n('targetMarginPct')} /></Field>
        </div>
        <div className="card mt-3">
          <b className="font-display text-[17px]">Photo upload limit</b>
          <Field label={`Maximum photo size: ${s.maxUploadMb} MB`}><input type="range" min="1" max="10" step="1" className="w-full accent-yellow-500" value={s.maxUploadMb} onChange={n('maxUploadMb')} /></Field>
          <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--muted)]">Photos are resized on the phone to fit this limit, then uploaded. In live mode this also updates the real Supabase Storage bucket limit, so oversized files are rejected by the server too. Applies to every customer and admin device.</p>
        </div>
        <button className="btn mt-4" onClick={() => run(() => repo.saveSettings(s), 'Settings saved ✓')}>Save settings</button>

        <PublishUpdate />
        <div className="card mt-4">
          <div className="row"><Database size={20} className="text-gold-dark" /><div className="flex-1"><b>Sync & storage</b><p className="text-[12.5px] text-[color:var(--muted)]">{repo.mode === 'supabase' ? 'Connected to Supabase' : 'Demo mode — Supabase not configured'} · {online ? 'online' : 'offline'}<br />{cache.files} photos cached on this phone ({mb(cache.bytes)}) · {cache.pending} waiting to upload</p></div></div>
          <div className="mt-3 flex gap-2"><button className="btn-line btn-sm" onClick={async () => { const n2 = await flushUploads(repo); setCache(await cacheStats()); toast(n2 ? `${n2} photo(s) uploaded` : 'Nothing waiting to upload', 'ok'); }}><CloudUpload size={15} /> Sync now</button>
            <button className="btn-line btn-sm" onClick={async () => { await clearMediaCache(); setCache(await cacheStats()); toast('Phone photo cache cleared', 'ok'); }}><Trash2 size={15} /> Clear cache</button></div>
        </div>
        <div className="card mt-4">
          <b className="font-display text-[17px]">Home banner</b>
          <p className="mt-1 text-[12.5px] text-[color:var(--muted)]">The big picture at the top of the customer app. Use a wide, bright photo of your food.</p>
          <div className="mt-3 overflow-hidden rounded-2xl"><StoredImage bucket="menu-images" path={bn.path} className="w-full" style={{ aspectRatio: "2 / 1" }} alt="Banner preview" /></div>
          <div className="mt-3"><ImagePicker bucket="menu-images" value={bn.path} onChange={p => setBn({ ...bn, path: p })} label="Choose banner photo" aspect={2} /></div>
          <Field label="Headline"><input className="input" maxLength={60} value={bn.title} onChange={e => setBn({ ...bn, title: e.target.value })} /></Field>
          <Field label="Second line"><input className="input" maxLength={60} value={bn.subtitle} onChange={e => setBn({ ...bn, subtitle: e.target.value })} /></Field>
          <button className="btn btn-sm mt-4" disabled={bnBusy} onClick={async () => {
            setBnBusy(true);
            try { if (bn.path && bn.path !== snap.settings.bannerPath) await commitMedia(repo, 'menu-images', bn.path); await repo.saveBanner(bn); await refresh(); toast('Banner saved ✓', 'ok'); }
            catch (e) { toast(e instanceof Error ? e.message : 'Could not save banner', 'err'); } finally { setBnBusy(false); }
          }}>Save banner</button>
        </div>
        <div className="card mt-4">
          <div className="row"><ShieldCheck size={20} className="text-gold-dark" /><div className="flex-1"><b>Admin access</b><p className="text-[12.5px] text-[color:var(--muted)]">Give this code to someone you trust. They register in the Admin app and enter it. It changes automatically after each use.</p></div></div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-ink px-4 py-3"><span className="flex-1 select-all font-mono text-[18px] font-bold tracking-[.25em] text-gold-2">{showCode ? (code || '—') : '••••••••••••'}</span>
            <button className="iconbtn" aria-label="Show code" onClick={() => setShowCode(!showCode)}>{showCode ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          <div className="mt-3 flex gap-2"><button className="btn-line btn-sm" onClick={() => { void navigator.clipboard?.writeText(code); toast('Admin code copied', 'ok'); }}>Copy</button>
            <button className="btn-line btn-sm" onClick={async () => { if (confirm('Create a new code? The old one stops working.')) { try { setCode(await repo.regenerateAdminCode()); setShowCode(true); toast('New admin code created', 'ok'); } catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'err'); } } }}>New code</button></div>
        </div>
        <button className="btn-danger mt-4" onClick={signOut}>Logout</button>
        <p className="mt-4 text-center text-[11px] text-[color:var(--muted)]">EatMate Admin · v{APP_VERSION}</p>
      </div>
    </>
  );
}
