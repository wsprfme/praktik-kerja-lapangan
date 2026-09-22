/*
# Skema Operasional Platform PKL

## Ringkasan
Migrasi ini membuat tabel aktivitas harian PKL beserta aturan aksesnya,
dan menyiapkan penyimpanan berkas privat untuk bukti/ lampiran.

## Tabel Baru
1. `attendance` - presensi harian siswa.
   - tanggal, jam masuk, jam keluar, status (hadir/izin/sakit/alpa), catatan.
   - Unik per siswa per tanggal.
2. `journals` - jurnal kegiatan harian siswa.
   - judul, uraian, durasi (menit), lampiran, status tinjauan,
     umpan balik pembimbing, dan kolom `reviewed_by` + `reviewed_by_name`
     yang menyimpan pembimbing ASLI yang meninjau (untuk riwayat/audit).
   - Unik per siswa per tanggal.
3. `leave_requests` - pengajuan izin/sakit/cuti siswa.
   - jenis, rentang tanggal, alasan, lampiran, status, keputusan oleh siapa.
4. `assessments` - penilaian akhir per siswa per periode.
   - nilai per kategori, nilai akhir, predikat, catatan, penilai asli.
   - Unik per siswa per periode.
5. `announcements` - pengumuman dengan sasaran (semua/pembimbing/siswa).
6. `activity_logs` - catatan aktivitas untuk audit Admin.
   - menyimpan nama pelaku secara denormalisasi agar riwayat tetap utuh.

## Aturan Akses (RLS)
- Admin: akses penuh.
- Pembimbing: hanya data siswa bimbingannya (dibaca dan ditinjau).
- Siswa: hanya data miliknya sendiri.
- Trigger penjaga memastikan siswa tidak dapat mengubah kolom hasil
  tinjauan (umpan balik, status tinjauan, penilai), dan pembimbing tidak
  dapat mengubah isi jurnal/pengajuan milik siswa.
- Pembimbing tidak dapat menyetujui pengajuannya sendiri; hanya pembimbing
  dari siswa terkait yang boleh memutuskan.

## Penyimpanan Berkas
- Bucket privat `pkl-files`. Struktur folder: `<siswa_id>/<jenis>/<file>`.
- Hanya siswa pemilik, pembimbingnya, dan Admin yang dapat membaca.
*/

-- ============================================================
-- Presensi
-- ============================================================
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  check_in_time timestamptz,
  check_out_time timestamptz,
  status text not null default 'hadir' check (status in ('hadir', 'izin', 'sakit', 'alpa')),
  note text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, date)
);

-- ============================================================
-- Jurnal
-- ============================================================
create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  title text not null,
  description text,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  attachment_path text,
  attachment_name text,
  review_status text not null default 'menunggu' check (review_status in ('menunggu', 'ditinjau')),
  supervisor_feedback text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, date)
);

-- ============================================================
-- Pengajuan Izin / Sakit
-- ============================================================
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('izin', 'sakit', 'cuti')),
  start_date date not null,
  end_date date not null,
  reason text not null,
  attachment_path text,
  attachment_name text,
  status text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak', 'dibatalkan')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_by_name text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Penilaian
-- ============================================================
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  period_id uuid references public.pkl_periods(id) on delete set null,
  score_attendance numeric(5,2) check (score_attendance between 0 and 100),
  score_journal numeric(5,2) check (score_journal between 0 and 100),
  score_discipline numeric(5,2) check (score_discipline between 0 and 100),
  score_competence numeric(5,2) check (score_competence between 0 and 100),
  score_attitude numeric(5,2) check (score_attitude between 0 and 100),
  final_score numeric(5,2) check (final_score between 0 and 100),
  predicate text check (predicate in ('A', 'B', 'C', 'D')),
  notes text,
  assessed_by uuid references public.profiles(id) on delete set null,
  assessed_by_name text,
  assessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, period_id)
);

-- ============================================================
-- Pengumuman
-- ============================================================
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'semua' check (audience in ('semua', 'pembimbing', 'siswa')),
  is_published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Catatan Aktivitas (audit Admin)
-- ============================================================
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  actor_role text,
  action text not null,
  entity_type text,
  entity_id uuid,
  description text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Index
-- ============================================================
create index if not exists idx_attendance_student_date on public.attendance(student_id, date desc);
create index if not exists idx_attendance_date on public.attendance(date);
create index if not exists idx_journals_student_date on public.journals(student_id, date desc);
create index if not exists idx_journals_review on public.journals(review_status);
create index if not exists idx_leave_student on public.leave_requests(student_id, start_date desc);
create index if not exists idx_leave_status on public.leave_requests(status);
create index if not exists idx_assessments_student on public.assessments(student_id);
create index if not exists idx_announcements_audience on public.announcements(audience);
create index if not exists idx_activity_logs_created on public.activity_logs(created_at desc);

-- ============================================================
-- Trigger updated_at
-- ============================================================
drop trigger if exists trg_attendance_updated_at on public.attendance;
create trigger trg_attendance_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

drop trigger if exists trg_journals_updated_at on public.journals;
create trigger trg_journals_updated_at
  before update on public.journals
  for each row execute function public.set_updated_at();

drop trigger if exists trg_leave_updated_at on public.leave_requests;
create trigger trg_leave_updated_at
  before update on public.leave_requests
  for each row execute function public.set_updated_at();

drop trigger if exists trg_assessments_updated_at on public.assessments;
create trigger trg_assessments_updated_at
  before update on public.assessments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_announcements_updated_at on public.announcements;
create trigger trg_announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- ============================================================
-- Trigger penjaga integritas
-- ============================================================
create or replace function public.guard_journal_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if auth.uid() = old.student_id then
    if new.student_id <> old.student_id
       or new.date <> old.date
       or new.review_status <> old.review_status
       or coalesce(new.supervisor_feedback, '') <> coalesce(old.supervisor_feedback, '')
       or new.reviewed_by is distinct from old.reviewed_by then
      raise exception 'Kolom tinjauan hanya dapat diubah oleh pembimbing';
    end if;
  elsif auth.uid() = old.reviewed_by or old.student_id in (select public.my_student_ids()) then
    if new.student_id <> old.student_id
       or new.date <> old.date
       or new.title <> old.title
       or coalesce(new.description, '') <> coalesce(old.description, '')
       or coalesce(new.duration_minutes, -1) <> coalesce(old.duration_minutes, -1)
       or coalesce(new.attachment_path, '') <> coalesce(old.attachment_path, '') then
      raise exception 'Isi jurnal hanya dapat diubah oleh siswa';
    end if;
  else
    raise exception 'Tidak berhak mengubah jurnal ini';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_journals_guard on public.journals;
create trigger trg_journals_guard
  before update on public.journals
  for each row execute function public.guard_journal_update();

create or replace function public.guard_leave_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if auth.uid() = old.student_id then
    if new.student_id <> old.student_id
       or new.status not in ('menunggu', 'dibatalkan')
       or new.status <> old.status
       or new.decided_by is distinct from old.decided_by
       or coalesce(new.decided_by_name, '') <> coalesce(old.decided_by_name, '')
       or coalesce(new.decision_note, '') <> coalesce(old.decision_note, '') then
      raise exception 'Keputusan pengajuan hanya dapat diubah oleh pembimbing';
    end if;
  elsif old.student_id in (select public.my_student_ids()) then
    if new.student_id <> old.student_id
       or new.type <> old.type
       or new.start_date <> old.start_date
       or new.end_date <> old.end_date
       or new.reason <> old.reason
       or coalesce(new.attachment_path, '') <> coalesce(old.attachment_path, '') then
      raise exception 'Isi pengajuan hanya dapat diubah oleh siswa';
    end if;
  else
    raise exception 'Tidak berhak mengubah pengajuan ini';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_leave_guard on public.leave_requests;
create trigger trg_leave_guard
  before update on public.leave_requests
  for each row execute function public.guard_leave_update();

-- ============================================================
-- RLS
-- ============================================================
alter table public.attendance enable row level security;
alter table public.journals enable row level security;
alter table public.leave_requests enable row level security;
alter table public.assessments enable row level security;
alter table public.announcements enable row level security;
alter table public.activity_logs enable row level security;

-- attendance -------------------------------------------------
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select to authenticated
  using (public.is_admin() or student_id = auth.uid() or student_id in (select public.my_student_ids()));

drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance
  for insert to authenticated
  with check (public.is_admin() or student_id = auth.uid() or student_id in (select public.my_student_ids()));

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance
  for update to authenticated
  using (
    public.is_admin()
    or student_id in (select public.my_student_ids())
    or (student_id = auth.uid() and date = current_date)
  )
  with check (
    public.is_admin()
    or student_id in (select public.my_student_ids())
    or (student_id = auth.uid() and date = current_date)
  );

drop policy if exists attendance_delete on public.attendance;
create policy attendance_delete on public.attendance
  for delete to authenticated
  using (public.is_admin() or student_id in (select public.my_student_ids()));

-- journals ---------------------------------------------------
drop policy if exists journals_select on public.journals;
create policy journals_select on public.journals
  for select to authenticated
  using (public.is_admin() or student_id = auth.uid() or student_id in (select public.my_student_ids()));

drop policy if exists journals_insert on public.journals;
create policy journals_insert on public.journals
  for insert to authenticated
  with check (public.is_admin() or student_id = auth.uid());

drop policy if exists journals_update on public.journals;
create policy journals_update on public.journals
  for update to authenticated
  using (public.is_admin() or student_id = auth.uid() or student_id in (select public.my_student_ids()))
  with check (public.is_admin() or student_id = auth.uid() or student_id in (select public.my_student_ids()));

drop policy if exists journals_delete on public.journals;
create policy journals_delete on public.journals
  for delete to authenticated
  using (public.is_admin() or student_id = auth.uid());

-- leave_requests ---------------------------------------------
drop policy if exists leave_select on public.leave_requests;
create policy leave_select on public.leave_requests
  for select to authenticated
  using (public.is_admin() or student_id = auth.uid() or student_id in (select public.my_student_ids()));

drop policy if exists leave_insert on public.leave_requests;
create policy leave_insert on public.leave_requests
  for insert to authenticated
  with check (public.is_admin() or student_id = auth.uid());

drop policy if exists leave_update on public.leave_requests;
create policy leave_update on public.leave_requests
  for update to authenticated
  using (public.is_admin() or student_id = auth.uid() or student_id in (select public.my_student_ids()))
  with check (public.is_admin() or student_id = auth.uid() or student_id in (select public.my_student_ids()));

drop policy if exists leave_delete on public.leave_requests;
create policy leave_delete on public.leave_requests
  for delete to authenticated
  using (public.is_admin() or student_id = auth.uid());

-- assessments ------------------------------------------------
drop policy if exists assessments_select on public.assessments;
create policy assessments_select on public.assessments
  for select to authenticated
  using (public.is_admin() or student_id = auth.uid() or student_id in (select public.my_student_ids()));

drop policy if exists assessments_insert on public.assessments;
create policy assessments_insert on public.assessments
  for insert to authenticated
  with check (public.is_admin() or student_id in (select public.my_student_ids()));

drop policy if exists assessments_update on public.assessments;
create policy assessments_update on public.assessments
  for update to authenticated
  using (public.is_admin() or student_id in (select public.my_student_ids()))
  with check (public.is_admin() or student_id in (select public.my_student_ids()));

drop policy if exists assessments_delete on public.assessments;
create policy assessments_delete on public.assessments
  for delete to authenticated
  using (public.is_admin());

-- announcements ----------------------------------------------
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated
  using (
    public.is_admin()
    or (audience = 'semua')
    or (audience = 'pembimbing' and public.current_role() = 'pembimbing')
    or (audience = 'siswa' and public.current_role() = 'siswa')
  );

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements
  for delete to authenticated
  using (public.is_admin());

-- activity_logs ----------------------------------------------
drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs
  for select to authenticated
  using (public.is_admin() or actor_id = auth.uid());

drop policy if exists activity_logs_insert on public.activity_logs;
create policy activity_logs_insert on public.activity_logs
  for insert to authenticated
  with check (public.is_admin() or actor_id = auth.uid());

-- ============================================================
-- Penyimpanan berkas privat
-- ============================================================
insert into storage.buckets (id, name, public)
values ('pkl-files', 'pkl-files', false)
on conflict (id) do update set public = false;

drop policy if exists pkl_files_select on storage.objects;
create policy pkl_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pkl-files'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (select public.my_student_ids()::text)
    )
  );

drop policy if exists pkl_files_insert on storage.objects;
create policy pkl_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pkl-files'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (select public.my_student_ids()::text)
    )
  );

drop policy if exists pkl_files_update on storage.objects;
create policy pkl_files_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pkl-files'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  )
  with check (
    bucket_id = 'pkl-files'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy if exists pkl_files_delete on storage.objects;
create policy pkl_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pkl-files'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );
