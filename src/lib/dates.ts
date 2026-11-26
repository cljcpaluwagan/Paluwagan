const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const pad = (n: number) => String(n).padStart(2, '0');
export const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y: number, m: number) => (m === 2 ? (isLeap(y) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31);

/** Payout date for a 'YYYY-MM' month. A day that doesn't exist (Nov 31, Feb 30) becomes the last valid day. Never skips the month. */
export function payoutDate(month: string, day: number): string {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${pad(Math.min(Math.max(Math.floor(day), 1), daysInMonth(y, m)))}`;
}
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}
export const monthIndex = (month: string) => { const [y, m] = month.split('-').map(Number); return y * 12 + m - 1; };
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const monthOf = (iso: string) => iso.slice(0, 7);
export const fmtMonth = (m: string) => { const [y, mm] = m.split('-').map(Number); return `${MON[mm - 1]} ${y}`; };
export const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${MON[m - 1]} ${pad(d)}, ${y}`; };
export const peso = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
