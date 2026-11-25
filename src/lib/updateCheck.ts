import { APP_BUILD, GITHUB_REPO, NATIVE_HASH } from '../config';
export interface UpdateInfo { build: number; version: string; url: string; notes: string }
export interface Release { build: number; version: string; apkUrl: string; zipUrl?: string; nativeHash?: string; notes: string }

/** Latest GitHub Release (tag "build-<number>"): the APK, the web bundle (dist.zip) and the native fingerprint in the notes. */
export async function latestRelease(): Promise<Release | null> {
  if (!GITHUB_REPO) return null;
  try {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    const build = Number(String(j.tag_name || '').replace(/\D/g, ''));
    const apk = (j.assets || []).find((a: any) => String(a.name).endsWith('.apk'));
    const zip = (j.assets || []).find((a: any) => a.name === 'dist.zip');
    if (!build || !apk) return null;
    const body = String(j.body || '');
    return { build, version: `1.0.${build}`, apkUrl: apk.browser_download_url, zipUrl: zip?.browser_download_url, nativeHash: /native:([0-9a-f]{8,})/.exec(body)?.[1], notes: body.slice(0, 300) };
  } catch { return null; }
}
/** true = the new release changed native parts (icon, plugins...) so the APK must be reinstalled. false = the web bundle alone is enough. */
export const needsNative = (r: Release) => !r.zipUrl || !r.nativeHash || !NATIVE_HASH || r.nativeHash !== NATIVE_HASH;

/** Only returns something when a NEW APK is really needed. Ordinary updates are applied in the background (liveUpdate.ts). */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const r = await latestRelease();
  if (!r || r.build <= APP_BUILD || !needsNative(r)) return null;
  return { build: r.build, version: r.version, url: r.apkUrl, notes: r.notes };
}
export async function openUrl(url: string) {
  try { const { Browser } = await import('@capacitor/browser'); await Browser.open({ url }); } catch { window.open(url, '_blank'); }
}
