/*
# Pengerasan Hak Akses Fungsi Database (lanjutan)

## Ringkasan
Izin bawaan PostgreSQL memberikan hak eksekusi fungsi kepada PUBLIC, sehingga
pencabutan izin dari peran anon/authenticated saja belum cukup.

## Perubahan
1. Fungsi bantu identitas (current_role, is_admin, my_student_ids,
   my_supervisor_ids): cabut dari PUBLIC, berikan hanya kepada pengguna
   yang sudah masuk. Dibutuhkan oleh aturan akses (RLS).
2. Fungsi penjaga trigger (guard_profile_privilege, guard_journal_update,
   guard_leave_update) dan set_updated_at: cabut dari semua, karena hanya
   dijalankan otomatis oleh trigger.

## Dampak
Tidak mengubah perilaku aplikasi bagi pengguna yang sudah masuk.
*/

revoke execute on function public.current_role() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.my_student_ids() from public;
revoke execute on function public.my_supervisor_ids() from public;
revoke execute on function public.guard_profile_privilege() from public;
revoke execute on function public.guard_journal_update() from public;
revoke execute on function public.guard_leave_update() from public;
revoke execute on function public.set_updated_at() from public;

grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_student_ids() to authenticated;
grant execute on function public.my_supervisor_ids() to authenticated;
