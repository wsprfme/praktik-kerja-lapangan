/*
# Pengerasan Hak Akses Fungsi Database

## Ringkasan
Membatasi siapa yang boleh memanggil fungsi bantu di database, agar
fungsinya hanya dapat dipakai di dalam aturan akses (RLS) dan trigger,
bukan dipanggil langsung dari luar.

## Perubahan
1. `set_updated_at` diberi search_path tetap agar tidak dapat disalahgunakan.
2. Fungsi bantu identitas (`current_role`, `is_admin`, `my_student_ids`,
   `my_supervisor_ids`): izin dijalankan dicabut dari pengunjung anonim,
   tetap diberikan kepada pengguna yang sudah masuk (dibutuhkan oleh RLS).
3. Fungsi penjaga trigger (`guard_profile_privilege`, `guard_journal_update`,
   `guard_leave_update`): izin dijalankan dicabut dari semua peran publik,
   karena hanya dipakai otomatis oleh trigger.

## Dampak
Tidak mengubah perilaku aplikasi. Aturan akses tetap berjalan sama.
*/

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.current_role() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.my_student_ids() from anon;
revoke execute on function public.my_supervisor_ids() from anon;

revoke execute on function public.guard_profile_privilege() from anon, authenticated;
revoke execute on function public.guard_journal_update() from anon, authenticated;
revoke execute on function public.guard_leave_update() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
