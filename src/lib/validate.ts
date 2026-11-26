export const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
export const validEmail = (e: string) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e.trim());
export function passwordIssues(p: string): string[] {
  const o: string[] = [];
  if (p.length < 8) o.push('at least 8 characters');
  if (p.length > 72) o.push('at most 72 characters');
  if (!/[a-z]/i.test(p)) o.push('at least one letter');
  if (!/[0-9]/.test(p)) o.push('at least one number');
  return o;
}
export const validName = (n: string) => { const t = clean(n); return t.length >= 2 && t.length <= 80 && !/[<>{}]/.test(t); };
export const validPhone = (p: string) => p.trim() === '' || /^[0-9+() -]{7,20}$/.test(p.trim());
