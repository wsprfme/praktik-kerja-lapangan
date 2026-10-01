# Deploy Full ke Railway (Frontend + Backend)

Satu repo, dua service Railway:

| Service | Root Directory | Builder | Cara jalan |
|---|---|---|---|
| `frontend` | `/` (root repo) | Railpack (default) | Railpack mendeteksi Vite → `npm run build` → `dist/` disajikan **Caddy otomatis** |
| `backend` | `server` | Railpack (default) | Deteksi Node → `npm ci` → `npm start` (`node index.js`) |

## Status deploy saat ini (via Railway CLI)

| Item | Nilai |
|---|---|
| Frontend | `https://frontend-production-6107.up.railway.app` |
| Backend | `https://backend-production-0047.up.railway.app` |
| Region | `asia-southeast1` (Singapura) |
| Volume backend | `backend-volume-8npV` → mount `/data` (SQLite + uploads) |
| Admin awal | `admin@smkn1bmr.sch.id` |

### Cara update / deploy ulang

```bash
# Frontend (dari root repo)
railway up --service frontend --detach

# Backend (folder server sebagai root build — flag --path-as-root WAJIB)
railway up server --path-as-root --service backend --detach
```

Lihat status & log:

```bash
railway service status --service backend --json
railway logs --service backend --deployment --lines 50
railway logs --service frontend --build --lines 100
```

### Catatan penting hasil deploy (Railway CLI v5.63.1)

- `railway up <subfolder>` **wajib** `--path-as-root`, kalau tidak error `prefix not found` (bug prefix arsip CLI).
- Plan trial/Hobby hanya boleh **1 region**. Kalau service punya 2 region (`multiRegionConfig`), deploy langsung `FAILED` dengan `configErrors` dan **tanpa build**. Rapikan dengan: `railway service scale --service <nama> sfo=0` (atau region lain `=0`).
- Volume terikat region. Pindah region service = volume lama tidak ikut; buat volume baru (data lama harus dimigrasi dulu).
- `railway service restart` tidak didukung untuk deployment CLI (`Deployment is not restartable`); gunakan `railway service redeploy --service <nama> --yes` atau `railway up` lagi.
- Akses isi volume (`railway volume files ...`) butuh SSH key terdaftar: `railway ssh keys add`.
- Healthcheck path (`/api/health` backend, `/health` frontend) dan restart policy diatur di dashboard (tidak ada flag CLI-nya).

> Langkah-langkah dashboard di bawah tetap bisa dipakai sebagai alternatif (mis. kalau ingin auto-deploy dari GitHub).


Karena builder default Railway (Railpack) sudah menangani keduanya, **tidak perlu Dockerfile / Caddyfile / railway.json**:

- Frontend otomatis dapat: `/health`, kompresi gzip+zstd, fallback SPA (`try_files` → `index.html`), header `X-Content-Type-Options: nosniff`.
- Backend sudah 100% env-driven: `PORT`, `DB_FILE`, `UPLOAD_DIR`, `JWT_SECRET`, `ALLOWED_ORIGINS`, dll.

> **Penting:** semua perubahan harus di-commit dan di-push ke GitHub dulu (`origin/main`). Railway men-deploy dari GitHub, bukan dari folder lokal.

---

## 0. Prasyarat

1. Repo sudah ter-push ke GitHub: `github.com/wsprfme/praktik-kerja-lapangan`.
2. Akun Railway (trial $5, lalu plan Hobby $5/bulan).
3. Generate `JWT_SECRET` baru:
   ```bash
   openssl rand -base64 48
   ```

---

## 1. Service Backend

1. Railway → **New Project** → **Deploy from GitHub repo** → pilih repo ini.
2. Rename service menjadi `backend`.
3. **Settings → Source → Root Directory**: `server`
4. **Variables** — tambahkan:

   | Variabel | Nilai |
   |---|---|
   | `JWT_SECRET` | hasil `openssl rand -base64 48` (wajib ≥ 32 karakter) |
   | `DB_FILE` | `/data/db.sqlite` |
   | `UPLOAD_DIR` | `/data/uploads` |
   | `SEED_ADMIN_EMAIL` | email admin awal, mis. `admin@pkl.local` |
   | `SEED_ADMIN_PASSWORD` | password admin awal (hanya dipakai saat tabel `users` kosong) |
   | `ALLOWED_ORIGINS` | isi nanti setelah domain frontend ada (langkah 3) |

5. **Volume** (wajib, kalau tidak data hilang tiap deploy):
   - Command Palette (`⌘K`) / klik kanan canvas → **Volume** → attach ke service `backend`.
   - **Mount path**: `/data`
   - Opsional: naikkan ukuran volume (foto presensi/jurnal siswa terus bertambah).
6. **Settings → Deploy**:
   - Healthcheck Path: `/api/health`
   - Restart Policy: `ON_FAILURE`
7. **Networking → Generate Domain** → catat, mis. `https://backend-production-xxxx.up.railway.app`.
8. Cek: buka `https://<domain-backend>/api/health` → harus `{"ok":true,"timezone":"Asia/Jakarta"}`.

> Region: pilih **Asia Southeast (Singapore)** saat membuat project/volume agar dekat ke Indonesia.

---

## 2. Service Frontend

1. Di project yang sama: **Create → GitHub Repo** → repo yang sama.
2. Rename service menjadi `frontend`. **Root Directory biarkan kosong** (root repo).
3. **Variables** — tambahkan:

   | Variabel | Nilai |
   |---|---|
   | `VITE_API_URL` | `https://<domain-backend>` (tanpa trailing slash) |
   | `VITE_MAPBOX_TOKEN` | token `pk.…` (opsional, untuk reverse geocoding presensi) |

   > `VITE_*` dibaca **saat build**. Kalau nilainya diubah, Railway otomatis build ulang — pastikan `VITE_API_URL` sudah benar sebelum deploy pertama, kalau tidak frontend akan menembak `http://localhost:3101`.

4. Deploy. Log akan terlihat: `Deploying as vite static site` → build → Caddy.
5. **Settings → Deploy → Healthcheck Path**: `/health`.
6. **Networking → Generate Domain** → catat, mis. `https://frontend-production-xxxx.up.railway.app`.

---

## 3. Kunci CORS (langkah terakhir)

Kembali ke service `backend` → Variables:

```
ALLOWED_ORIGINS=https://<domain-frontend>
```

Railway otomatis redeploy saat variabel berubah. Setelah itu login dari frontend harus jalan.

---

## 4. Checklist setelah deploy

- [ ] `https://<domain-backend>/api/health` → `{"ok":true,...}`
- [ ] Frontend terbuka, login admin seed berhasil (kalau gagal, cek CORS di langkah 3)
- [ ] Ganti password admin seed
- [ ] Upload foto presensi berhasil → restart/redeploy backend → foto masih ada (bukti volume bekerja)
- [ ] Presensi mencatat jam WIB (bukan jam device)

---

## Catatan penting

- **Jangan scale backend lebih dari 1 replica.** SQLite + folder uploads di satu volume tidak aman untuk multi-replica.
- **Volume hanya di-mount saat runtime**, bukan saat build — kode ini aman karena DB dibuat saat `index.js` start, bukan saat build.
- **Node dipin ke 22.x** (`engines` di `package.json` dan `server/package.json`) supaya `better-sqlite3` memakai binary prebuilt (deploy lebih cepat & tidak perlu kompilasi). Kalau mau naik Node, upgrade `better-sqlite3` dulu.
- `deploy-frontend.sh` dan setup Caddy VPS lama tidak dipakai di Railway (biarkan saja, tidak mengganggu).
- **Mapbox**: batasi URL restriction token ke domain frontend Railway / domain produksi.
- **PWA**: service worker precache aset dari domain frontend; API & Mapbox selalu network (sudah diatur di `vite.config.ts`).

---

## Migrasi data dari VPS (opsional)

Kalau ingin memindahkan database & foto yang sudah ada:

```bash
# 1) Rapikan WAL agar cukup menyalin satu file
sqlite3 server/db.sqlite "PRAGMA wal_checkpoint(TRUNCATE);"

# 2) Install & login Railway CLI
npm i -g @railway/cli
railway login
railway link          # pilih project & service "backend"

# 3) Upload database ke volume (/data)
railway volume files upload ./server/db.sqlite /db.sqlite

# 4) Upload folder uploads (bungkus tar dulu)
tar -czf /tmp/uploads.tar.gz -C server/uploads .
railway volume files upload /tmp/uploads.tar.gz /uploads.tar.gz

# 5) Extract di container backend
railway ssh
# di dalam container:
tar -xzf /data/uploads.tar.gz -C /data/uploads && rm /data/uploads.tar.gz
exit
```

Setelah itu redeploy service backend.

---

## Troubleshooting

| Gejala | Penyebab / solusi |
|---|---|
| Backend exit: `JWT_SECRET wajib diisi` | `JWT_SECRET` belum di-set atau < 32 karakter |
| Frontend error CORS / API gagal | `ALLOWED_ORIGINS` harus persis origin frontend (`https://...`, tanpa trailing slash, tanpa path) |
| Frontend menembak `http://localhost:3101` | `VITE_API_URL` tidak ada saat build → set variabel lalu redeploy |
| Data hilang tiap deploy/restart | Volume belum ke-mount ke `/data`, atau `DB_FILE`/`UPLOAD_DIR` bukan di `/data/...` |
| Deploy frontend gagal di healthcheck | Healthcheck path harus `/health` (disediakan default Caddyfile Railpack) |
| Deploy backend gagal build `better-sqlite3` | Pastikan `engines.node` tetap `22.x` (jangan dihapus) |
| `npm ci` gagal: lock tidak sinkron | Jalankan `npm install` di root & `server/`, commit `package-lock.json` |
| Upload 413/500 | Cek ukuran volume `/data` dan `MAX_UPLOAD_BYTES` (default 5 MB) |
