/*
# Akun Admin Awal

## Ringkasan
Membuat satu akun Admin bawaan agar dapat login pertama kali.
Email: admin@pkl.sch.id
Kata sandi awal: Admin123!
Admin dapat mengganti kata sandi dan membuat akun lain setelah login.

## Catatan
- Email sudah terkonfirmasi sehingga dapat langsung login tanpa verifikasi.
- Akun bersifat idempoten: aman dijalankan ulang.
*/

do $$
declare
  v_admin_id uuid;
  v_email text := 'admin@pkl.sch.id';
begin
  select id into v_admin_id from auth.users where email = v_email;

  if v_admin_id is null then
    v_admin_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
      v_email, extensions.crypt('Admin123!', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Administrator PKL"}'::jsonb,
      false, false
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_admin_id, v_admin_id::text,
      jsonb_build_object('sub', v_admin_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  insert into public.profiles (id, role, full_name, email, is_active)
  values (v_admin_id, 'admin', 'Administrator PKL', v_email, true)
  on conflict (id) do update
    set role = 'admin', email = excluded.email, is_active = true;
end $$;
