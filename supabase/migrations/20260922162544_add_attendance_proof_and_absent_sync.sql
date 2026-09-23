/*
# Bukti Foto Presensi + Penandaan Alpa Otomatis

## Ringkasan
1. Menambah kolom bukti presensi pada tabel `attendance`:
   path foto, nama foto, koordinat, alamat, dan waktu pengambilan foto.
   (Kolom lama `check_out_time` tetap ada agar data lama tidak hilang,
   namun tidak lagi dipakai oleh antarmuka.)
2. Menambah fungsi `sync_absent_attendance()` yang menandai siswa
   bimbingan aktif sebagai "alpa" pada hari kerja yang sudah lewat tanpa
   catatan presensi. Hari libur, akhir pekan, dan tanggal yang sudah
   tercakup pengajuan izin/sakit (menunggu atau disetujui) dilewati.
3. Menjadwalkan fungsi tersebut berjalan otomatis setiap hari pukul
   20.00 WIB melalui pg_cron.
*/

alter table public.attendance
  add column if not exists photo_path text,
  add column if not exists photo_name text,
  add column if not exists latitude numeric(10, 7),
  add column if not exists longitude numeric(10, 7),
  add column if not exists address text,
  add column if not exists captured_at timestamptz;

create or replace function public.sync_absent_attendance()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_inserted integer := 0;
begin
  with working_days as (
    select
      p.id as placement_id,
      p.student_id,
      d.day::date as day
    from public.placements p
    cross join lateral generate_series(
      (v_today - interval '45 days')::timestamp,
      (v_today - interval '1 day')::timestamp,
      interval '1 day'
    ) as d(day)
    where p.status = 'aktif'
      and p.start_date is not null
      and d.day::date >= p.start_date
      and (p.end_date is null or d.day::date <= p.end_date)
      and extract(isodow from d.day) < 6
  ),
  missing as (
    select w.student_id, w.day
    from working_days w
    where not exists (
        select 1 from public.attendance a
        where a.student_id = w.student_id and a.date = w.day
      )
      and not exists (
        select 1 from public.holidays h where h.date = w.day
      )
      and not exists (
        select 1 from public.leave_requests l
        where l.student_id = w.student_id
          and l.status in ('menunggu', 'disetujui')
          and w.day between l.start_date and l.end_date
      )
  )
  insert into public.attendance (student_id, date, status, note)
  select m.student_id, m.day, 'alpa', 'Ditandai otomatis oleh sistem.'
  from missing m
  on conflict (student_id, date) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke execute on function public.sync_absent_attendance() from anon, authenticated;

comment on function public.sync_absent_attendance() is
  'Menandai alpa untuk siswa penempatan aktif pada hari kerja lampau tanpa catatan presensi. Dijalankan otomatis oleh penjadwal harian.';

create or replace function public.confirm_approved_leave_attendance()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  insert into public.attendance (student_id, date, status, note)
  select
    l.student_id,
    d.day::date,
    case when l.type = 'sakit' then 'sakit' else 'izin' end,
    l.reason
  from public.leave_requests l
  cross join lateral generate_series(
    l.start_date::timestamp, l.end_date::timestamp, interval '1 day'
  ) as d(day)
  where l.status = 'disetujui'
    and extract(isodow from d.day) < 6
  on conflict (student_id, date) do update
    set status = excluded.status,
        note = excluded.note
    where public.attendance.status = 'alpa';

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke execute on function public.confirm_approved_leave_attendance() from anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
exception
  when others then
    raise notice 'pg_cron tidak tersedia: %', sqlerrm;
end;
$$;

do $$
begin
  perform cron.unschedule('pkl-mark-absent');
exception
  when others then null;
end;
$$;

do $$
begin
  perform cron.schedule(
    'pkl-mark-absent',
    '0 13 * * *',
    $cron$select public.sync_absent_attendance(); select public.confirm_approved_leave_attendance();$cron$
  );
exception
  when others then
    raise notice 'Penjadwalan otomatis gagal: %', sqlerrm;
end;
$$;
