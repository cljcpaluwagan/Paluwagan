import { Capacitor } from '@capacitor/core';
import { APP_BUILD } from '../config';
import { latestRelease, needsNative } from './updateCheck';

let pending = '';
/** Must run once the app has started. If it does not, the plugin rolls back to the last working version. */
export async function liveUpdateReady() {
  if (!Capacitor.isNativePlatform()) return;
  try { const { CapacitorUpdater } = await import('@capgo/capacitor-updater'); await CapacitorUpdater.notifyAppReady(); } catch { /* ignore */ }
}
/** Downloads the new web bundle from the latest GitHub Release. immediate = reload now, otherwise it applies the next time the app opens. Returns the version, or null if nothing to do. */
export async function applyLiveUpdate(immediate: boolean): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const r = await latestRelease();
  if (!r || r.build <= APP_BUILD || !r.zipUrl || needsNative(r) || (!immediate && pending === r.version)) return null;
  const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
  const bundle = await CapacitorUpdater.download({ url: r.zipUrl, version: r.version });
  if (immediate) await CapacitorUpdater.set(bundle); else { await CapacitorUpdater.next(bundle); pending = r.version; }
  return r.version;
}
