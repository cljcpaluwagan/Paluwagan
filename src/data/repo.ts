import type { Snapshot, Slot, User, Profile, Role } from '../types';
export interface NewCycle { name: string; startMonth: string; payoutDay: number; dueDay: number; reminderDays: number; perMonth: number; contribution: number; memberIds: string[] }
export interface SaveSchedule { cycleId: string; startMonth: string; payoutDay: number; dueDay: number; reminderDays: number; perMonth: number; slots: Slot[]; finalize: boolean }
export interface Repo {
  load(): Promise<Snapshot>;
  addMember(name: string): Promise<void>;
  archiveMember(id: string): Promise<void>;
  decideMember(id: string, d: 'CURRENT' | 'NEXT'): Promise<void>;
  createCycle(a: NewCycle): Promise<void>;
  saveSchedule(a: SaveSchedule): Promise<void>;
  activateCycle(id: string): Promise<void>;
  setContribution(a: { cycleId: string; memberId: string; month: string; status: 'PENDING' | 'PAID'; method?: string; paidOn?: string }): Promise<void>;
  confirmPayout(a: { slotId: string; releasedOn: string; ref?: string }): Promise<void>;
  submitForReview(cycleId: string, note: string): Promise<void>;
  rejectReview(cycleId: string, reason: string): Promise<void>;
  closeCycle(cycleId: string): Promise<void>;
  setTitle(t: string): Promise<void>;
  updateMyProfile(a: { name: string; phone?: string }): Promise<void>;
  listUsers(): Promise<Profile[]>;                      // Admin
  setRole(userId: string, role: Role): Promise<void>;   // Admin
  approveRegistration(regId: string, memberId?: string): Promise<void>;
  rejectRegistration(regId: string, reason: string): Promise<void>;
  /** undefined = leave as is, null = reset to default */
  setBranding(a: { logo?: string | null; background?: string | null }): Promise<void>;
}
export type RepoFactory = (u: User) => Repo;
