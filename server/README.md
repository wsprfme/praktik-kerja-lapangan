# Backend PKL Management (Express + SQLite)

Ringkasan singkat untuk service `backend`. Arsitektur lengkap ada di
[`../README.md`](../README.md) dan panduan deploy di
[`../DEPLOY-RAILWAY.md`](../DEPLOY-RAILWAY.md).

## Menjalankan lokal

```bash
cp .env.example .env   # isi JWT_SECRET & SEED_ADMIN_PASSWORD
npm install
npm start              # http://localhost:3101
```

## Variabel lingkungan penting

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `3101` | Di Railway diisi otomatis |
| `DB_FILE` | `./db.sqlite` | **Railway: `/data/db.sqlite`** (volume) |
| `UPLOAD_DIR` | `./uploads` | **Railway: `/data/uploads`** (volume) |
| `JWT_SECRET` | — | wajib, ≥ 32 karakter |
| `TOKEN_TTL` | `12h` | masa berlaku sesi |
| `ALLOWED_ORIGINS` | localhost | whitelist CORS, pisahkan dengan koma |
| `MAX_UPLOAD_BYTES` | `5242880` | batas unggah 5 MB |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | — | hanya dipakai saat tabel `users` kosong |

## Deploy Railway (auto)

- Service `backend`, **Root Directory: `server`**, builder Railpack (deteksi `npm start`).
- Volume `backend-volume-8npV` → mount `/data` (SQLite + uploads).
- **Auto-deploy**: setiap push ke branch `main` yang mengubah `server/**`
  (watch pattern `/server/**`) akan memicu build otomatis.
  Trigger Railway: `c00b97ce-84bb-4c67-aa1d-a67dcae1283d`.
- Healthcheck: `/api/health`.
- Deploy manual darurat: `railway up server --path-as-root --service backend --detach`.
