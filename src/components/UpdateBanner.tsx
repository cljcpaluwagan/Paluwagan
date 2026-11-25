import React, { useCallback, useEffect, useState } from 'react';
import { checkForUpdate, openUrl, UpdateInfo } from '../lib/updateCheck';
import { applyLiveUpdate } from '../lib/liveUpdate';
import { APP_VERSION } from '../config';

/** On launch / every 30 min / when reopened: (1) ordinary updates download and apply by themselves, (2) only native changes show the Update button. */
export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [ready, setReady] = useState('');
  const [hidden, setHidden] = useState(0);
  const check = useCallback(async (first: boolean) => {
    try { const v = await applyLiveUpdate(first); if (v && !first) setReady(v); } catch { /* offline or blocked: try again later */ }
    setInfo(await checkForUpdate());
  }, []);
  useEffect(() => {
    check(true);
    const t = window.setInterval(() => check(false), 30 * 60 * 1000);
    let off: (() => void) | undefined;
    import('@capacitor/app').then(({ App }) => App.addListener('appStateChange', s => { if (s.isActive) check(false); }).then(h => { off = () => h.remove(); })).catch(() => { /* web */ });
    return () => { window.clearInterval(t); off?.(); };
  }, [check]);
  if (ready) return <div className="update-banner" role="status"><div><b>Update downloaded · v{ready}</b><small>It will apply the next time you open the app.</small></div><button className="x" onClick={() => setReady('')} aria-label="Close">✕</button></div>;
  if (!info || hidden === info.build) return null;
  return (
    <div className="update-banner" role="status">
      <div><b>New app version · v{info.version}</b><small>You have v{APP_VERSION}. This one needs a quick reinstall: download, then tap the file.</small></div>
      <button onClick={() => openUrl(info.url)}>Update</button>
      <button className="x" onClick={() => setHidden(info.build)} aria-label="Later">✕</button>
    </div>
  );
}
