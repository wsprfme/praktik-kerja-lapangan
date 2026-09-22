/*
# Data Contoh untuk Uji Coba

## Ringkasan
Menambahkan data contoh agar ketiga peran (Admin, Pembimbing, Siswa) dapat
langsung dicoba. Data ini boleh dihapus kapan saja melalui menu Admin.

## Akun Contoh
- Pembimbing: budi.pembimbing@pkl.sch.id / Pembimbing123!
- Siswa 1: rina.siswa@pkl.sch.id / Siswa123!
- Siswa 2: dimas.siswa@pkl.sch.id / Siswa123!

## Data Lain
1. Dua perusahaan mitra.
2. Satu periode PKL aktif.
3. Dua penempatan siswa.
4. Beberapa presensi dan jurnal contoh.

## Catatan
Bersifat idempoten; aman dijalankan ulang.
*/

do $$
declare
  v_pembimbing uuid;
  v_siswa1 uuid;
  v_siswa2 uuid;
  v_company1 uuid;
  v_company2 uuid;
  v_period uuid;
  v_placement1 uuid;
  v_placement2 uuid;
  v_today date := current_date;
begin
  -- ============ Akun Pembimbing ============
  select id into v_pembimbing from auth.users where email = 'budi.pembimbing@pkl.sch.id';
  if v_pembimbing is null then
    v_pembimbing := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    values ('00000000-0000-0000-0000-000000000000', v_pembimbing, 'authenticated', 'authenticated',
      'budi.pembimbing@pkl.sch.id', extensions.crypt('Pembimbing123!', extensions.gen_salt('bf')),
      now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Budi Santoso"}'::jsonb, false, false);
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_pembimbing, v_pembimbing::text,
      jsonb_build_object('sub', v_pembimbing::text, 'email', 'budi.pembimbing@pkl.sch.id', 'email_verified', true),
      'email', now(), now(), now());
  end if;

  insert into public.profiles (id, role, full_name, email, phone, is_active)
  values (v_pembimbing, 'pembimbing', 'Budi Santoso', 'budi.pembimbing@pkl.sch.id', '081234567890', true)
  on conflict (id) do update set role = 'pembimbing', full_name = excluded.full_name;

  insert into public.pembimbing_profiles (profile_id, nip, department)
  values (v_pembimbing, '198501012010011001', 'Rekayasa Perangkat Lunak')
  on conflict (profile_id) do update set nip = excluded.nip, department = excluded.department;

  -- ============ Akun Siswa ============
  select id into v_siswa1 from auth.users where email = 'rina.siswa@pkl.sch.id';
  if v_siswa1 is null then
    v_siswa1 := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    values ('00000000-0000-0000-0000-000000000000', v_siswa1, 'authenticated', 'authenticated',
      'rina.siswa@pkl.sch.id', extensions.crypt('Siswa123!', extensions.gen_salt('bf')),
      now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Rina Wijaya"}'::jsonb, false, false);
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_siswa1, v_siswa1::text,
      jsonb_build_object('sub', v_siswa1::text, 'email', 'rina.siswa@pkl.sch.id', 'email_verified', true),
      'email', now(), now(), now());
  end if;

  insert into public.profiles (id, role, full_name, email, phone, is_active)
  values (v_siswa1, 'siswa', 'Rina Wijaya', 'rina.siswa@pkl.sch.id', '081298765432', true)
  on conflict (id) do update set role = 'siswa', full_name = excluded.full_name;

  insert into public.siswa_profiles (profile_id, nis, class_name, major)
  values (v_siswa1, '2024001', 'XII RPL 1', 'Rekayasa Perangkat Lunak')
  on conflict (profile_id) do update set nis = excluded.nis, class_name = excluded.class_name;

  select id into v_siswa2 from auth.users where email = 'dimas.siswa@pkl.sch.id';
  if v_siswa2 is null then
    v_siswa2 := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    values ('00000000-0000-0000-0000-000000000000', v_siswa2, 'authenticated', 'authenticated',
      'dimas.siswa@pkl.sch.id', extensions.crypt('Siswa123!', extensions.gen_salt('bf')),
      now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Dimas Prakoso"}'::jsonb, false, false);
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_siswa2, v_siswa2::text,
      jsonb_build_object('sub', v_siswa2::text, 'email', 'dimas.siswa@pkl.sch.id', 'email_verified', true),
      'email', now(), now(), now());
  end if;

  insert into public.profiles (id, role, full_name, email, phone, is_active)
  values (v_siswa2, 'siswa', 'Dimas Prakoso', 'dimas.siswa@pkl.sch.id', '081377788899', true)
  on conflict (id) do update set role = 'siswa', full_name = excluded.full_name;

  insert into public.siswa_profiles (profile_id, nis, class_name, major)
  values (v_siswa2, '2024002', 'XII RPL 1', 'Rekayasa Perangkat Lunak')
  on conflict (profile_id) do update set nis = excluded.nis, class_name = excluded.class_name;

  -- ============ Perusahaan ============
  select id into v_company1 from public.companies where name = 'PT Solusi Digital Nusantara';
  if v_company1 is null then
    v_company1 := gen_random_uuid();
    insert into public.companies (id, name, address, field_of_work, contact_person, contact_phone, contact_email)
    values (v_company1, 'PT Solusi Digital Nusantara', 'Jl. Merdeka No. 45, Bandung', 'Pengembangan Perangkat Lunak',
      'Andi Kurniawan', '0221234567', 'hrd@solusidigital.co.id');
  end if;

  select id into v_company2 from public.companies where name = 'CV Kreatif Media Utama';
  if v_company2 is null then
    v_company2 := gen_random_uuid();
    insert into public.companies (id, name, address, field_of_work, contact_person, contact_phone, contact_email)
    values (v_company2, 'CV Kreatif Media Utama', 'Jl. Asia Afrika No. 12, Bandung', 'Desain Grafis & Multimedia',
      'Sari Melati', '0227654321', 'info@kreatifmedia.co.id');
  end if;

  -- ============ Periode ============
  select id into v_period from public.pkl_periods where name = 'PKL Gelombang 1';
  if v_period is null then
    v_period := gen_random_uuid();
    insert into public.pkl_periods (id, name, academic_year, start_date, end_date, is_active)
    values (v_period, 'PKL Gelombang 1', '2025/2026', v_today - 30, v_today + 60, true);
  end if;

  -- Pastikan hanya periode ini yang aktif
  update public.pkl_periods set is_active = (id = v_period);

  -- ============ Penempatan ============
  select id into v_placement1 from public.placements where student_id = v_siswa1 and period_id = v_period;
  if v_placement1 is null then
    v_placement1 := gen_random_uuid();
    insert into public.placements (id, student_id, company_id, supervisor_id, period_id, start_date, end_date, status)
    values (v_placement1, v_siswa1, v_company1, v_pembimbing, v_period, v_today - 30, v_today + 60, 'aktif');
  end if;

  select id into v_placement2 from public.placements where student_id = v_siswa2 and period_id = v_period;
  if v_placement2 is null then
    v_placement2 := gen_random_uuid();
    insert into public.placements (id, student_id, company_id, supervisor_id, period_id, start_date, end_date, status)
    values (v_placement2, v_siswa2, v_company2, v_pembimbing, v_period, v_today - 30, v_today + 60, 'aktif');
  end if;

  -- ============ Presensi contoh ============
  insert into public.attendance (student_id, date, check_in_time, check_out_time, status, recorded_by, note)
  values
    (v_siswa1, v_today - 2, (v_today - 2 + time '07:55'), (v_today - 2 + time '16:30'), 'hadir', v_siswa1, null),
    (v_siswa1, v_today - 1, (v_today - 1 + time '08:05'), (v_today - 1 + time '16:15'), 'hadir', v_siswa1, null),
    (v_siswa2, v_today - 2, (v_today - 2 + time '08:00'), (v_today - 2 + time '16:00'), 'hadir', v_siswa2, null),
    (v_siswa2, v_today - 1, null, null, 'izin', v_siswa2, 'Mengikuti kegiatan lomba di sekolah')
  on conflict (student_id, date) do nothing;

  -- ============ Jurnal contoh ============
  insert into public.journals (student_id, date, title, description, duration_minutes, review_status,
    supervisor_feedback, reviewed_by, reviewed_by_name, reviewed_at)
  values
    (v_siswa1, v_today - 2, 'Pengenalan lingkungan kerja',
     'Berkenalan dengan tim pengembang dan mempelajari alur kerja proyek yang sedang berjalan.',
     480, 'ditinjau', 'Bagus, pertahankan semangat belajarnya.', v_pembimbing, 'Budi Santoso', now()),
    (v_siswa1, v_today - 1, 'Membuat tampilan halaman login',
     'Membuat antarmuka halaman login menggunakan komponen yang sudah ada, lalu menyesuaikan warna dengan panduan desain perusahaan.',
     450, 'menunggu', null, null, null, null),
    (v_siswa2, v_today - 2, 'Membuat materi promosi',
     'Membantu tim desain membuat aset gambar untuk kebutuhan promosi media sosial.',
     480, 'menunggu', null, null, null, null)
  on conflict (student_id, date) do nothing;

  -- ============ Pengajuan contoh ============
  if not exists (select 1 from public.leave_requests where student_id = v_siswa2 and start_date = v_today - 1) then
    insert into public.leave_requests (student_id, type, start_date, end_date, reason, status)
    values (v_siswa2, 'izin', v_today - 1, v_today - 1,
      'Mewakili sekolah dalam lomba desain tingkat kota.', 'menunggu');
  end if;

  -- ============ Pengumuman contoh ============
  if not exists (select 1 from public.announcements where title = 'Pengumpulan Laporan Akhir PKL') then
    insert into public.announcements (title, body, audience, created_by_name)
    values ('Pengumpulan Laporan Akhir PKL',
      'Seluruh siswa diharapkan menyelesaikan laporan akhir PKL sebelum periode berakhir. Pastikan jurnal harian sudah terisi lengkap dan ditinjau oleh pembimbing.',
      'semua', 'Administrator PKL');
  end if;
end $$;
