/*
# Perbaikan Kolom Token Akun (Penyebab Gagal Login)

## Masalah
Akun yang dibuat langsung lewat skrip memiliki beberapa kolom token bernilai
NULL di tabel akun. Layanan autentikasi mengharapkan kolom tersebut berisi
teks kosong, bukan NULL. Akibatnya proses login gagal dengan pesan
"Database error querying schema".

## Perbaikan
Mengisi kolom berikut dengan teks kosong bila masih NULL, untuk SEMUA akun:
1. confirmation_token
2. recovery_token
3. email_change_token_new
4. email_change

## Catatan
Perubahan ini tidak menghapus data apa pun dan tidak mengubah kata sandi.
Akun yang dibuat melalui menu Admin di aplikasi tidak terpengaruh karena
sudah terisi dengan benar.
*/

update auth.users
set confirmation_token = coalesce(confirmation_token, '')
where confirmation_token is null;

update auth.users
set recovery_token = coalesce(recovery_token, '')
where recovery_token is null;

update auth.users
set email_change_token_new = coalesce(email_change_token_new, '')
where email_change_token_new is null;

update auth.users
set email_change = coalesce(email_change, '')
where email_change is null;

update auth.users
set email_change_token_current = coalesce(email_change_token_current, '')
where email_change_token_current is null;

update auth.users
set phone_change = coalesce(phone_change, '')
where phone_change is null;

update auth.users
set phone_change_token = coalesce(phone_change_token, '')
where phone_change_token is null;

update auth.users
set reauthentication_token = coalesce(reauthentication_token, '')
where reauthentication_token is null;
