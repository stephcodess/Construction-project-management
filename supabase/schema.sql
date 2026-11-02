-- ============================================================
-- ELDESIGN CONSTRUCTION ACCOUNTING — Supabase Schema
-- Run this in Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role text not null default 'staff' check (role in ('admin', 'accountant', 'staff')),
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'staff');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- PROJECTS / CONTRACTS
-- ============================================================
create table if not exists public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  client text not null,
  contract_value numeric(15,2),
  start_date date,
  status text default 'active' check (status in ('active', 'completed', 'on_hold')),
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- JOURNAL ENTRIES (Receipts & Payments)
-- ============================================================
create table if not exists public.journal_entries (
  id uuid default uuid_generate_v4() primary key,
  date date not null,
  type text not null check (type in ('receipt', 'payment')),
  description text not null,
  category text not null,
  amount numeric(15,2) not null,
  vat_applicable boolean default false,
  vat_amount numeric(15,2) default 0,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================
-- CONTRACT AWARD LETTERS
-- ============================================================
create table if not exists public.contract_letters (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_url text,
  file_size bigint,
  notes text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================
-- VAT RETURNS
-- ============================================================
create table if not exists public.vat_returns (
  id uuid default uuid_generate_v4() primary key,
  period text not null unique, -- 'yyyy-MM'
  output_vat numeric(15,2) default 0,
  input_vat numeric(15,2) default 0,
  net_vat numeric(15,2) default 0,
  status text default 'pending' check (status in ('pending', 'filed', 'paid')),
  filed_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- PAYROLL ENTRIES
-- ============================================================
create table if not exists public.payroll_entries (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text not null check (type in ('staff', 'consultant')),
  entity_type text check (entity_type in ('individual', 'company')), -- for consultants
  gross_amount numeric(15,2) not null,
  monthly_paye numeric(15,2) default 0,
  wht_rate numeric(5,4) default 0,
  wht_amount numeric(15,2) default 0,
  net_payable numeric(15,2) not null,
  period_start date not null, -- first day of month
  project_id uuid references public.projects(id) on delete set null,
  remitted boolean default false,
  remitted_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.journal_entries enable row level security;
alter table public.contract_letters enable row level security;
alter table public.vat_returns enable row level security;
alter table public.payroll_entries enable row level security;

-- All authenticated users can read everything
create policy "Authenticated users can read profiles" on public.profiles for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read projects" on public.projects for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read journal" on public.journal_entries for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read contract letters" on public.contract_letters for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read vat returns" on public.vat_returns for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read payroll" on public.payroll_entries for select using (auth.role() = 'authenticated');

-- Only admin/accountant can insert/update/delete
create policy "Admin/accountant can insert projects" on public.projects for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'accountant'))
);
create policy "Admin/accountant can update projects" on public.projects for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'accountant'))
);
create policy "Admin/accountant can insert journal" on public.journal_entries for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'accountant'))
);
create policy "Admin/accountant can insert contract letters" on public.contract_letters for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'accountant'))
);
create policy "Admin/accountant can delete contract letters" on public.contract_letters for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin/accountant can upsert vat returns" on public.vat_returns for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'accountant'))
);
create policy "Admin/accountant can insert payroll" on public.payroll_entries for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'accountant'))
);
create policy "Admin can update payroll" on public.payroll_entries for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Profile: users can update their own
create policy "Users can update own profile" on public.profiles for update using (id = auth.uid());

-- ============================================================
-- STORAGE BUCKET for documents
-- ============================================================
-- Run manually in Supabase Dashboard > Storage:
-- Create a bucket named "documents" with public access enabled
-- Or run: insert into storage.buckets (id, name, public) values ('documents', 'documents', true);
