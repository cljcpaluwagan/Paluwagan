import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Loader2, WifiOff, X } from 'lucide-react';
import logo from '../assets/logo.png';
import { useApp } from '../data/store';
import { cacheImage, getMedia, mb, prepareImage } from '../lib/media';
import { EMOJI, TIME_SLOTS, addDays, iso, peso, todayISO } from '../lib/format';
import type { Bucket, DayInfo, OrderStatus } from '../types';
import { STATUS_LABEL } from './Anim';

/** Props that stop Android / Google autofill from filling or re-filling saved emails, passwords and addresses. */
export const noFill = { autoComplete: 'off', autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false, 'data-lpignore': 'true', 'data-1p-ignore': 'true', 'data-form-type': 'other' } as const;

/** Centered popup used for success / info messages. */
export function ModalCard({ icon, tone = 'orange', title, children, action, onAction }: { icon: ReactNode; tone?: 'orange' | 'green'; title: string; children: ReactNode; action: string; onAction: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#2B1408]/65 px-6" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="pop w-full max-w-[340px] rounded-3xl bg-white p-6 text-center shadow-2xl">
        <span className={'mx-auto grid h-16 w-16 place-items-center rounded-full ' + (tone === 'green' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-gold')}>{icon}</span>
        <h2 className="mt-3 font-display text-[22px] font-bold text-ink">{title}</h2>
        <div className="mt-2 text-[14px] leading-relaxed text-black/70">{children}</div>
        <button className="btn btn-compact mt-5" onClick={onAction}>{action}</button>
      </div>
    </div>
  );
}

export const Logo = ({ size = 40 }: { size?: number }) => <img src={logo} width={size} height={size} alt="EatMate Bollima" className="rounded-full" style={{ width: size, height: size, objectFit: 'contain' }} />;

export function TopBar({ title, onBack, right, left }: { title: string; onBack?: () => void; right?: ReactNode; left?: ReactNode }) {
  return (
    <header className="topbar">
      {onBack ? <button className="iconbtn" onClick={onBack} aria-label="Back"><ChevronLeft size={20} /></button> : left ?? <Logo size={36} />}
      <h1>{title}</h1>
      <div className="flex min-w-9 justify-end gap-2">{right}</div>
    </header>
  );
}

export function Pill({ status }: { status: OrderStatus }) { return <span className={`pill p-${status}`}>{STATUS_LABEL[status]}</span>; }
export const Tag = ({ tone, children }: { tone: 'gold' | 'red' | 'green'; children: ReactNode }) => <span className={`pill p-${tone}`}>{children}</span>;

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl font-bold">{title}</h2><button className="iconbtn !border-black/10 !bg-black/5 !text-ink" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="label">{label}</span>{children}</label>; }

export function Toasts() { const { toasts } = useApp(); return <div className="toastbox">{toasts.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>; }

export function Banner() {
  const { online, stale, repo } = useApp();
  if (!online) return <div className="flex items-center gap-2 bg-red-900 px-4 py-1.5 text-[12px] font-semibold text-white"><WifiOff size={14} /> Offline — showing saved data</div>;
  if (stale) return <div className="bg-amber-700 px-4 py-1.5 text-[12px] font-semibold text-white">Couldn’t refresh — showing last saved data</div>;
  if (repo.mode === 'demo') return <div className="bg-gold/90 px-4 py-1 text-center text-[11px] font-bold text-ink">DEMO MODE · data stays on this phone · connect Supabase to go live</div>;
  return null;
}

export function TabBar<T extends string>({ tabs, value, onChange, badges = {} }: { tabs: { id: T; label: string; icon: ReactNode }[]; value: T; onChange: (t: T) => void; badges?: Partial<Record<T, number>> }) {
  return (
    <nav className="tabbar">
      {tabs.map(t => (
        <button key={t.id} aria-label={t.label} className={'tab' + (value === t.id ? ' on' : '')} onClick={() => onChange(t.id)}>
          <span className="relative grid place-items-center">{t.icon}{!!badges[t.id] && <i className="badge not-italic">{badges[t.id]}</i>}</span><span className="t">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/** Shows a stored FILENAME as an image: phone cache first, then one download from Supabase Storage. Falls back to an emoji tile. */
export function StoredImage({ bucket, path, category, className = '', alt = '', style }: { bucket: Bucket; path: string | null | undefined; category?: string; className?: string; alt?: string; style?: CSSProperties }) {
  const { repo } = useApp();
  const [src, setSrc] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  useEffect(() => { let live = true; setSrc(null); setTried(false); getMedia(repo, bucket, path).then(u => { if (live) { setSrc(u); setTried(true); } }); return () => { live = false; }; }, [repo, bucket, path]);
  if (src) return <img src={src} alt={alt} className={'object-cover ' + className} style={style} loading="lazy" />;
  return <div className={'grid place-items-center bg-gradient-to-br from-[#FFE7C9] to-[#FFC48A] text-4xl ' + className} style={style} aria-label={alt}>{path && !tried ? <Loader2 className="animate-spin text-gold" size={22} /> : EMOJI[category ?? ''] ?? '🍽️'}</div>;
}

/** Photo picker. Enforces the MB limit (from Settings), compresses, caches on this phone, returns the filename only. */
export function ImagePicker({ bucket, value, onChange, category, ownerFolder, label = 'Add photo', round = false, aspect }: { bucket: Bucket; value: string | null; onChange: (path: string | null) => void; category?: string; ownerFolder?: string; label?: string; round?: boolean; aspect?: number }) {
  const { snap, toast } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const limit = snap.settings.maxUploadMb;
  async function pick(f: File | undefined) {
    if (!f) return; setBusy(true);
    try {
      const { blob, ext } = await prepareImage(f, limit, aspect ? { aspect, maxDim: 1600 } : {});
      onChange(await cacheImage(bucket, blob, ext, ownerFolder));
      setInfo(`${mb(f.size)} → ${mb(blob.size)} (limit ${limit} MB)`);
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not use that photo', 'err'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  return (
    <div>
      <div className="flex items-center gap-3">
        <StoredImage bucket={bucket} path={value} category={category} className={(round ? 'rounded-full ' : 'rounded-2xl ') + (aspect ? 'w-28 flex-none' : 'h-24 w-24 flex-none')} style={aspect ? { aspectRatio: String(aspect) } : undefined} />
        <div className="flex-1">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => pick(e.target.files?.[0])} />
          <button type="button" className="btn-line btn-sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 size={16} className="animate-spin" /> : value ? <Camera size={16} /> : <ImagePlus size={16} />}{busy ? 'Processing…' : value ? 'Change photo' : label}</button>
          {value && <button type="button" className="ml-2 text-[12px] font-semibold text-red-700" onClick={() => { onChange(null); setInfo(''); }}>Remove</button>}
          <p className="mt-1.5 text-[11px] leading-snug text-[color:var(--muted)]">Max {limit} MB. Photos are resized and fitted automatically, then saved to the cloud so everyone can see them.{info && <><br />{info}</>}</p>
        </div>
      </div>
    </div>
  );
}

export function Calendar({ month, onMonth, days, selected, onSelect, admin = false }: { month: Date; onMonth: (d: Date) => void; days: Map<string, DayInfo>; selected: string; onSelect: (d: string) => void; admin?: boolean }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: n }, (_, i) => iso(new Date(month.getFullYear(), month.getMonth(), i + 1)))];
  const today = todayISO();
  return (
    <div className="card !p-3">
      <div className="mb-2 flex items-center justify-between">
        <button className="iconbtn !border-black/10 !bg-black/5 !text-ink" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
        <b className="font-display text-[16px]">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
        <button className="iconbtn !border-black/10 !bg-black/5 !text-ink" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[color:var(--muted)]">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const info = days.get(d); const past = d < today && !admin; const full = !!info && (info.closed || info.booked >= info.capacity); const sel = d === selected;
          return (
            <button key={d} disabled={past} onClick={() => onSelect(d)}
              className={['relative flex h-11 flex-col items-center justify-center rounded-xl text-[13px] font-semibold transition', sel ? 'bg-gold text-white shadow' : past ? 'text-black/25' : info?.closed ? 'bg-black/10 text-black/40 line-through' : full ? 'bg-red-50 text-red-700' : 'bg-[#FFF1E0]', d === today && !sel ? 'ring-2 ring-gold' : ''].join(' ')}>
              {+d.slice(8)}
              {admin && info && !info.closed && <small className="text-[9px] font-bold opacity-70">{info.booked}/{info.capacity}</small>}
              {!admin && info && !past && !info.closed && !sel && <i className={'absolute bottom-1 h-1 w-1 rounded-full ' + (full ? 'bg-red-500' : 'bg-green-600')} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export function TimeChips({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return <div className="flex flex-wrap gap-2">{TIME_SLOTS.map(t => <button key={t} className={'chip' + (value === t ? ' on' : '')} onClick={() => onChange(t)}>{t}</button>)}</div>;
}

export function Stepper({ value, onChange, min = 0, max = 50 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-gold/50 bg-white px-1.5 py-1">
      <button className="grid h-8 w-8 place-items-center rounded-full bg-ink text-lg font-bold text-gold disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Less">−</button>
      <b className="min-w-5 text-center">{value}</b>
      <button className="grid h-8 w-8 place-items-center rounded-full bg-gold text-lg font-bold text-ink disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="More">+</button>
    </div>
  );
}

export function BarChart({ data, height = 140, money = true }: { data: { label: string; value: number; value2?: number }[]; height?: number; money?: boolean }) {
  const max = Math.max(1, ...data.map(d => d.value)); const w = 100 / data.length;
  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label="Bar chart">
        {[0.25, .5, .75].map(g => <line key={g} x1="0" x2="100" y1={(height / 4) * (1 - g)} y2={(height / 4) * (1 - g)} stroke="#000" strokeOpacity=".07" strokeWidth=".3" />)}
        {data.map((d, i) => { const h = (d.value / max) * (height / 4 - 2); const h2 = ((d.value2 ?? 0) / max) * (height / 4 - 2); return (
          <g key={i}><rect x={i * w + w * .16} y={height / 4 - h} width={w * .68} height={Math.max(h, .4)} rx="1.2" fill="#F26B1D" />{d.value2 !== undefined && <rect x={i * w + w * .16} y={height / 4 - h2} width={w * .68} height={Math.max(h2, 0)} rx="1.2" fill="#090909" opacity=".85" />}</g>); })}
      </svg>
      <div className="flex">{data.map((d, i) => <div key={i} className="flex-1 text-center"><div className="text-[10px] font-bold text-[color:var(--muted)]">{d.label}</div>{money && <div className="text-[9px] text-black/50">{d.value >= 1000 ? (d.value / 1000).toFixed(1) + 'k' : Math.round(d.value)}</div>}</div>)}</div>
    </div>
  );
}

export const Empty = ({ icon, text }: { icon: ReactNode; text: string }) => <div className="py-12 text-center text-[color:var(--muted)]"><div className="mb-2 flex justify-center opacity-60">{icon}</div><p className="text-[14px]">{text}</p></div>;
export const Money = ({ v, className = '' }: { v: number; className?: string }) => <span className={className}>{peso(v)}</span>;
export { addDays };
