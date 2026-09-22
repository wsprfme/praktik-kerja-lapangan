/*
# Skema Inti Platform Manajemen PKL

## Ringkasan
Migrasi ini membuat fondasi data untuk platform PKL dengan tiga peran:
Admin, Pembimbing, dan Siswa. Semua tabel dilindungi Row Level Security.

## Tabel Baru
1. `profiles` - identitas dasar semua pengguna (id mengikuti akun login).
   - role: 'admin' | 'pembimbing' | 'siswa'
   - full_name, email, phone, address, avatar_url, is_active
2. `pembimbing_profiles` - data tambahan pembimbing: nip, department.
3. `siswa_profiles` - data tambahan siswa: nis, class_name, major.
4. `companies` - data perusahaan/industri tempat PKL.
5. `pkl_periods` - periode PKL (tahun ajaran, tanggal mulai/selesai, penanda aktif).
6. `placements` - penempatan siswa ke perusahaan + pembimbing + periode.
7. `holidays` - kalender hari libur.

## Fungsi Bantu (SECURITY DEFINER, untuk menghindari rekursi RLS)
- `current_role()`, `is_admin()`, `my_student_ids()`, `my_supervisor_ids()`.

## Keamanan (RLS)
- RLS aktif di semua tabel.
- Admin: akses penuh ke seluruh tabel.
- Pembimbing: hanya melihat data siswa yang ditugaskan kepadanya.
- Siswa: hanya melihat data miliknya sendiri.
- Trigger `guard_profile_privilege` mencegah non-admin mengubah kolom
  `role` dan `is_active` pada `profiles`.
- Tidak ada policy DELETE pada `profiles`.
*/

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- Tabel
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'pembimbing', 'siswa')),
  full_name text not null,
  email text not null,
  phone text,
  address text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pembimbing_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  nip text,
  department text
);

create table if not exists public.siswa_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  nis text,
  class_name text,
  major text
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  field_of_work text,
  contact_person text,
  contact_phone text,
  contact_email text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pkl_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  academic_year text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete restrict,
  company_id uuid references public.companies(id) on delete restrict,
  supervisor_id uuid references public.profiles(id) on delete restrict,
  period_id uuid references public.pkl_periods(id) on delete restrict,
  start_date date,
  end_date date,
  status text not null default 'draft' check (status in ('draft', 'aktif', 'selesai', 'dibatalkan')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Index
-- ============================================================
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_placements_student on public.placements(student_id);
create index if not exists idx_placements_supervisor on public.placements(supervisor_id);
create index if not exists idx_placements_period on public.placements(period_id);
create index if not exists idx_placements_company on public.placements(company_id);
create unique index if not exists uq_placements_active_student_period
  on public.placements(student_id, period_id)
  where status = 'aktif';

-- ============================================================
-- Fungsi bantu
-- ============================================================
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.my_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select student_id from public.placements where supervisor_id = auth.uid();
$$;

create or replace function public.my_supervisor_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select supervisor_id from public.placements
  where student_id = auth.uid() and supervisor_id is not null;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Trigger
-- ============================================================
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

drop trigger if exists trg_periods_updated_at on public.pkl_periods;
create trigger trg_periods_updated_at
  before update on public.pkl_periods
  for each row execute function public.set_updated_at();

drop trigger if exists trg_placements_updated_at on public.placements;
create trigger trg_placements_updated_at
  before update on public.placements
  for each row execute function public.set_updated_at();

create or replace function public.guard_profile_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role <> old.role then
      raise exception 'Peran akun tidak dapat diubah';
    end if;
    if new.is_active <> old.is_active then
      raise exception 'Status akun tidak dapat diubah';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_privilege();

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.pembimbing_profiles enable row level security;
alter table public.siswa_profiles enable row level security;
alter table public.companies enable row level security;
alter table public.pkl_periods enable row level security;
alter table public.placements enable row level security;
alter table public.holidays enable row level security;

-- profiles ---------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or id in (select public.my_student_ids())
    or id in (select public.my_supervisor_ids())
  );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.is_admin() or id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_admin() or id = auth.uid())
  with check (public.is_admin() or id = auth.uid());

-- pembimbing_profiles ----------------------------------------
drop policy if exists pembimbing_profiles_select on public.pembimbing_profiles;
create policy pembimbing_profiles_select on public.pembimbing_profiles
  for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or profile_id in (select public.my_supervisor_ids())
  );

drop policy if exists pembimbing_profiles_insert on public.pembimbing_profiles;
create policy pembimbing_profiles_insert on public.pembimbing_profiles
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists pembimbing_profiles_update on public.pembimbing_profiles;
create policy pembimbing_profiles_update on public.pembimbing_profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- siswa_profiles ---------------------------------------------
drop policy if exists siswa_profiles_select on public.siswa_profiles;
create policy siswa_profiles_select on public.siswa_profiles
  for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_admin()
    or profile_id in (select public.my_student_ids())
  );

drop policy if exists siswa_profiles_insert on public.siswa_profiles;
create policy siswa_profiles_insert on public.siswa_profiles
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists siswa_profiles_update on public.siswa_profiles;
create policy siswa_profiles_update on public.siswa_profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- companies --------------------------------------------------
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select to authenticated
  using (true);

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists companies_delete on public.companies;
create policy companies_delete on public.companies
  for delete to authenticated
  using (public.is_admin());

-- pkl_periods ------------------------------------------------
drop policy if exists pkl_periods_select on public.pkl_periods;
create policy pkl_periods_select on public.pkl_periods
  for select to authenticated
  using (true);

drop policy if exists pkl_periods_insert on public.pkl_periods;
create policy pkl_periods_insert on public.pkl_periods
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists pkl_periods_update on public.pkl_periods;
create policy pkl_periods_update on public.pkl_periods
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists pkl_periods_delete on public.pkl_periods;
create policy pkl_periods_delete on public.pkl_periods
  for delete to authenticated
  using (public.is_admin());

-- placements -------------------------------------------------
drop policy if exists placements_select on public.placements;
create policy placements_select on public.placements
  for select to authenticated
  using (
    public.is_admin()
    or student_id = auth.uid()
    or supervisor_id = auth.uid()
  );

drop policy if exists placements_insert on public.placements;
create policy placements_insert on public.placements
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists placements_update on public.placements;
create policy placements_update on public.placements
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists placements_delete on public.placements;
create policy placements_delete on public.placements
  for delete to authenticated
  using (public.is_admin());

-- holidays ---------------------------------------------------
drop policy if exists holidays_select on public.holidays;
create policy holidays_select on public.holidays
  for select to authenticated
  using (true);

drop policy if exists holidays_insert on public.holidays;
create policy holidays_insert on public.holidays
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists holidays_update on public.holidays;
create policy holidays_update on public.holidays
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists holidays_delete on public.holidays;
create policy holidays_delete on public.holidays
  for delete to authenticated
  using (public.is_admin());
