-- Ehlo Client's own tables. These sit in the SAME Supabase project as Knox
-- Tracker (so both can share the `clients` and `travelers` tables), but
-- everything here is locked to owners only via RLS — Knox Tracker never
-- queries these tables, and even if a non-owner staff account tried to hit
-- them directly, the database itself would refuse.

create table if not exists client_expenses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  traveler_name text not null,
  category text not null check (category in ('Flight', 'Hotel', 'Car', 'Booking Fee')),
  amount numeric not null default 0,
  fee numeric not null default 0,
  entry_date date not null default current_date,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists retainer_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  month date not null, -- always stored as the 1st of the month, e.g. 2026-07-01
  paid boolean not null default false,
  marked_by text,
  marked_at timestamptz not null default now(),
  unique (client_id, month)
);

create table if not exists timesheets (
  id uuid primary key default gen_random_uuid(),
  staff_email text not null,
  work_date date not null default current_date,
  hours numeric not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_email text,
  action text not null,
  created_at timestamptz not null default now()
);

alter table client_expenses enable row level security;
alter table retainer_payments enable row level security;
alter table timesheets enable row level security;
alter table activity_log enable row level security;

create policy "owners can read client_expenses" on client_expenses for select to authenticated using (is_owner());
create policy "owners can insert client_expenses" on client_expenses for insert to authenticated with check (is_owner());
create policy "owners can update client_expenses" on client_expenses for update to authenticated using (is_owner());
create policy "owners can delete client_expenses" on client_expenses for delete to authenticated using (is_owner());

create policy "owners can read retainer_payments" on retainer_payments for select to authenticated using (is_owner());
create policy "owners can insert retainer_payments" on retainer_payments for insert to authenticated with check (is_owner());
create policy "owners can update retainer_payments" on retainer_payments for update to authenticated using (is_owner());

create policy "owners can read timesheets" on timesheets for select to authenticated using (is_owner());
create policy "owners can insert timesheets" on timesheets for insert to authenticated with check (is_owner());
create policy "owners can update timesheets" on timesheets for update to authenticated using (is_owner());
create policy "owners can delete timesheets" on timesheets for delete to authenticated using (is_owner());

create policy "owners can read activity_log" on activity_log for select to authenticated using (is_owner());
create policy "owners can insert activity_log" on activity_log for insert to authenticated with check (is_owner());

-- Owners also need to be able to see and manage everyone's profile/role from
-- Ehlo's Team tab (the existing profiles table only let people see their own row).
drop policy if exists "owners can read all profiles" on profiles;
create policy "owners can read all profiles"
  on profiles for select
  to authenticated
  using (is_owner());

drop policy if exists "owners can update profiles" on profiles;
create policy "owners can update profiles"
  on profiles for update
  to authenticated
  using (is_owner());
