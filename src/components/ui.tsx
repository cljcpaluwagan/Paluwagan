import React from 'react';
export const Btn = ({ children, onClick, tone = 'main', disabled }: { children: React.ReactNode; onClick?: () => void; tone?: 'main' | 'ghost' | 'danger'; disabled?: boolean }) =>
  <button className={'btn ' + tone} onClick={onClick} disabled={disabled}>{children}</button>;
export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="fld"><small>{label}</small>{children}</label>;
export const Title = ({ children }: { children: React.ReactNode }) => <div className="section-title">{children}</div>;
export const Note = ({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' | 'bad' }) => <div className={'note ' + tone}>{children}</div>;
export const Stat = ({ a, b }: { a: string; b: string | number }) => <div className="card stat"><small>{a}</small><b>{b}</b></div>;
export function monthRange(start: string, end: string): string[] {
  const out: string[] = []; let [y, m] = start.split('-').map(Number); const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } if (out.length > 120) break; }
  return out;
}
