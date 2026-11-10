-- ============================================================
-- MULTI-ORGANISATION MIGRATION
-- Run this in Supabase SQL Editor after the base schema.sql
-- ============================================================

-- ── STEP 1: Create tables (no policies yet) ───────────────────

create table if not exists public.organisations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique,
  created_at timestamptz default now()
);

create table if not exists public.organisation_invites (
  id uuid default uuid_generate_v4() primary key,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  role text not null default 'staff' check (role in ('admin', 'accountant', 'staff')),
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz default now()
);

create table if not exists public.company_settings (
  id uuid default uuid_generate_v4() primary key,
  organisation_id uuid unique references public.organisations(id) on delete cascade,
  name text not null default 'My Company',
  tagline text,
  email text,
  phone text,
  address text,
  website text,
  rc_number text,
  tin text,
  vat_number text,
  bank_name text,
  account_name text,
  account_number text,
  logo_url text,
  payment_terms text,
  invoice_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── STEP 2: Add organisation_id columns to all tables ─────────
-- profiles first (policies on other tables reference it)
alter table public.profiles
  add column if not exists organisation_id uuid references public.organisations(id) on delete set null,
  add column if not exists email text;

-- data tables
alter table public.projects          add column if not exists organisation_id uuid references public.organisations(id) on delete cascade;
alter table public.journal_entries   add column if not exists organisation_id uuid references public.organisations(id) on delete cascade;
alter table public.contract_letters  add column if not exists organisation_id uuid references public.organisations(id) on delete cascade;
alter table public.vat_returns       add column if not exists organisation_id uuid references public.organisations(id) on delete cascade;
alter table public.payroll_entries   add column if not exists organisation_id uuid references public.organisations(id) on delete cascade;
alter table public.company_settings  add column if not exists organisation_id uuid unique references public.organisations(id) on delete cascade;

-- ── STEP 3: Fix vat_returns unique constraint ─────────────────
alter table public.vat_returns drop constraint if exists vat_returns_period_key;
alter table public.vat_returns add constraint vat_returns_org_period_key unique (organisation_id, period);

-- ── STEP 4: Enable RLS on new tables ─────────────────────────
alter table public.organisations enable row level security;
alter table public.organisation_invites enable row level security;
alter table public.company_settings enable row level security;

-- ── STEP 5: Drop old policies ─────────────────────────────────
drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Authenticated users can read projects" on public.projects;
drop policy if exists "Admin/accountant can insert projects" on public.projects;
drop policy if exists "Admin/accountant can update projects" on public.projects;
drop policy if exists "Authenticated users can read journal" on public.journal_entries;
drop policy if exists "Admin/accountant can insert journal" on public.journal_entries;
drop policy if exists "Authenticated users can read contract letters" on public.contract_letters;
drop policy if exists "Admin/accountant can insert contract letters" on public.contract_letters;
drop policy if exists "Admin/accountant can delete contract letters" on public.contract_letters;
drop policy if exists "Authenticated users can read vat returns" on public.vat_returns;
drop policy if exists "Admin/accountant can upsert vat returns" on public.vat_returns;
drop policy if exists "Authenticated users can read payroll" on public.payroll_entries;
drop policy if exists "Admin/accountant can insert payroll" on public.payroll_entries;
drop policy if exists "Admin can update payroll" on public.payroll_entries;

-- ── STEP 6: Create all new policies ───────────────────────────

-- organisations
create policy "Members can read own org" on public.organisations
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.organisation_id = organisations.id
    )
  );

-- Any authenticated user can create an org (once, during onboarding)
create policy "Authenticated users can create org" on public.organisations
  for insert with check (auth.uid() is not null);

-- organisation_invites
create policy "Admins can manage invites" on public.organisation_invites
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.organisation_id = organisation_invites.organisation_id
        and profiles.role = 'admin'
    )
  );

create policy "Anyone can read invite by token" on public.organisation_invites
  for select using (true);

-- company_settings
create policy "Members can read own company settings" on public.company_settings
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.organisation_id = company_settings.organisation_id
    )
  );

create policy "Admins can update company settings" on public.company_settings
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.organisation_id = company_settings.organisation_id
        and profiles.role = 'admin'
    )
  );

-- Helper function to get current user's org_id without triggering RLS recursion
create or replace function public.my_organisation_id()
returns uuid language sql security definer stable as $$
  select organisation_id from public.profiles where id = auth.uid()
$$;

-- Helper function to check if current user is admin of their org
create or replace function public.i_am_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- profiles
create policy "Members can read org profiles" on public.profiles
  for select using (
    organisation_id = public.my_organisation_id()
  );

create policy "Users can update own profile" on public.profiles
  for update using (id = auth.uid());

create policy "Admin can update org profiles" on public.profiles
  for update using (
    organisation_id = public.my_organisation_id()
    and public.i_am_admin()
  );

create policy "Admin can delete org profiles" on public.profiles
  for delete using (
    id != auth.uid()
    and organisation_id = public.my_organisation_id()
    and public.i_am_admin()
  );

create policy "Users can insert own profile" on public.profiles
  for insert with check (id = auth.uid());

-- projects
create policy "Members can read org projects" on public.projects
  for select using (
    organisation_id = public.my_organisation_id()
  );
create policy "Admin/accountant can insert projects" on public.projects
  for insert with check (
    organisation_id = public.my_organisation_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','accountant'))
  );
create policy "Admin/accountant can update projects" on public.projects
  for update using (
    organisation_id = public.my_organisation_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','accountant'))
  );
create policy "Admin can delete projects" on public.projects
  for delete using (
    organisation_id = public.my_organisation_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- journal_entries
create policy "Members can read org journal" on public.journal_entries
  for select using (organisation_id = public.my_organisation_id());
create policy "Admin/accountant can insert journal" on public.journal_entries
  for insert with check (
    organisation_id = public.my_organisation_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','accountant'))
  );
create policy "Admin/accountant can update journal" on public.journal_entries
  for update using (
    organisation_id = public.my_organisation_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','accountant'))
  );
create policy "Admin/accountant can delete journal" on public.journal_entries
  for delete using (
    organisation_id = public.my_organisation_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','accountant'))
  );

-- contract_letters
create policy "Members can read org contract letters" on public.contract_letters
  for select using (organisation_id = public.my_organisation_id());
create policy "Admin/accountant can insert contract letters" on public.contract_letters
  for insert with check (
    organisation_id = public.my_organisation_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','accountant'))
  );
create policy "Admin can delete contract letters" on public.contract_letters
  for delete using (
    organisation_id = public.my_organisation_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- vat_returns
create policy "Members can read org vat returns" on public.vat_returns
  for select using (organisation_id = public.my_organisation_id());
create policy "Admin/accountant can manage vat returns" on public.vat_returns
  for all using (
    organisation_id = public.my_organisation_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','accountant'))
  );

-- payroll_entries
create policy "Members can read org payroll" on public.payroll_entries
  for select using (organisation_id = public.my_organisation_id());
create policy "Admin/accountant can insert payroll" on public.payroll_entries
  for insert with check (
    organisation_id = public.my_organisation_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','accountant'))
  );
create policy "Admin can update payroll" on public.payroll_entries
  for update using (
    organisation_id = public.my_organisation_id()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── STEP 7: Updated handle_new_user trigger ───────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'staff'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
