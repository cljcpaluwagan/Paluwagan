import { createClient } from '@supabase/supabase-js';
import type { Contribution, Cycle, Member, Payout, Profile, Registration, Role, Slot, Snapshot, User } from '../types';
import type { Repo } from './repo';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

export const supabase = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_ANON_KEY || 'anon', { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
const ok = <T,>(r: { data: T; error: any }): NonNullable<T> => { if (r.error) throw new Error(r.error.message); return r.data as NonNullable<T>; };
const rpc = async (fn: string, args: Record<string, unknown>) => { const r = await supabase.rpc(fn, args); if (r.error) throw new Error(r.error.message); };

// ---------- accounts (never reveal which half of a login was wrong) ----------
export async function signIn(email: string, password: string): Promise<User> {
  const r = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (r.error || !r.data.user) throw new Error(/confirm/i.test(r.error?.message || '') ? 'Please confirm your email first (check your inbox).' : 'Wrong email or password.');
  return currentUser(r.data.user.id);
}
export async function signUp(a: { email: string; password: string; name: string; phone?: string }): Promise<{ needsConfirm: boolean }> {
  const r = await supabase.auth.signUp({ email: a.email.trim().toLowerCase(), password: a.password, options: { data: { full_name: a.name, phone: a.phone || '' } } });
  if (r.error) throw new Error(/registered|exists/i.test(r.error.message) ? 'That email is already registered. Try logging in.' : r.error.message);
  return { needsConfirm: !r.data.session };
}
export async function changePassword(newPassword: string) { const r = await supabase.auth.updateUser({ password: newPassword }); if (r.error) throw new Error(r.error.message); }
export async function resetPassword(email: string) { await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase()); }   // same answer whether or not the email exists
export const signOut = () => supabase.auth.signOut();
export async function currentUser(id?: string): Promise<User> {
  const au = (await supabase.auth.getUser()).data.user; const uid = id ?? au?.id; if (!uid) throw new Error('Not signed in');
  const p = ok(await supabase.from('profiles').select('id, full_name, phone, role, member_id').eq('id', uid).single());
  return { id: p.id, name: p.full_name, role: p.role as Role, memberId: p.member_id ?? undefined, phone: p.phone ?? undefined, email: au?.email ?? undefined, approved: p.role !== 'MEMBER' || !!p.member_id };
}

const cycleOf = (c: any): Cycle => ({ id: c.id, name: c.name, status: c.status, startMonth: c.start_month, payoutDay: c.payout_day, dueDay: c.due_day, reminderDays: c.reminder_days, perMonth: c.per_month, contribution: Number(c.contribution), scheduleFinal: c.schedule_final, reconciled: c.reconciled, reviewNote: c.review_note ?? undefined, createdAt: c.created_at });

export function makeSupabaseRepo(_user: User): Repo {
  return {
    async load() {
      const cycles = ok(await supabase.from('cycles').select('*').order('created_at', { ascending: false })).map(cycleOf);
      let cur = cycles.find(c => c.status !== 'CLOSED') || cycles[0] || null;
      if (cur && (cur.status === 'ACTIVE' || cur.status === 'AWAITING_COMPLETION')) {
        await supabase.rpc('refresh_cycle_status', { p_cycle: cur.id });               // derives AWAITING_COMPLETION by date
        cur = cycleOf(ok(await supabase.from('cycles').select('*').eq('id', cur.id).single()));
      }
      const id = cur?.id ?? '00000000-0000-0000-0000-000000000000';
      const [st, mem, cm, sl, px, co, au, pr, rg] = await Promise.all([
        supabase.from('app_settings').select('*').single(), supabase.from('members').select('*').order('full_name'),
        supabase.from('cycle_members').select('member_id').eq('cycle_id', id), supabase.from('payout_schedule').select('*').eq('cycle_id', id).order('payout_date'),
        supabase.from('payout_transactions').select('*').eq('cycle_id', id), supabase.from('contributions').select('*').eq('cycle_id', id),
        supabase.from('audit_logs').select('*').order('at', { ascending: false }).limit(50), supabase.from('profiles').select('id, full_name, member_id'),
        supabase.from('registrations').select('*').eq('status', 'PENDING').order('created_at'),
      ]);
      const names = new Map((pr.data || []).map((p: any) => [p.id, p.full_name]));
      const linked = new Set((pr.data || []).map((p: any) => p.member_id).filter(Boolean));
      return {
        title: st.data?.title ?? 'Paluwagan', logo: (st.data as any)?.logo_data ?? null, background: (st.data as any)?.bg_data ?? null,
        members: ok(mem).map((m: any): Member => ({ id: m.id, name: m.full_name, archived: m.archived, pendingDecision: m.pending_decision, linked: linked.has(m.id) })),
        cycle: cur, eligible: (cm.data || []).map((r: any) => r.member_id),
        slots: (sl.data || []).map((s: any): Slot => ({ id: s.id, cycleId: s.cycle_id, memberId: s.member_id, month: s.month, date: s.payout_date, status: s.status, manual: s.manual })),
        payouts: (px.data || []).map((p: any): Payout => ({ id: p.id, cycleId: p.cycle_id, slotId: p.schedule_id, memberId: p.member_id, scheduledMonth: p.scheduled_month, scheduledDate: p.scheduled_date, releasedOn: p.released_on, amount: Number(p.amount), cashierId: p.cashier_id, ref: p.reference ?? undefined })),
        contributions: (co.data || []).map((c: any): Contribution => ({ id: c.id, cycleId: c.cycle_id, memberId: c.member_id, month: c.month, amount: Number(c.amount), status: c.status, method: c.method ?? undefined, paidOn: c.paid_on ?? undefined, confirmedBy: c.confirmed_by ?? undefined })),
        audit: (au.data || []).map((a: any) => ({ id: String(a.id), at: a.at, userId: a.user_id, userName: names.get(a.user_id), action: a.action, detail: JSON.stringify(a.detail) })),
        closedCycles: cycles.filter(c => c.status === 'CLOSED' && c.id !== cur?.id),
        registrations: (rg.data || []).map((r: any): Registration => ({ id: r.id, userId: r.user_id, name: r.full_name, phone: r.phone ?? undefined, email: r.email ?? undefined, status: r.status, createdAt: r.created_at })),
      } as Snapshot;
    },
    addMember: n => rpc('add_member', { p_name: n }),
    archiveMember: id => rpc('archive_member', { p_id: id }),
    decideMember: (id, d) => rpc('decide_member', { p_id: id, p_decision: d }),
    createCycle: a => rpc('create_cycle', { p_name: a.name, p_start: a.startMonth, p_day: a.payoutDay, p_due: a.dueDay, p_remind: a.reminderDays, p_per: a.perMonth, p_contrib: a.contribution, p_members: a.memberIds }),
    saveSchedule: a => rpc('save_schedule', { p_cycle: a.cycleId, p_start: a.startMonth, p_day: a.payoutDay, p_due: a.dueDay, p_remind: a.reminderDays, p_per: a.perMonth, p_finalize: a.finalize, p_slots: a.slots.map(s => ({ member_id: s.memberId, month: s.month, manual: s.manual })) }),
    activateCycle: id => rpc('activate_cycle', { p_cycle: id }),
    setContribution: a => rpc('set_contribution', { p_cycle: a.cycleId, p_member: a.memberId, p_month: a.month, p_status: a.status, p_method: a.method ?? null, p_paid_on: a.paidOn ?? null }),
    confirmPayout: a => rpc('confirm_payout', { p_slot: a.slotId, p_released_on: a.releasedOn, p_ref: a.ref ?? null }),
    submitForReview: (id, note) => rpc('submit_for_review', { p_cycle: id, p_note: note }),
    rejectReview: (id, reason) => rpc('reject_review', { p_cycle: id, p_reason: reason }),
    closeCycle: id => rpc('close_cycle', { p_cycle: id }),
    async setBranding(a) {
      const u: Record<string, string | null> = {}; if ('logo' in a) u.logo_data = a.logo ?? null; if ('background' in a) u.bg_data = a.background ?? null;
      const r = await supabase.from('app_settings').update(u).eq('id', 1); if (r.error) throw new Error(r.error.message);
    },
    async setTitle(t) { const r = await supabase.from('app_settings').update({ title: t }).eq('id', 1); if (r.error) throw new Error(r.error.message); },
    updateMyProfile: a => rpc('update_my_profile', { p_name: a.name, p_phone: a.phone ?? null }),
    async listUsers() {
      const r = await supabase.rpc('admin_list_users'); if (r.error) throw new Error(r.error.message);
      return (r.data || []).map((p: any): Profile => ({ id: p.id, name: p.full_name, phone: p.phone ?? undefined, email: p.email ?? undefined, role: p.role, memberId: p.member_id ?? undefined }));
    },
    setRole: (userId, role) => rpc('set_user_role', { p_user: userId, p_role: role }),
    approveRegistration: (regId, memberId) => rpc('approve_registration', { p_reg: regId, p_member: memberId ?? null }),
    rejectRegistration: (regId, reason) => rpc('reject_registration', { p_reg: regId, p_reason: reason }),
  };
}
