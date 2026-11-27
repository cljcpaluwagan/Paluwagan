// Image pipeline:  pick -> validate -> compress -> cache on phone -> upload to Supabase Storage.
// The database stores the FILENAME (path) only. Every device resolves the path through getMedia(), which serves from the
// phone cache first and downloads from Storage only once. Files live in Supabase, so they stay available when the
// uploading phone (or the admin's phone) is switched off.
import type { Bucket, Repo } from '../types';
import { RAW_PICK_LIMIT_MB } from '../env';
import { idbDel, idbEntries, idbGet, idbPut } from './idb';
import { uid } from './format';

const CACHE_LIMIT_BYTES = 80 * 1024 * 1024;            // phone cache cap (LRU eviction)
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

interface Pending { bucket: Bucket; path: string; at: number }
type Index = Record<string, { size: number; used: number }>;
const key = (b: Bucket, p: string) => `${b}/${p}`;

export class UploadLimitError extends Error {}

export interface Prepared { blob: Blob; ext: 'webp' | 'jpg' }

/** Validates + compresses a picked photo so it fits `maxMb`. Throws a user-friendly message if it can't. */
export interface PrepareOpts { maxDim?: number; /** Output a fixed width:height frame (e.g. 2 for a 2:1 banner). The photo is stretched to fill the frame exactly. */ aspect?: number }

/** Draws `bmp` stretched to fill the whole w×h canvas exactly (no borders, no blur). */
function drawStretched(bmp: ImageBitmap, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, w, h);
  return c;
}

export async function prepareImage(file: File, maxMb: number, opts: number | PrepareOpts = {}): Promise<Prepared> {
  const { maxDim = 1280, aspect } = typeof opts === 'number' ? { maxDim: opts } : opts;
  if (!ALLOWED.includes(file.type)) throw new UploadLimitError('Please choose a JPG, PNG or WebP photo.');
  if (file.size > RAW_PICK_LIMIT_MB * 1024 * 1024) throw new UploadLimitError(`That photo is over ${RAW_PICK_LIMIT_MB} MB. Choose a smaller one.`);
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new UploadLimitError('That photo could not be read.');
  const limit = maxMb * 1024 * 1024;
  let dim = maxDim;
  for (let round = 0; round < 6; round++) {
    let c: HTMLCanvasElement;
    if (aspect) {
      const w = Math.min(dim, Math.max(bmp.width, Math.round(bmp.height * aspect))); // never upscale past the source
      c = drawStretched(bmp, Math.max(1, Math.round(w)), Math.max(1, Math.round(w / aspect)));
    } else {
      const scale = Math.min(1, dim / Math.max(bmp.width, bmp.height));
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * scale)); c.height = Math.max(1, Math.round(bmp.height * scale));
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    }
    for (const q of [0.85, 0.72, 0.6, 0.5]) {
      const blob: Blob | null = await new Promise(r => c.toBlob(r, 'image/webp', q));
      if (blob && blob.size <= limit) { bmp.close?.(); return { blob, ext: blob.type === 'image/webp' ? 'webp' : 'jpg' }; }
    }
    dim = Math.round(dim * 0.75);
  }
  bmp.close?.();
  throw new UploadLimitError(`Photo is still larger than the ${maxMb} MB limit after compression. Try a simpler photo.`);
}

async function readIndex(): Promise<Index> { return (await idbGet<Index>('kv', 'media-index')) ?? {}; }
async function touch(k: string, size: number) {
  const idx = await readIndex(); idx[k] = { size, used: Date.now() };
  let total = Object.values(idx).reduce((a, v) => a + v.size, 0);
  if (total > CACHE_LIMIT_BYTES) {
    const pending = new Set((await idbEntries<Pending>('outbox')).filter(e => e.key.startsWith('up:')).map(e => key(e.value.bucket, e.value.path)));
    for (const [ek, ev] of Object.entries(idx).sort((a, b) => a[1].used - b[1].used)) {
      if (total <= CACHE_LIMIT_BYTES * 0.8) break;
      if (pending.has(ek) || ek === k) continue;
      await idbDel('media', ek); urls.delete(ek); total -= ev.size; delete idx[ek];
    }
  }
  await idbPut('kv', 'media-index', idx);
}

const urls = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

/** Stores a prepared image on the phone and returns the filename that goes into the database (path only). */
export async function cacheImage(bucket: Bucket, blob: Blob, ext: string, ownerFolder?: string): Promise<string> {
  const path = `${ownerFolder ? ownerFolder + '/' : ''}${uid()}.${ext}`;
  await idbPut('media', key(bucket, path), blob);
  await touch(key(bucket, path), blob.size);
  return path;
}

/** Uploads a cached file to Supabase Storage. Call before saving the row that references `path`. */
export async function commitMedia(repo: Repo, bucket: Bucket, path: string): Promise<void> {
  const blob = await idbGet<Blob>('media', key(bucket, path));
  if (!blob) throw new Error('Photo is no longer on this phone. Please pick it again.');
  const p: Pending = { bucket, path, at: Date.now() };
  await idbPut('outbox', 'up:' + key(bucket, path), p);        // survives app restarts until the upload succeeds
  await repo.uploadMedia(bucket, path, blob);
  await idbDel('outbox', 'up:' + key(bucket, path));
}

/** Background retry for uploads that failed (offline, app killed...). */
export async function flushUploads(repo: Repo): Promise<number> {
  let done = 0;
  for (const { key: k, value } of await idbEntries<Pending>('outbox')) {
    if (!k.startsWith('up:')) continue;
    try { await commitMedia(repo, value.bucket, value.path); done++; } catch { /* keep for next time */ }
  }
  return done;
}
export async function pendingUploadCount(): Promise<number> { return (await idbEntries('outbox')).filter(e => e.key.startsWith('up:')).length; }

/** Resolves a stored filename to a displayable URL: phone cache first, then one download from Supabase. */
export function getMedia(repo: Repo, bucket: Bucket, path: string | null | undefined): Promise<string | null> {
  if (!path) return Promise.resolve(null);
  const k = key(bucket, path);
  const hit = urls.get(k); if (hit) return Promise.resolve(hit);
  const running = inflight.get(k); if (running) return running;
  const job = (async () => {
    let blob = await idbGet<Blob>('media', k);
    if (!blob) {
      const remote = await repo.mediaUrl(bucket, path).catch(() => null);
      if (!remote) return null;
      try { const r = await fetch(remote); if (!r.ok) return null; blob = await r.blob(); } catch { return null; }
      await idbPut('media', k, blob);
    }
    void touch(k, blob.size);
    const u = URL.createObjectURL(blob); urls.set(k, u); return u;
  })().finally(() => inflight.delete(k));
  inflight.set(k, job);
  return job;
}

export async function cacheStats() {
  const idx = await readIndex();
  return { files: Object.keys(idx).length, bytes: Object.values(idx).reduce((a, v) => a + v.size, 0), pending: await pendingUploadCount() };
}
/** Frees phone storage. Files waiting to upload are kept so nothing is lost. */
export async function clearMediaCache(): Promise<void> {
  const keep = new Set((await idbEntries<Pending>('outbox')).filter(e => e.key.startsWith('up:')).map(e => key(e.value.bucket, e.value.path)));
  const idx = await readIndex();
  for (const k of Object.keys(idx)) { if (keep.has(k)) continue; await idbDel('media', k); const u = urls.get(k); if (u) URL.revokeObjectURL(u); urls.delete(k); delete idx[k]; }
  await idbPut('kv', 'media-index', idx);
}
export const mb = (bytes: number) => (bytes / 1048576).toFixed(1) + ' MB';
