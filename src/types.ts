export type Role = 'ADMIN' | 'CASHIER' | 'MEMBER';
export type CycleStatus = 'DRAFT' | 'ACTIVE' | 'AWAITING_COMPLETION' | 'FOR_ADMIN_REVIEW' | 'CLOSED';
/** Stored status is SCHEDULED or RELEASED. READY_FOR_RELEASE is derived from the date (see engine.slotStatus). */
export type SlotStatus = 'SCHEDULED' | 'READY_FOR_RELEASE' | 'RELEASED';

export interface User { id: string; name: string; role: Role; memberId?: string; phone?: string; email?: string; approved: boolean }   // approved = staff, or a member linked by Admin/Cashier
export interface Registration { id: string; userId: string; name: string; phone?: string; email?: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; createdAt: string }
export interface Profile { id: string; name: string; phone?: string; email?: string; role: Role; memberId?: string }
export interface Member { id: string; name: string; archived: boolean; pendingDecision: boolean; linked?: boolean }
export interface Cycle {
  id: string; name: string; status: CycleStatus;
  startMonth: string;        // 'YYYY-MM'
  payoutDay: number;         // 1-31, clamped per month
  dueDay: number;            // contribution due day (clamped per month)
  reminderDays: number;      // remind members N days before the due date
  perMonth: number;          // recipients per month
  contribution: number;      // per member, per month
  scheduleFinal: boolean;    // cashier finalized the schedule
  reconciled: boolean; reviewNote?: string;
  createdAt: string;
}
export interface Slot {
  id: string; cycleId: string; memberId: string;
  month: string; date: string; status: 'SCHEDULED' | 'RELEASED'; manual: boolean;
}
export interface Payout {
  id: string; cycleId: string; slotId: string; memberId: string;
  scheduledMonth: string; scheduledDate: string; releasedOn: string;
  amount: number; cashierId: string; ref?: string;
}
export interface Contribution {
  id: string; cycleId: string; memberId: string; month: string; amount: number;
  status: 'PENDING' | 'PAID'; method?: string; paidOn?: string; confirmedBy?: string;
}
export interface AuditEntry { id: string; at: string; userId: string; userName?: string; action: string; detail: string }
export interface Snapshot {
  title: string;
  members: Member[];
  cycle: Cycle | null;
  eligible: string[];            // member ids that belong to `cycle`
  slots: Slot[];
  payouts: Payout[];
  contributions: Contribution[];
  audit: AuditEntry[];
  closedCycles: Cycle[];
  registrations: Registration[];   // pending sign-ups (staff only)
  logo?: string | null;        // uploaded group logo (data URL)
  background?: string | null;  // uploaded app background (data URL)
}
export interface ScheduleCfg { cycleId: string; startMonth: string; payoutDay: number; perMonth: number }
