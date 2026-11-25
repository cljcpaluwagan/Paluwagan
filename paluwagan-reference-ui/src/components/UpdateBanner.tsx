import React, { useCallback, useEffect, useState } from 'react';
import { checkForUpdate, openUrl, UpdateInfo } from '../lib/updateCheck';
import { APP_VERSION } from '../config';

/** Checks on launch, every 30 min, and whenever the app returns to the foreground. */
export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [hidden, setHidden] = useState(0);
  const check = useCallback(async () => setInfo(await checkForUpdate()), []);
  useEffect(() => {
    check();
    const t = window.setInterval(check, 30 * 60 * 1000);
    let off: (() => void) | undefined;
    import('@capacitor/app').then(({ App }) => App.addListener('appStateChange', s => { if (s.isActive) check(); }).then(h => { off = () => h.remove(); })).catch(() => { /* web */ });
    return () => { window.clearInterval(t); off?.(); };
  }, [check]);
  if (!info || hidden === info.build) return null;
  return (
    <div className="update-banner" role="status">
      <div><b>Update available · v{info.version}</b><small>You have v{APP_VERSION}. Download, then tap the file to install.</small></div>
      <button onClick={() => openUrl(info.url)}>Update</button>
      <button className="x" onClick={() => setHidden(info.build)} aria-label="Later">✕</button>
    </div>
  );
}
