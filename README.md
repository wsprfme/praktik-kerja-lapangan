# Arsitektur

- Frontend: Vite + React (`src/`), memanggil REST API lewat `VITE_API_URL` (default `http://localhost:3101`).
- Backend: Express + better-sqlite3 (`server/`), skema `server/schema.sql`.
- Auth: JWT (12 jam) + `bcrypt`. Tiap token membawa `token_version`; logout/reset/ganti password menaikkan versi sehingga **semua token lama langsung mati**.
- Database: satu file SQLite `server/db.sqlite`. Semua kolom file hanya menyimpan **path TEXT**.

## Penyimpanan berkas (bukan BLOB)

Foto & dokumen **hanya** ada di `server/uploads/siswa/<studentId>/<folder>/<file>`:

```
server/uploads/
└── siswa/
    ├── <uuid-siswa-1>/presensi/…jpg
    ├── <uuid-siswa-1>/jurnal/…pdf
    └── <uuid-siswa-2>/izin/…jpg
```

- Tidak ada kolom BLOB/base64 di database, tidak ada penyimpanan ganda.
- Server menegakkan **ACL per siswa**: siswa hanya boleh aksesBerkas miliknya, pembimbing hanya berkas siswa bimbingannya, admin semuanya.
- Path selalu diawali `siswa/<uuid>/` sehingga traversal dicegal di层面 server.
- Bawaan kompresi: foto presensi diperkecil ke maksimal 1024px & JPEG 0.72 (±100 KB/foto).
- Unggah dibatasi 5 MB dan hanya menerima `image/jpeg|png|webp|heic` serta `application/pdf`.

## Zona waktu

Semua `created_at`/`updated_at`/jam presensi dicatat server dalam **Asia/Jakarta (WIB, UTC+7)** dan disimpan sebagai ISO-8601 ber-offset (`…+07:00`). Jam presensi **tidak pernah** diambil dari jam perangkat siswa. Tampilan di frontend juga dipaksa ke WIB.

## Keamanan

| Perlindungan | Implementasi |
|---|---|
| Password | bcrypt (cost 10) + policy ≥8 karakter, huruf besar/kecil, angka, simbol |
| Rate limit login | 8 kegagalan / 15 menit per `IP+identitas` → blokir 10 menit (`429`) |
| JWT | `JWT_SECRET` wajib dari env (≥32 karakter), tanpa fallback hardcoded |
| Otorisasi | Ditegakkan di server untuk **setiap** POST/PUT/DELETE (default: tolak) |
| RBAC | Admin / Pembimbing / Siswa; scoping per bypass averted, data di-intersect dengan role, bukan dipercaya dari query string |
| Anonimisasi log | `actor_id`/`actor_name` diambil server, bukan dari payload klien |
| CORS | Whitelist `ALLOWED_ORIGINS` (bukan `*`) |
| Header | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS saat HTTPS |
| Upload | Filter MIME, batas ukuran, nama file diacak, direktori per siswa |
| Error | Global handler → selalu JSON Bahasa Indonesia (tanpa stack trace) |

## Validasi

Backend menegakkan aturan yang tadinya hanya ada di UI: nama wajib, tanggal `YYYY-MM-DD` yang valid, `end_date ≥ start_date`, nilai `0-100` numerik, predikat `A|B|C|D`, jenis/status enum, koordinat dalam rentang, duplikat (email/NISN/nama perusahaan/tanggal libur/hari yang sama), serta placement aktif ganda.

## Pagination

`GET /api/<resource>?page=N&limit=M` mengembalikan header:

- `X-Total-Count`, `X-Page`, `X-Page-Size`, `X-Total-Pages`

Gunakan `listPaged()` dari `src/lib/api.ts` di frontend.

## Menjalankan lokal

```bash
# 1. Backend (port 3101)
cd server
cp .env.example .env
# isi JWT_SECRET (openssl rand -base64 48) dan SEED_ADMIN_PASSWORD
npm install
node index.js

# 2. Frontend (port 5173)
cd ..
cp .env.example .env        # VITE_API_URL
npm install
npm run dev
```

Saat tabel `users` masih kosong, backend membuat satu akun admin dari `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## Deploy

- **Railway (frontend + backend + volume SQLite):** lihat [DEPLOY-RAILWAY.md](./DEPLOY-RAILWAY.md).
- VPS/Caddy (cara lama): `deploy-frontend.sh` + backend `server/index.js` di belakang reverse proxy.

## Alur siswa

1. Pembimbing/Admin membuat akun (Nama, NIS, NISN 10 digit, Kelas, Jurusan, Perusahaan, Periode). **Password awal = NISN**.
2. Siswa login `NISN + NISN`, wajib ganti password (popup mengunci layar, ada tombol mata).
3. Presensi masuk & keluar: foto **kamera depan** + GPS, submit terkunci sampai akurasi ≤ 50 m. Jam dicatat server.
4. Export Excel (exceljs): pembimbing Harian/Mingguan/Bulanan/Seluruh; admin lengkap + sheet Penilaian.
