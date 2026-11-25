import { APP_BUILD, GITHUB_REPO } from '../config';
export interface UpdateInfo { build: number; version: string; url: string; notes: string }

/** Looks at the latest GitHub Release (tag "build-<number>"). Returns info only if it is newer than this installed build. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!GITHUB_REPO) return null;
  try {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    const build = Number(String(j.tag_name || '').replace(/\D/g, ''));
    const apk = (j.assets || []).find((a: any) => String(a.name).endsWith('.apk'));
    if (!build || !apk || build <= APP_BUILD) return null;
    return { build, version: `1.0.${build}`, url: apk.browser_download_url, notes: String(j.body || '').slice(0, 300) };
  } catch { return null; }
}
export async function openUrl(url: string) {
  try { const { Browser } = await import('@capacitor/browser'); await Browser.open({ url }); } catch { window.open(url, '_blank'); }
}
