import { useMemo, useRef, useState } from 'react';
import { Bell, Plus, Search, ShoppingBag } from 'lucide-react';
import { useApp } from '../data/store';
import { EMOJI, peso } from '../lib/format';
import { Logo, Sheet, Stepper, StoredImage, TopBar } from '../ui/kit';
import { StatusStage } from '../ui/Anim';
import type { MenuItem, Order } from '../types';

export type Cart = Record<string, number>;
const ACTIVE = ['pending', 'ongoing', 'preparing', 'packing', 'delivery'];

export function Home({ cart, setCart, openCart, openOrder }: { cart: Cart; setCart: (c: Cart) => void; openCart: () => void; openOrder: (o: Order) => void }) {
  const { snap, profile } = useApp();
  const menuTop = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState(''); const [cat, setCat] = useState('All'); const [view, setView] = useState<MenuItem | null>(null);
  const cats = useMemo(() => ['All', ...Array.from(new Set(snap.menu.map(m => m.category)))], [snap.menu]);
  const list = snap.menu.filter(m => (cat === 'All' || m.category === cat) && m.name.toLowerCase().includes(q.toLowerCase()));
  const qty = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = snap.menu.reduce((a, m) => a + m.price * (cart[m.id] || 0), 0);
  const live = snap.orders.find(o => ACTIVE.includes(o.status));
  const add = (m: MenuItem, n = 1) => setCart({ ...cart, [m.id]: Math.min(50, (cart[m.id] || 0) + n) });

  return (
    <>
      <TopBar title="EatMate Bollima" left={<Logo size={36} />} right={<button className="iconbtn" aria-label="Notifications"><Bell size={18} /></button>} />
      <div className="scroll">
        <div className="relative overflow-hidden rounded-[28px] p-5 text-white" style={{ background: 'linear-gradient(135deg,#FF9A3C,#F0560E)', boxShadow: '0 12px 28px rgba(240,86,14,.35)', aspectRatio: snap.settings.bannerPath ? '2 / 1' : undefined, minHeight: 170 }}>
          {snap.settings.bannerPath && <><StoredImage bucket="menu-images" path={snap.settings.bannerPath} className="absolute inset-0 h-full w-full" alt="" /><div className="absolute inset-0" style={{ background: 'linear-gradient(90deg,rgba(43,20,8,.78) 0%,rgba(43,20,8,.35) 60%,rgba(43,20,8,.1) 100%)' }} /></>}
          <div className="relative">
            <small className="text-[10px] font-bold tracking-[.2em] text-white/85">HELLO, {(profile?.fullName.split(' ')[0] ?? '').toUpperCase()}</small>
            <h2 className="mt-1 max-w-[230px] font-display text-[25px] font-bold leading-tight">{snap.settings.bannerTitle}</h2>
            <p className="mt-1 max-w-[230px] text-[12.5px] font-semibold text-white/90">{snap.settings.bannerSubtitle}</p>
            <button className="btn-white btn-sm mt-3" onClick={() => menuTop.current?.scrollIntoView({ behavior: 'smooth' })}>Order Now →</button>
          </div>
          {!snap.settings.bannerPath && <><span className="absolute -bottom-3 -right-2 text-[96px] drop-shadow-xl">🍔</span><span className="absolute right-[88px] top-3 text-[38px]">🍗</span></>}
        </div>

        {live && <button className="mt-4 block w-full text-left" onClick={() => openOrder(live)}><div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-gold-dark">Your order · tap to track</div><StatusStage status={live.status} compact /></button>}

        <div className="relative mt-4"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40" /><input className="input !pl-10" placeholder="Search menu…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="-mx-4 mt-4 flex gap-3.5 overflow-x-auto px-4 pb-1">{cats.map(c => (
          <button key={c} onClick={() => setCat(c)} className="flex flex-none flex-col items-center gap-1.5">
            <span className={'grid h-[58px] w-[58px] place-items-center rounded-full text-[27px] shadow-md transition ' + (cat === c ? 'bg-gold ring-4 ring-gold/25' : 'bg-white')}>{c === 'All' ? '🍽️' : EMOJI[c] ?? '🍴'}</span>
            <span className={'text-[11.5px] font-bold ' + (cat === c ? 'text-gold' : 'text-[#6b4a33]')}>{c}</span>
          </button>))}</div>

        <div className="sect" ref={menuTop}><div><small>Made with love</small><h2>Popular Menu</h2></div></div>
        {!list.length && <p className="py-10 text-center text-[14px] text-[color:var(--muted)]">{snap.menu.length ? 'No dishes match your search.' : 'No dishes available yet — please check back soon.'}</p>}
        <div className="grid grid-cols-2 gap-3">
          {list.map(m => (
            <article key={m.id} className={'card overflow-hidden !p-0 ' + (m.available ? '' : 'opacity-55')}>
              <button className="block w-full text-left" onClick={() => setView(m)}>
                <StoredImage bucket="menu-images" path={m.imagePath} category={m.category} className="h-28 w-full" alt={m.name} />
                <div className="px-3 pt-2.5"><b className="line-clamp-1 text-[14px]">{m.name}</b><p className="mt-0.5 line-clamp-2 min-h-[30px] text-[11.5px] leading-snug text-[color:var(--muted)]">{m.description}</p></div>
              </button>
              <div className="flex items-center justify-between px-3 pb-3 pt-1"><b className="text-[15px]">{peso(m.price)}</b>
                <button disabled={!m.available} className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-[12px] font-bold text-white shadow-md disabled:bg-black/15 disabled:shadow-none" onClick={() => add(m)}>{m.available ? <><Plus size={13} /> Add</> : 'Sold out'}</button></div>
            </article>
          ))}
        </div>
      </div>

      {qty > 0 && <button className="absolute inset-x-4 bottom-[92px] z-10 flex items-center gap-3 rounded-full bg-ink px-5 py-3 text-gold shadow-2xl ring-1 ring-gold/50" style={{ marginBottom: 'env(safe-area-inset-bottom)' }} onClick={openCart}>
        <ShoppingBag size={20} /><b>View cart</b><span className="grid h-6 min-w-6 place-items-center rounded-full bg-gold px-1 text-[12px] font-extrabold text-ink">{qty}</span><b className="ml-auto">{peso(total)}</b></button>}

      {view && (
        <Sheet title={view.name} onClose={() => setView(null)}>
          <StoredImage bucket="menu-images" path={view.imagePath} category={view.category} className="h-52 w-full rounded-2xl" alt={view.name} />
          <div className="mt-3 flex items-center justify-between"><b className="text-[22px]">{peso(view.price)}</b>{!view.available && <span className="pill p-red">Sold out</span>}</div>
          <p className="mt-2 text-[14px] leading-relaxed text-black/70">{view.description || 'Freshly prepared for you.'}</p>
          <div className="mt-5 flex items-center gap-4"><Stepper value={cart[view.id] || 1} min={1} onChange={n => setCart({ ...cart, [view.id]: n })} /><button className="btn" disabled={!view.available} onClick={() => { if (!cart[view.id]) add(view); setView(null); }}>Add to Cart</button></div>
        </Sheet>
      )}
    </>
  );
}
