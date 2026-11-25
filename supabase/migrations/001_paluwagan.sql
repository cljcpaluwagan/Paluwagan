-- Paluwagan: payout cycles, RLS and server-side rules. Run once in the Supabase SQL editor.
create extension if not exists pgcrypto;
create type app_role as enum ('ADMIN','CASHIER','MEMBER');

create table profiles (id uuid primary key references auth.users on delete cascade, full_name text not null default '', role app_role not null default 'MEMBER', member_id uuid, created_at timestamptz not null default now());
create table members (id uuid primary key default gen_random_uuid(), full_name text not null, archived boolean not null default false, pending_decision boolean not null default false, created_at timestamptz not null default now());
create table app_settings (id int primary key default 1 check (id = 1), title text not null default 'Paluwagan', logo_data text, bg_data text);
insert into app_settings default values;
create table cycles (
  id uuid primary key default gen_random_uuid(), name text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','AWAITING_COMPLETION','FOR_ADMIN_REVIEW','CLOSED')),
  start_month text not null check (start_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  payout_day int not null check (payout_day between 1 and 31), due_day int not null default 5 check (due_day between 1 and 31), reminder_days int not null default 3 check (reminder_days between 0 and 28), per_month int not null check (per_month >= 1),
  contribution numeric(12,2) not null check (contribution > 0),
  schedule_final boolean not null default false, reconciled boolean not null default false, review_note text,
  created_by uuid, activated_by uuid, closed_by uuid, closed_at timestamptz, created_at timestamptz not null default now());
create unique index one_open_cycle on cycles ((true)) where status <> 'CLOSED';
create table cycle_members (cycle_id uuid not null references cycles, member_id uuid not null references members, primary key (cycle_id, member_id));
create table payout_schedule (
  id uuid primary key default gen_random_uuid(), cycle_id uuid not null references cycles, member_id uuid not null,
  month text not null, payout_date date not null, status text not null default 'SCHEDULED' check (status in ('SCHEDULED','RELEASED')),
  manual boolean not null default false, updated_by uuid, updated_at timestamptz not null default now(),
  unique (cycle_id, member_id), foreign key (cycle_id, member_id) references cycle_members);
create table payout_transactions (
  id uuid primary key default gen_random_uuid(), cycle_id uuid not null references cycles,
  schedule_id uuid not null unique references payout_schedule, member_id uuid not null,
  scheduled_month text not null, scheduled_date date not null, released_on date not null,
  amount numeric(12,2) not null, cashier_id uuid not null, reference text, created_at timestamptz not null default now(),
  unique (cycle_id, member_id));                       -- one successful release per member per cycle
create table contributions (
  id uuid primary key default gen_random_uuid(), cycle_id uuid not null references cycles, member_id uuid not null,
  month text not null, amount numeric(12,2) not null, status text not null default 'PENDING' check (status in ('PENDING','PAID')),
  method text, paid_on date, confirmed_by uuid, unique (cycle_id, member_id, month),
  foreign key (cycle_id, member_id) references cycle_members);
create table audit_logs (id bigint generated always as identity primary key, at timestamptz not null default now(), user_id uuid, action text not null, detail jsonb not null default '{}');

-- helpers ---------------------------------------------------------------
create function app_role_of() returns app_role language sql stable security definer set search_path = public as $$ select role from profiles where id = auth.uid() $$;
create function is_staff() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(app_role_of() in ('ADMIN','CASHIER'), false) $$;
create function must_be(variadic r app_role[]) returns void language plpgsql stable security definer set search_path = public as $$
begin if auth.uid() is null or app_role_of() is null or not (app_role_of() = any (r)) then raise exception 'Not allowed (requires %)', r; end if; end $$;
create function audit(a text, d jsonb) returns void language sql security definer set search_path = public as $$ insert into audit_logs(user_id, action, detail) values (auth.uid(), a, d) $$;
create function ph_today() returns date language sql stable as $$ select (now() at time zone 'Asia/Manila')::date $$;
-- last-valid-day rule: Nov 31 -> Nov 30, Feb 31 -> Feb 28/29 (leap years handled by the calendar), never skips a month
create function payout_date(m text, d int) returns date language sql immutable as $$
  select (m || '-01')::date + (least(d, extract(day from ((m || '-01')::date + interval '1 month - 1 day'))::int) - 1) $$;

-- immutability ------------------------------------------------------------
create function block_tx_change() returns trigger language plpgsql as $$ begin raise exception 'Confirmed payout transactions are permanent'; end $$;
create trigger tx_no_update before update or delete on payout_transactions for each row execute function block_tx_change();
create function block_released_slot() returns trigger language plpgsql as $$
begin if old.status = 'RELEASED' then raise exception 'A released payout slot cannot be changed or deleted'; end if;
  if tg_op = 'DELETE' then return old; end if; return new; end $$;
create trigger slot_guard before update or delete on payout_schedule for each row execute function block_released_slot();
create function block_closed_children() returns trigger language plpgsql as $$
begin if exists (select 1 from cycles where id = (case when tg_op = 'DELETE' then old.cycle_id else new.cycle_id end) and status = 'CLOSED') then raise exception 'Closed cycle records are read-only'; end if;
  if tg_op = 'DELETE' then return old; end if; return new; end $$;
create trigger closed_slots before insert or update or delete on payout_schedule for each row execute function block_closed_children();
create trigger closed_contribs before insert or update or delete on contributions for each row execute function block_closed_children();
create trigger closed_cm before insert or update or delete on cycle_members for each row execute function block_closed_children();

-- RLS: everyone reads what they need; writes only through the functions below --------------
alter table profiles enable row level security; alter table members enable row level security; alter table app_settings enable row level security;
alter table cycles enable row level security; alter table cycle_members enable row level security; alter table payout_schedule enable row level security;
alter table payout_transactions enable row level security; alter table contributions enable row level security; alter table audit_logs enable row level security;
create policy p_self on profiles for select using (id = auth.uid() or is_staff());
create policy p_admin_upd on profiles for update using (app_role_of() = 'ADMIN') with check (app_role_of() = 'ADMIN');
create policy m_read on members for select using (auth.uid() is not null);
create policy s_read on app_settings for select using (auth.uid() is not null);
create policy s_admin on app_settings for update using (app_role_of() = 'ADMIN') with check (app_role_of() = 'ADMIN');  -- CASHIER cannot edit app title / general settings
create policy c_read on cycles for select using (auth.uid() is not null);
create policy cm_read on cycle_members for select using (auth.uid() is not null);
create policy ps_read on payout_schedule for select using (auth.uid() is not null);
create policy tx_read on payout_transactions for select using (is_staff() or member_id = (select member_id from profiles where id = auth.uid()));
create policy co_read on contributions for select using (is_staff() or member_id = (select member_id from profiles where id = auth.uid()));
create policy al_read on audit_logs for select using (is_staff());

-- cycle status: ACTIVE <-> AWAITING_COMPLETION only. Never CLOSED automatically, never at 12 months.
create function refresh_cycle_status(p_cycle uuid) returns void language plpgsql security definer set search_path = public as $$
declare c cycles; waiting int; last_d date;
begin select * into c from cycles where id = p_cycle;
  if c.status not in ('ACTIVE','AWAITING_COMPLETION') then return; end if;
  select count(*) into waiting from cycle_members cm where cm.cycle_id = p_cycle and not exists (select 1 from payout_transactions t where t.cycle_id = p_cycle and t.member_id = cm.member_id);
  select max(payout_date) into last_d from payout_schedule where cycle_id = p_cycle;
  update cycles set status = case when waiting > 0 and last_d is not null and last_d < ph_today() then 'AWAITING_COMPLETION' else 'ACTIVE' end where id = p_cycle;
end $$;

create function add_member(p_name text) returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid; open_cycle boolean;
begin perform must_be('ADMIN','CASHIER');
  select exists (select 1 from cycles where status <> 'CLOSED') into open_cycle;
  insert into members(full_name, pending_decision) values (trim(p_name), open_cycle) returning id into v;   -- never silently joins the running cycle
  perform audit('member.add', jsonb_build_object('member', v, 'needs_admin_decision', open_cycle)); return v; end $$;
create function archive_member(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin perform must_be('ADMIN','CASHIER');
  update members set archived = true where id = p_id;      -- cycle_members / schedule / payouts untouched: obligation is preserved
  perform audit('member.archive', jsonb_build_object('member', p_id)); end $$;
create function decide_member(p_id uuid, p_decision text) returns void language plpgsql security definer set search_path = public as $$
declare c uuid;
begin perform must_be('ADMIN');
  select id into c from cycles where status <> 'CLOSED';
  if p_decision = 'CURRENT' then
    if c is null then raise exception 'No open cycle'; end if;
    insert into cycle_members(cycle_id, member_id) values (c, p_id) on conflict do nothing;
    update cycles set schedule_final = false where id = c and status = 'DRAFT';
  elsif p_decision <> 'NEXT' then raise exception 'Decision must be CURRENT or NEXT'; end if;
  update members set pending_decision = false where id = p_id;
  perform audit('member.decide', jsonb_build_object('member', p_id, 'decision', p_decision)); end $$;

create function create_cycle(p_name text, p_start text, p_day int, p_due int, p_remind int, p_per int, p_contrib numeric, p_members uuid[]) returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin perform must_be('ADMIN');
  insert into cycles(name, start_month, payout_day, due_day, reminder_days, per_month, contribution, created_by) values (p_name, p_start, p_day, p_due, p_remind, p_per, p_contrib, auth.uid()) returning id into v;
  insert into cycle_members(cycle_id, member_id) select v, m.id from members m where m.id = any (p_members) and not m.archived;
  perform audit('cycle.create', jsonb_build_object('cycle', v, 'members', array_length(p_members, 1))); return v; end $$;

-- p_slots: [{"member_id": "...", "month": "2026-12", "manual": false}]. Dates are computed here, not trusted from the client.
create function save_schedule(p_cycle uuid, p_start text, p_day int, p_due int, p_remind int, p_per int, p_slots jsonb, p_finalize boolean) returns void language plpgsql security definer set search_path = public as $$
declare c cycles; r jsonb; n_elig int; n_new int; changed int;
begin perform must_be('CASHIER');
  select * into c from cycles where id = p_cycle for update;
  if c.status in ('CLOSED','FOR_ADMIN_REVIEW') then raise exception 'Cycle is % and cannot be rescheduled', c.status; end if;
  update cycles set start_month = p_start, payout_day = p_day, due_day = p_due, reminder_days = p_remind, per_month = p_per where id = p_cycle;
  select count(*) into changed from payout_schedule where cycle_id = p_cycle and status <> 'RELEASED';
  delete from payout_schedule where cycle_id = p_cycle and status <> 'RELEASED';
  for r in select * from jsonb_array_elements(p_slots) loop
    continue when exists (select 1 from payout_schedule where cycle_id = p_cycle and member_id = (r->>'member_id')::uuid and status = 'RELEASED');
    insert into payout_schedule(cycle_id, member_id, month, payout_date, manual, updated_by)
      values (p_cycle, (r->>'member_id')::uuid, r->>'month', payout_date(r->>'month', p_day), coalesce((r->>'manual')::boolean, false), auth.uid());   -- unique(cycle,member) rejects duplicates
  end loop;
  select count(*) into n_elig from cycle_members where cycle_id = p_cycle;
  select count(distinct member_id) into n_new from payout_schedule where cycle_id = p_cycle;
  if p_finalize then
    if n_new <> n_elig then raise exception 'Every eligible member needs exactly one payout assignment (% of %)', n_new, n_elig; end if;
    update cycles set schedule_final = true where id = p_cycle;
  else update cycles set schedule_final = false where id = p_cycle and status = 'DRAFT'; end if;
  perform audit('schedule.save', jsonb_build_object('cycle', p_cycle, 'replaced_open_slots', changed, 'slots', n_new, 'finalized', p_finalize));
  perform refresh_cycle_status(p_cycle); end $$;

create function activate_cycle(p_cycle uuid) returns void language plpgsql security definer set search_path = public as $$
begin perform must_be('ADMIN');
  update cycles set status = 'ACTIVE', activated_by = auth.uid() where id = p_cycle and status = 'DRAFT' and schedule_final;
  if not found then raise exception 'Cycle must be DRAFT with a finalized schedule'; end if;
  perform audit('cycle.activate', jsonb_build_object('cycle', p_cycle)); end $$;

create function set_contribution(p_cycle uuid, p_member uuid, p_month text, p_status text, p_method text, p_paid_on date) returns void language plpgsql security definer set search_path = public as $$
declare c cycles;
begin perform must_be('ADMIN','CASHIER');
  select * into c from cycles where id = p_cycle;
  if c.status not in ('ACTIVE','AWAITING_COMPLETION') then raise exception 'Cycle is not collecting'; end if;
  insert into contributions(cycle_id, member_id, month, amount, status, method, paid_on, confirmed_by)
    values (p_cycle, p_member, p_month, c.contribution, p_status, p_method, p_paid_on, auth.uid())
    on conflict (cycle_id, member_id, month) do update set status = excluded.status, method = excluded.method, paid_on = excluded.paid_on, confirmed_by = auth.uid();
  perform audit('contribution.set', jsonb_build_object('cycle', p_cycle, 'member', p_member, 'month', p_month, 'status', p_status)); end $$;

create function confirm_payout(p_slot uuid, p_released_on date, p_ref text) returns void language plpgsql security definer set search_path = public as $$
declare s payout_schedule; c cycles; pot numeric;
begin perform must_be('CASHIER');                                  -- ONLY the cashier confirms an actual release
  select * into s from payout_schedule where id = p_slot for update;
  if not found then raise exception 'Unknown payout slot'; end if;
  select * into c from cycles where id = s.cycle_id;
  if c.status not in ('ACTIVE','AWAITING_COMPLETION') then raise exception 'Cycle is not running'; end if;
  if s.status = 'RELEASED' then raise exception 'Already released'; end if;
  if s.payout_date > ph_today() then raise exception 'Not ready for release until %', s.payout_date; end if;   -- scheduled never auto-pays
  select c.contribution * count(*) into pot from cycle_members where cycle_id = c.id;
  insert into payout_transactions(cycle_id, schedule_id, member_id, scheduled_month, scheduled_date, released_on, amount, cashier_id, reference)
    values (c.id, s.id, s.member_id, s.month, s.payout_date, p_released_on, pot, auth.uid(), nullif(trim(p_ref), ''));   -- unique(cycle, member) blocks duplicates
  update payout_schedule set status = 'RELEASED', updated_by = auth.uid(), updated_at = now() where id = s.id;
  perform audit('payout.release', jsonb_build_object('cycle', c.id, 'member', s.member_id, 'amount', pot, 'ref', p_ref));
  perform refresh_cycle_status(c.id); end $$;

create function submit_for_review(p_cycle uuid, p_note text) returns void language plpgsql security definer set search_path = public as $$
declare waiting int;
begin perform must_be('CASHIER');
  select count(*) into waiting from cycle_members cm where cm.cycle_id = p_cycle and not exists (select 1 from payout_transactions t where t.cycle_id = p_cycle and t.member_id = cm.member_id);
  if waiting > 0 then raise exception '% eligible member(s) have not received an actual payout', waiting; end if;
  update cycles set status = 'FOR_ADMIN_REVIEW', reconciled = true, review_note = p_note where id = p_cycle and status in ('ACTIVE','AWAITING_COMPLETION');
  if not found then raise exception 'Cycle is not running'; end if;
  perform audit('cycle.submit_review', jsonb_build_object('cycle', p_cycle, 'note', p_note)); end $$;
create function reject_review(p_cycle uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin perform must_be('ADMIN');
  update cycles set status = 'ACTIVE', reconciled = false where id = p_cycle and status = 'FOR_ADMIN_REVIEW';
  perform audit('cycle.reject_review', jsonb_build_object('cycle', p_cycle, 'reason', p_reason)); end $$;
create function close_cycle(p_cycle uuid) returns void language plpgsql security definer set search_path = public as $$
declare waiting int;
begin perform must_be('ADMIN');                                   -- ONLY the admin closes a cycle
  select count(*) into waiting from cycle_members cm where cm.cycle_id = p_cycle and not exists (select 1 from payout_transactions t where t.cycle_id = p_cycle and t.member_id = cm.member_id);
  if waiting > 0 then raise exception 'Cannot close: % member(s) still awaiting payout', waiting; end if;
  update cycles set status = 'CLOSED', closed_by = auth.uid(), closed_at = now() where id = p_cycle and status = 'FOR_ADMIN_REVIEW' and reconciled;
  if not found then raise exception 'Cycle must be FOR_ADMIN_REVIEW and reconciled'; end if;
  perform audit('cycle.close', jsonb_build_object('cycle', p_cycle)); end $$;

revoke all on function add_member, archive_member, decide_member, create_cycle, save_schedule, activate_cycle, set_contribution, confirm_payout, submit_for_review, reject_review, close_cycle, refresh_cycle_status from public;
revoke all on function audit, must_be from public;   -- nobody can forge audit entries
grant execute on function add_member, archive_member, decide_member, create_cycle, save_schedule, activate_cycle, set_contribution, confirm_payout, submit_for_review, reject_review, close_cycle, refresh_cycle_status, payout_date to authenticated;
-- New sign-ups become MEMBER. Promote staff by hand:  update profiles set role = 'ADMIN' where id = '<auth user id>';
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email)); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
