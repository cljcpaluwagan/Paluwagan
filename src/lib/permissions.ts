import type { Role } from '../types.ts';
export type Action =
  | 'cycle.create' | 'cycle.activate' | 'cycle.close' | 'cycle.rejectReview' | 'cycle.submitReview'
  | 'schedule.edit' | 'payout.release' | 'contribution.confirm'
  | 'users.manage' | 'member.manage' | 'member.decide' | 'settings.general' | 'audit.view' | 'finance.view';

const A: Role[] = ['ADMIN'], C: Role[] = ['CASHIER'], AC: Role[] = ['ADMIN', 'CASHIER'];
// Mirrors the SQL functions + RLS. The UI only uses this to decide what to show; the database is the real gate.
export const PERMISSIONS: Record<Action, Role[]> = {
  'cycle.create': A, 'cycle.activate': A, 'cycle.close': A, 'cycle.rejectReview': A,
  'cycle.submitReview': C, 'schedule.edit': C, 'payout.release': C,   // only CASHIER confirms an actual release
  'contribution.confirm': AC, 'member.manage': AC, 'users.manage': A, 'member.decide': A,
  'settings.general': A,                                               // CASHIER: no general settings / app title
  'audit.view': AC, 'finance.view': AC,
};
export const can = (role: Role | undefined, a: Action) => !!role && PERMISSIONS[a].includes(role);
export function assertCan(role: Role | undefined, a: Action) { if (!can(role, a)) throw new Error(`Not allowed: ${a} requires ${PERMISSIONS[a].join(' or ')}`); }
