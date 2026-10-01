// PKL Management backend: Express + SQLite + folder uploads.
//
// Kontrak penting:
// - File gambar/dokumen HANYA di server/uploads/. Kolom file di DB hanya TEXT path
//   dengan bentuk `siswa/<studentId>/<folder>/<file>` — tidak ada BLOB/base64 di DB.
// - Semua waktu dicatat dalam zona waktu Asia/Jakarta (WIB, UTC+7).
// - Otorisasi ditegakkan di server untuk SETIAP endpoint tulis (POST/PUT/DELETE).
// - Semua error dikembalikan sebagai JSON Bahasa Indonesia, tidak pernah stack trace.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const Database = require("better-sqlite3");

dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config();

// ---------------------------------------------------------------------------
// Konfigurasi
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT || 3101);
const JWT_SECRET = process.env.JWT_SECRET;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "db.sqlite");
// (fix) UPLOAD_DIR wajib absolut: guard startsWith di /api/files dan
// res.sendFile sama-sama rusak bila nilainya relative (mis. "./uploads").
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, "uploads"));
const TOKEN_TTL = process.env.TOKEN_TTL || "12h";
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    "[pkl-server] FATAL: JWT_SECRET wajib diisi di server/.env dengan minimal 32 karakter.\n" +
      "              Contoh: openssl rand -base64 48",
  );
  process.exit(1);
}

const ALLOWED_FOLDERS = ["presensi", "jurnal", "izin", "avatar"];
const UPLOAD_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  // (fix) Safari iOS mengirim HEIC sebagai image/heif — tanpa ini upload iPhone kena 415.
  "image/heif": ".heif",
  "application/pdf": ".pdf",
};
const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);
const APP_TIMEZONE = "Asia/Jakarta";
const WIB_OFFSET = "+07:00";

for (const f of ALLOWED_FOLDERS) fs.mkdirSync(path.join(UPLOAD_DIR, "siswa", f), { recursive: true });

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8"));

// Migrasi ringan untuk DB yang sudah ada sebelum kolom token_version ditambahkan.
const userColumns = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userColumns.includes("token_version")) {
  db.exec("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0");
  console.log("[migrate] users.token_version ditambahkan");
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Waktu sekarang sebagai ISO-8601 dengan offset WIB (Asia/Jakarta). */
function nowJakarta() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  // `hour` bisa "24" pada beberapa runtime locale midnight.
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}:${p.second}${WIB_OFFSET}`;
}

/** Tanggal hari ini di WIB sebagai YYYY-MM-DD. */
function todayJakarta() {
  return nowJakarta().slice(0, 10);
}

/** Geser tanggal YYYY-MM-DD sejauh n hari (aritmetika UTC; WIB tanpa DST). */
function shiftDateISO(value, days) {
  const t = new Date(`${value}T00:00:00Z`).getTime() + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Tanggal WIB kemarin sebagai YYYY-MM-DD (batas susulan presensi keluar). */
function yesterdayJakarta() {
  return shiftDateISO(todayJakarta(), -1);
}

/** True bila tanggal terdaftar sebagai hari libur admin. */
function isHolidayDate(value) {
  return !!db.prepare("SELECT 1 FROM holidays WHERE date = ?").get(value);
}

/** True bila siswa punya penempatan aktif lengkap (syarat presensi & jurnal). */
function hasActivePlacement(studentId) {
  return !!db
    .prepare(
      "SELECT 1 FROM placements WHERE student_id = ? AND status = 'aktif' AND company_id IS NOT NULL AND supervisor_id IS NOT NULL LIMIT 1",
    )
    .get(studentId);
}

const nowISO = nowJakarta;
const uid = () => crypto.randomUUID();
const toBool = (v) => (v ? 1 : 0);
const fromBool = (v) => !!v;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function isValidDateTime(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return false;
  return true;
}
function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone ?? null,
    address: row.address ?? null,
    avatar_url: row.avatar_url ?? null,
    is_active: fromBool(row.is_active),
    must_change_password: fromBool(row.must_change_password),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
function mapRow(row, boolFields = []) {
  if (!row) return null;
  const out = { ...row };
  for (const f of boolFields) if (f in out) out[f] = fromBool(out[f]);
  return out;
}

function passwordProblem(password, allowNisn = false) {
  if (allowNisn && /^\d{10}$/.test(password)) return null;
  if (password.length < 8) return "Kata sandi minimal 8 karakter.";
  if (!/[a-z]/.test(password)) return "Kata sandi harus memuat minimal satu huruf kecil.";
  if (!/[A-Z]/.test(password)) return "Kata sandi harus memuat minimal satu huruf besar.";
  if (!/[0-9]/.test(password)) return "Kata sandi harus memuat minimal satu angka.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Kata sandi harus memuat minimal satu simbol, misalnya ! atau #.";
  return null;
}

const NISN_RE = /^\d{10}$/;

// ---------------------------------------------------------------------------
// Rate limit login (in-memory, per identitas + IP)
// ---------------------------------------------------------------------------

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_BLOCK_MS = 10 * 60 * 1000;

function loginRateKey(req, identity) {
  return `${req.ip}|${String(identity || "").toLowerCase()}`;
}
function checkLoginRate(key) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry) return null;
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const seconds = Math.ceil((entry.blockedUntil - now) / 1000);
    return `Terlalu banyak percobaan gagal. Coba lagi dalam ${seconds} detik.`;
  }
  if (now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return null;
  }
  return null;
}
function noteLoginFailure(key) {
  const now = Date.now();
  let entry = loginAttempts.get(key);
  if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
    entry = { firstAt: now, count: 0, blockedUntil: 0 };
  }
  entry.count += 1;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) entry.blockedUntil = now + LOGIN_BLOCK_MS;
  loginAttempts.set(key, entry);
}
function clearLoginFailures(key) {
  loginAttempts.delete(key);
}
// Bersihkan entries basi secara berkala.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of loginAttempts) {
    if (now - v.firstAt > LOGIN_WINDOW_MS && (!v.blockedUntil || v.blockedUntil < now)) {
      loginAttempts.delete(k);
    }
  }
}, 5 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);

app.use((req, res, next) => {
  // CORS whitelist (m10)
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
});

app.use(express.json({ limit: "1mb" }));

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function fail(res, status, error) {
  return res.status(status).json({ error });
}

/** Error penolakan otorisasi → 403. */
function authz(message) {
  return { error: message || "Akses ditolak.", status: 403 };
}
/** Error konflik data (duplikat / masih dipakai) → 409. */
function conflict(message) {
  return { error: message, status: 409 };
}

/** Validator boleh mengembalikan string (400) atau objek { error, status }. */
function validationResult(res, result) {
  if (!result) return false;
  if (typeof result === "string") {
    fail(res, 400, result);
    return true;
  }
  fail(res, result.status ?? 400, result.error ?? "Permintaan tidak valid.");
  return true;
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, tv: user.token_version ?? 0 }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

function authRequired(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.toLowerCase().startsWith("bearer ")) {
    return fail(res, 401, "Sesi tidak ditemukan. Silakan masuk kembali.");
  }
  try {
    const payload = jwt.verify(h.slice(7), JWT_SECRET);
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub);
    if (!row) return fail(res, 401, "Akun tidak ditemukan.");
    if (!row.is_active) return fail(res, 403, "Akun Anda sedang dinonaktifkan. Hubungi Admin.");
    // token_version: incremented saat logout / ganti password → token lama mati (M6)
    if ((payload.tv ?? 0) !== (row.token_version ?? 0)) {
      return fail(res, 401, "Sesi Anda telah berakhir. Silakan masuk kembali.");
    }
    const user = mapUser(row);
    req.user = user;
    next();
  } catch {
    return fail(res, 401, "Sesi kedaluwarsa. Silakan masuk kembali.");
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return fail(res, 403, "Akses ditolak.");
    next();
  };
}

function myStudentIds(supervisorId) {
  return db
    .prepare("SELECT student_id FROM placements WHERE supervisor_id = ?")
    .all(supervisorId)
    .map((r) => r.student_id);
}
function canSeeStudent(viewer, studentId) {
  if (viewer.role === "admin") return true;
  if (viewer.role === "siswa") return viewer.id === studentId;
  return myStudentIds(viewer.id).includes(studentId);
}
function canWriteStudent(viewer, studentId) {
  if (viewer.role === "admin") return true;
  if (viewer.role === "pembimbing") return myStudentIds(viewer.id).includes(studentId);
  return false;
}

// ---------------------------------------------------------------------------
// Seed admin
// ---------------------------------------------------------------------------

(function seed() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count === 0) {
    const email = (process.env.SEED_ADMIN_EMAIL || "admin@pkl.local").toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
    const issue = passwordProblem(password);
    if (issue) {
      console.error(`[pkl-server] FATAL: SEED_ADMIN_PASSWORD tidak valid (${issue})`);
      process.exit(1);
    }
    db.prepare(
      `INSERT INTO users (id, role, full_name, email, password_hash, is_active, must_change_password, token_version, created_at, updated_at)
       VALUES (?,?,?,?,?,1,0,0,?,?)`,
    ).run(uid(), "admin", "Administrator", email, bcrypt.hashSync(password, 10), nowISO(), nowISO());
    console.log(`[seed] admin dibuat: ${email}`);
  }
})();

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

app.post("/api/auth/login", (req, res) => {
  const identity = String(req.body?.identity ?? "").trim();
  const password = String(req.body?.password ?? "");
  if (!identity || !password) {
    return fail(res, 400, "NISN/email dan kata sandi wajib diisi.");
  }

  const rateKey = loginRateKey(req, identity);
  const blocked = checkLoginRate(rateKey);
  if (blocked) return fail(res, 429, blocked);

  let userRow = null;
  if (NISN_RE.test(identity)) {
    const sp = db.prepare("SELECT profile_id FROM siswa_profiles WHERE nisn = ?").get(identity);
    if (sp) userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(sp.profile_id);
  }
  if (!userRow) {
    userRow = db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(identity);
  }

  if (!userRow || !bcrypt.compareSync(password, userRow.password_hash)) {
    noteLoginFailure(rateKey);
    return fail(res, 401, "NISN/email atau kata sandi salah.");
  }
  if (!userRow.is_active) {
    noteLoginFailure(rateKey);
    return fail(res, 403, "Akun Anda sedang dinonaktifkan. Hubungi Admin.");
  }

  clearLoginFailures(rateKey);
  const user = mapUser(userRow);
  const detail =
    user.role === "siswa"
      ? db.prepare("SELECT * FROM siswa_profiles WHERE profile_id = ?").get(user.id) || null
      : user.role === "pembimbing"
        ? db.prepare("SELECT * FROM pembimbing_profiles WHERE profile_id = ?").get(user.id) || null
        : null;
  // token_version sengaja tidak ikut dikembalikan ke klien.
  return res.json({ token: signToken({ ...user, token_version: userRow.token_version ?? 0 }), user, detail });
});

app.post("/api/auth/logout", authRequired, (req, res) => {
  // Menaikkan token_version membuat semua token lama tidak berlaku lagi (M6).
  db.prepare("UPDATE users SET token_version = token_version + 1, updated_at = ? WHERE id = ?").run(
    nowISO(),
    req.user.id,
  );
  res.json({ ok: true });
});

app.get("/api/me", authRequired, (req, res) => {
  const detail =
    req.user.role === "siswa"
      ? db.prepare("SELECT * FROM siswa_profiles WHERE profile_id = ?").get(req.user.id) || null
      : req.user.role === "pembimbing"
        ? db.prepare("SELECT * FROM pembimbing_profiles WHERE profile_id = ?").get(req.user.id) || null
        : null;
  res.json({ user: req.user, detail });
});

app.put("/api/me/password", authRequired, (req, res) => {
  const password = String(req.body?.password ?? "");
  const issue = password ? passwordProblem(password) : "Kata sandi wajib diisi.";
  if (issue) return fail(res, 400, issue);
  const expected = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user.id);
  if (bcrypt.compareSync(password, expected.password_hash)) {
    return fail(res, 400, "Kata sandi baru harus berbeda dari kata sandi lama.");
  }
  db.prepare(
    `UPDATE users SET password_hash = ?, must_change_password = 0,
     token_version = token_version + 1, updated_at = ? WHERE id = ?`,
  ).run(bcrypt.hashSync(password, 10), nowISO(), req.user.id);
  res.json({ ok: true, reauth: true });
});

app.put("/api/me", authRequired, (req, res) => {
  const b = req.body ?? {};
  db.prepare("UPDATE users SET full_name = COALESCE(?, full_name), phone = ?, address = ?, updated_at = ? WHERE id = ?").run(
    typeof b.full_name === "string" && b.full_name.trim() ? b.full_name.trim() : null,
    b.phone ?? null,
    b.address ?? null,
    nowISO(),
    req.user.id,
  );
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

app.get("/api/users", authRequired, (req, res) => {
  const role = req.query.role;
  let rows;
  if (role) {
    // (B5) Students may only enumerate students; supervisors only students they supervise.
    if (req.user.role === "siswa") {
      if (role !== "siswa") return fail(res, 403, "Akses ditolak.");
      rows = db.prepare("SELECT * FROM users WHERE role = 'siswa' AND id = ?").all(req.user.id);
    } else if (req.user.role === "pembimbing") {
      if (role !== "siswa") return fail(res, 403, "Akses ditolak.");
      const ids = myStudentIds(req.user.id);
      if (ids.length === 0) rows = [];
      else {
        const marks = ids.map(() => "?").join(",");
        rows = db
          .prepare(`SELECT * FROM users WHERE role = 'siswa' AND id IN (${marks}) ORDER BY full_name`)
          .all(...ids);
      }
    } else {
      if (!["admin", "pembimbing", "siswa"].includes(String(role))) return fail(res, 400, "Peran tidak valid.");
      rows = db.prepare("SELECT * FROM users WHERE role = ? ORDER BY full_name").all(role);
    }
  } else if (req.user.role === "pembimbing") {
    const ids = myStudentIds(req.user.id);
    if (ids.length === 0) rows = [];
    else {
      const marks = ids.map(() => "?").join(",");
      rows = db.prepare(`SELECT * FROM users WHERE id IN (${marks}) ORDER BY full_name`).all(...ids);
    }
  } else if (req.user.role === "siswa") {
    rows = db.prepare("SELECT * FROM users WHERE id = ?").all(req.user.id);
  } else {
    rows = db.prepare("SELECT * FROM users ORDER BY full_name").all();
  }
  res.json(rows.map(mapUser));
});

app.get("/api/siswa-details", authRequired, (req, res) => {
  let rows = db.prepare("SELECT * FROM siswa_profiles").all();
  if (req.user.role === "pembimbing") {
    const ids = new Set(myStudentIds(req.user.id));
    rows = rows.filter((r) => ids.has(r.profile_id));
  } else if (req.user.role === "siswa") {
    rows = rows.filter((r) => r.profile_id === req.user.id);
  }
  res.json(rows);
});

app.get("/api/pembimbing-details", authRequired, (req, res) => {
  let rows = db.prepare("SELECT * FROM pembimbing_profiles").all();
  if (req.user.role === "siswa") rows = rows.filter((r) => r.profile_id === req.user.id);
  res.json(rows);
});

app.post("/api/users", authRequired, (req, res) => {
  const isPembimbing = req.user.role === "pembimbing";
  if (req.user.role !== "admin" && !isPembimbing) return fail(res, 403, "Akses ditolak.");
  const b = req.body ?? {};

  // Pembimbing hanya boleh membuat akun siswa (M10: penolakan eksplisit, bukan diam-diam).
  if (isPembimbing && b.role && b.role !== "siswa") {
    return fail(res, 403, "Pembimbing hanya dapat membuat akun siswa.");
  }
  const role = isPembimbing ? "siswa" : b.role;
  if (!["siswa", "pembimbing"].includes(role)) return fail(res, 400, "Peran akun tidak valid.");

  const fullName = String(b.full_name ?? "").trim();
  if (!fullName) return fail(res, 400, "Nama lengkap wajib diisi.");

  let nisn = null;
  if (role === "siswa") {
    nisn = String(b.nisn ?? "").trim();
    if (!nisn) return fail(res, 400, "NISN wajib diisi untuk akun siswa.");
    if (!NISN_RE.test(nisn)) {
      return fail(res, 400, "NISN harus terdiri dari tepat 10 digit angka.");
    }
    if (db.prepare("SELECT profile_id FROM siswa_profiles WHERE nisn = ?").get(nisn)) {
      return fail(res, 409, "NISN sudah digunakan oleh akun lain.");
    }
  }

  const email = (b.email ? String(b.email).trim().toLowerCase() : `${nisn}@siswa.pkl.sch.id`);
  if (!email || !email.includes("@")) return fail(res, 400, "Email tidak valid.");
  if (db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").get(email)) {
    return fail(res, 409, "Email sudah digunakan oleh akun lain.");
  }

  // (M10) Pesan error yang benar untuk NISN tidak valid — password default = NISN.
  const password = b.password ? String(b.password) : role === "siswa" ? nisn : "";
  if (!password) return fail(res, 400, "Kata sandi wajib diisi.");
  const issue = passwordProblem(password, role === "siswa");
  if (issue) return fail(res, 400, issue);

  const id = uid();
  const hash = bcrypt.hashSync(password, 10);
  const createdAt = nowISO();

  const createUser = db.transaction(() => {
    db.prepare(
      `INSERT INTO users (id, role, full_name, email, password_hash, phone, address, is_active, must_change_password, token_version, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,1,?,0,?,?)`,
    ).run(
      id,
      role,
      fullName,
      email,
      hash,
      b.phone || null,
      b.address || null,
      role === "siswa" ? 1 : 0,
      createdAt,
      createdAt,
    );
    if (role === "siswa") {
      db.prepare("INSERT INTO siswa_profiles (profile_id, nis, nisn, class_name, major) VALUES (?,?,?,?,?)").run(
        id,
        b.nis || null,
        nisn,
        b.class_name || null,
        b.major || null,
      );
    } else {
      db.prepare("INSERT INTO pembimbing_profiles (profile_id, nip, department) VALUES (?,?,?)").run(
        id,
        b.nip || null,
        b.department || null,
      );
    }
  });
  createUser();

  let warning;
  const companyId = b.company_id || null;
  const periodId = b.period_id || null;
  if (companyId || periodId) {
    if (!companyId || !periodId) {
      warning = "Akun dibuat, tetapi penempatan belum lengkap (perusahaan & periode wajib).";
    } else {
      const supervisorId = isPembimbing ? req.user.id : b.supervisor_id || null;
      const insertPlacement = db.prepare(
        `INSERT INTO placements (id, student_id, company_id, supervisor_id, period_id, start_date, end_date, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,'aktif',?,?)`,
      );
      try {
        insertPlacement.run(
          uid(),
          id,
          companyId,
          supervisorId,
          periodId,
          b.start_date || null,
          b.end_date || null,
          createdAt,
          createdAt,
        );
      } catch (err) {
        if (isSqliteUnique(err, "uq_placement_aktif")) {
          return fail(res, 409, "Siswa sudah memiliki penempatan aktif pada periode tersebut.");
        }
        throw err;
      }
    }
  }
  return res.json({ user_id: id, warning });
});

app.put("/api/users/:id", authRequired, (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!target) return fail(res, 404, "Akun tidak ditemukan.");
  const b = req.body ?? {};
  const isSelf = req.user.id === target.id;

  if (!isSelf && req.user.role !== "admin") return fail(res, 403, "Akses ditolak.");
  if (isSelf && req.user.role !== "admin") {
    const forbidden = ["email", "password", "role", "nis", "nisn", "class_name", "major", "is_active"];
    if (forbidden.some((f) => f in b)) {
      return fail(res, 403, "Hanya nama, telepon, dan alamat yang dapat diubah sendiri.");
    }
  }
  if ("email" in b && b.email) {
    const clash = db
      .prepare("SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?")
      .get(String(b.email), target.id);
    if (clash) return fail(res, 409, "Email sudah digunakan oleh akun lain.");
  }
  if ("password" in b && b.password) {
    const issue = passwordProblem(String(b.password));
    if (issue) return fail(res, 400, issue);
  }
  if ("nisn" in b && b.nisn) {
    if (!NISN_RE.test(String(b.nisn))) return fail(res, 400, "NISN harus terdiri dari tepat 10 digit angka.");
    const clash = db.prepare("SELECT profile_id FROM siswa_profiles WHERE nisn = ? AND profile_id != ?").get(String(b.nisn), target.id);
    if (clash) return fail(res, 409, "NISN sudah digunakan oleh akun lain.");
  }

  const apply = db.transaction(() => {
    if (b.password) {
      db.prepare(
        `UPDATE users SET password_hash = ?, must_change_password = ?,
         token_version = token_version + 1, updated_at = ? WHERE id = ?`,
      ).run(bcrypt.hashSync(String(b.password), 10), b.must_change_password ? 1 : 0, nowISO(), target.id);
    } else {
      db.prepare(
        "UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email), phone = ?, address = ?, updated_at = ? WHERE id = ?",
      ).run(
        typeof b.full_name === "string" && b.full_name.trim() ? b.full_name.trim() : null,
        b.email ? String(b.email).toLowerCase() : null,
        "phone" in b ? b.phone : target.phone,
        "address" in b ? b.address : target.address,
        nowISO(),
        target.id,
      );
    }
    if (target.role === "siswa") {
      db.prepare(
        "UPDATE siswa_profiles SET nis = COALESCE(?, nis), nisn = COALESCE(?, nisn), class_name = COALESCE(?, class_name), major = COALESCE(?, major) WHERE profile_id = ?",
      ).run(
        "nis" in b ? b.nis : null,
        "nisn" in b ? b.nisn : null,
        "class_name" in b ? b.class_name : null,
        "major" in b ? b.major : null,
        target.id,
      );
    }
  });
  apply();
  res.json({ ok: true });
});

app.post("/api/users/:id/reset-password", authRequired, requireRole("admin"), (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!target) return fail(res, 404, "Akun tidak ditemukan.");
  const password = String(req.body?.password ?? "");
  const issue = password ? passwordProblem(password, true) : "Kata sandi wajib diisi.";
  if (issue) return fail(res, 400, issue);
  db.prepare(
    `UPDATE users SET password_hash = ?, must_change_password = 1,
     token_version = token_version + 1, updated_at = ? WHERE id = ?`,
  ).run(bcrypt.hashSync(password, 10), nowISO(), target.id);
  res.json({ ok: true });
});

app.post("/api/users/:id/active", authRequired, requireRole("admin"), (req, res) => {
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!target) return fail(res, 404, "Akun tidak ditemukan.");
  // (B4) Melarang admin menonaktifkan akunnya sendiri supaya tidak terkunci permanen.
  if (target.id === req.user.id) {
    return fail(res, 400, "Anda tidak dapat menonaktifkan akun Anda sendiri.");
  }
  if (target.role === "admin") {
    const adminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_active = 1").get().c;
    if (adminCount <= 1) return fail(res, 400, "Minimal harus ada satu akun admin yang aktif.");
  }
  db.prepare("UPDATE users SET is_active = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?").run(
    toBool(req.body?.is_active),
    nowISO(),
    target.id,
  );
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Error mapping helpers (M1)
// ---------------------------------------------------------------------------

function isSqliteUnique(err, indexName) {
  const msg = String(err?.message ?? "");
  if (!/UNIQUE constraint failed/i.test(msg)) return false;
  if (indexName) return msg.includes(indexName);
  return true;
}

const SQLITE_MESSAGES = [
  [/holidays\.date/i, "Tanggal hari libur sudah terdaftar."],
  [/attendance\.student_id, attendance\.date/i, "Presensi untuk siswa pada tanggal tersebut sudah ada."],
  [/uq_placement_aktif/i, "Siswa sudah memiliki penempatan aktif pada periode tersebut."],
  [/uq_assessment_student_period|assessments\.student_id, assessments/i, "Penilaian untuk siswa pada periode tersebut sudah ada."],
  [/journals\.student_id, journals\.date/i, "Jurnal untuk tanggal tersebut sudah ada."],
  [/users\.email/i, "Email sudah digunakan oleh akun lain."],
  [/siswa_profiles\.nisn/i, "NISN sudah digunakan oleh akun lain."],
  [/FOREIGN KEY constraint failed/i, "Data masih digunakan oleh data lain sehingga tidak bisa dihapus."],
  [/CHECK constraint failed: placements\.status/i, "Status penempatan tidak valid."],
  [/CHECK constraint failed: attendance\.status/i, "Status presensi tidak valid."],
  [/CHECK constraint failed: leave_requests\.type/i, "Jenis pengajuan harus Izin, Sakit, atau Cuti."],
  [/CHECK constraint failed: leave_requests\.status/i, "Status pengajuan tidak valid."],
  [/CHECK constraint failed: journals\.review_status/i, "Status tinjauan tidak valid."],
  [/CHECK constraint failed: assessments\.predicate/i, "Predikat harus A, B, C, atau D."],
  [/NOT NULL constraint failed: companies\.name/i, "Nama perusahaan wajib diisi."],
  [/NOT NULL constraint failed: companies\.is_active/i, "Status aktif perusahaan wajib diisi."],
  [/NOT NULL constraint failed: pkl_periods\.name/i, "Nama periode wajib diisi."],
  [/NOT NULL constraint failed: pkl_periods\.academic_year/i, "Tahun ajaran wajib diisi."],
  [/NOT NULL constraint failed: pkl_periods\.start_date/i, "Tanggal mulai wajib diisi."],
  [/NOT NULL constraint failed: pkl_periods\.end_date/i, "Tanggal selesai wajib diisi."],
  [/NOT NULL constraint failed: pkl_periods\.is_active/i, "Status aktif periode wajib diisi."],
  [/NOT NULL constraint failed: holidays\.date/i, "Tanggal hari libur wajib diisi."],
  [/NOT NULL constraint failed: holidays\.name/i, "Nama hari libur wajib diisi."],
  [/NOT NULL constraint failed: attendance\.student_id/i, "Siswa pada presensi wajib diisi."],
  [/NOT NULL constraint failed: journals\.student_id/i, "Siswa pada jurnal wajib diisi."],
  [/NOT NULL constraint failed: journals\.date/i, "Tanggal jurnal wajib diisi."],
  [/NOT NULL constraint failed: journals\.title/i, "Judul jurnal wajib diisi."],
  [/NOT NULL constraint failed: leave_requests\.student_id/i, "Siswa pada pengajuan wajib diisi."],
  [/NOT NULL constraint failed: leave_requests\.reason/i, "Alasan pengajuan wajib diisi."],
  [/NOT NULL constraint failed: leave_requests\.status/i, "Status pengajuan wajib diisi."],
  [/NOT NULL constraint failed: announcements\.title/i, "Judul pengumuman wajib diisi."],
  [/NOT NULL constraint failed: announcements\.body/i, "Isi pengumuman wajib diisi."],
  [/NOT NULL constraint failed: announcements\.audience/i, "Target pengumuman wajib diisi."],
  [/NOT NULL constraint failed: placements\.student_id/i, "Siswa pada penempatan wajib diisi."],
];

function sqliteErrorToMessage(err) {
  const msg = String(err?.message ?? "");
  for (const [re, friendly] of SQLITE_MESSAGES) {
    if (re.test(msg)) return friendly;
  }
  return "Data gagal disimpan karena melanggar aturan data. Periksa kembali isian Anda.";
}

// ---------------------------------------------------------------------------
// Generic CRUD dengan otorisasi ketat (B2, B3) + partial insert (B1)
// ---------------------------------------------------------------------------

const NUMERIC_FIELDS = new Set([
  "duration_minutes",
  "score_attendance",
  "score_journal",
  "score_discipline",
  "score_competence",
  "score_attitude",
  "final_score",
  "latitude",
  "longitude",
  "check_out_latitude",
  "check_out_longitude",
]);

function coerceValue(field, value) {
  if (value === "" || value === undefined) return null;
  if (NUMERIC_FIELDS.has(field)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return NaN; // sinyal invalid ke validasi
    return n;
  }
  if (typeof value === "boolean") return value;
  return value;
}

function crud(resource, opts = {}) {
  const table = opts.sqlTable || resource;
  const boolFields = opts.bools || [];
  const hasUpdated = !opts.noUpdated;

  const sanitize = (body) => {
    const out = {};
    for (const f of opts.fields) {
      if (!(f in body)) continue;
      const v = coerceValue(f, body[f]);
      if (typeof v === "number" && Number.isNaN(v)) {
        out[f] = "__INVALID_NUMBER__";
        continue;
      }
      out[f] = boolFields.includes(f) ? (v === null ? null : toBool(v)) : v;
    }
    return out;
  };

  const hasInvalidNumber = (clean) => Object.values(clean).some((v) => v === "__INVALID_NUMBER__");

  // ------------------------------- READ -------------------------------
  app.get(`/api/${resource}`, authRequired, (req, res) => {
    let rows = db.prepare(`SELECT * FROM ${table} ORDER BY ${opts.order || "created_at DESC"}`).all();
    if (opts.scopeRead) rows = opts.scopeRead(req, rows) ?? rows;
    const q = req.query;
    if (q.student_id) rows = rows.filter((r) => r.student_id === q.student_id);
    if (q.status) rows = rows.filter((r) => r.status === q.status);
    if (q.from && opts.dateField) rows = rows.filter((r) => (r[opts.dateField] || "") >= q.from);
    if (q.to && opts.dateField) rows = rows.filter((r) => (r[opts.dateField] || "") <= q.to);

    // (m8) Pagination
    const total = rows.length;
    const limit = Math.min(Math.max(Number.parseInt(q.limit ?? "", 10) || 0, 0), 500) || 0;
    const page = Math.max(Number.parseInt(q.page ?? "", 10) || 1, 1);
    if (limit > 0) {
      const offset = (page - 1) * limit;
      rows = rows.slice(offset, offset + limit);
      res.setHeader("X-Total-Count", String(total));
      res.setHeader("X-Page", String(page));
      res.setHeader("X-Page-Size", String(limit));
      res.setHeader("X-Total-Pages", String(Math.max(1, Math.ceil(total / limit))));
    }
    res.json(rows.map((r) => (resource === "users" ? mapUser(r) : mapRow(r, boolFields))));
  });

  // ------------------------------ CREATE ------------------------------
  app.post(`/api/${resource}`, authRequired, (req, res) => {
    if (opts.createRoles && !opts.createRoles.includes(req.user.role)) {
      return fail(res, 403, opts.deniedMessage ?? "Akses ditolak.");
    }
    const b = req.body ?? {};

    // (B1) Sisipkan HANYA field yang benar-benar dikirim agar DEFAULT kolom DB berlaku.
    const clean = sanitize(b);
    if (hasInvalidNumber(clean)) return fail(res, 400, "Nilai angka tidak valid.");
    for (const field of opts.requiredOnCreate ?? []) {
      if (clean[field] === undefined) {
        return fail(res, 400, opts.requiredMessages?.[field] ?? `${field} wajib diisi.`);
      }
      if (clean[field] === null || clean[field] === "") {
        return fail(res, 400, opts.requiredMessages?.[field] ?? `${field} wajib diisi.`);
      }
    }
    if (opts.validateCreate) {
      if (validationResult(res, opts.validateCreate(req, clean, { db, now: nowISO }))) return;
    }
    // Default hanya mengisi field yang TIDAK dikirim klien; nilai eksplisit
    // tidak boleh ditimpa (kecuali stamp identitas yang memang overwrite).
    if (opts.defaultsOnCreate) Object.assign(clean, opts.defaultsOnCreate(req, clean));

    // (m3) Stempel waktu presensi dicatat server dalam WIB, bukan dari jam perangkat.
    if (opts.serverCreateTimestamps) {
      for (const f of opts.serverCreateTimestamps) {
        if (!(f in clean) || !clean[f]) clean[f] = nowISO();
      }
    }

    const id = uid();
    const cols = ["id", ...Object.keys(clean)];
    const vals = [id, ...Object.values(clean)];
    if (hasUpdated) cols.push("created_at", "updated_at");
    const ts = nowISO();
    if (hasUpdated) vals.push(ts, ts);

    const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`;
    try {
      db.prepare(sql).run(...vals);
      res.status(201).json({ id, ok: true });
    } catch (err) {
      if (isSqliteUnique(err)) return fail(res, 409, sqliteErrorToMessage(err));
      console.error(`[crud:create:${resource}]`, err.message);
      return fail(res, 400, sqliteErrorToMessage(err));
    }
  });

  // ------------------------------ UPDATE ------------------------------
  app.put(`/api/${resource}/:id`, authRequired, (req, res) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    // (B2) Selalu cek keberadaan + otorisasi; tidak dilewati Whatever konfigurasi.
    if (!row) return fail(res, 404, "Data tidak ditemukan.");
    if (opts.canUpdate) {
      const verdict = opts.canUpdate(req, row);
      if (verdict !== true) return fail(res, 403, verdict || "Akses ditolak.");
    } else {
      return fail(res, 403, "Akses ditolak.");
    }

    const clean = sanitize(req.body ?? {});
    if (hasInvalidNumber(clean)) return fail(res, 400, "Nilai angka tidak valid.");
    if (!Object.keys(clean).length) return res.json({ ok: true });
    if (opts.validateUpdate) {
      if (validationResult(res, opts.validateUpdate(req, row, clean, { db, now: nowISO }))) return;
    }
    // (m3) Presensi keluar dicatat otomatis oleh server bila klien mengirim flag.
    if (opts.serverUpdateTimestamps) {
      for (const f of opts.serverUpdateTimestamps) {
        if (f in clean && (clean[f] === true || clean[f] === "now" || clean[f] === null || clean[f] === "")) {
          clean[f] = nowISO();
        }
      }
    }
    const sets = Object.keys(clean).map((f) => `${f} = ?`).join(", ");
    const vals = Object.values(clean);
    const sql = hasUpdated
      ? `UPDATE ${table} SET ${sets}, updated_at = ? WHERE id = ?`
      : `UPDATE ${table} SET ${sets} WHERE id = ?`;
    if (hasUpdated) vals.push(nowISO());
    try {
      const info = db.prepare(sql).run(...vals, req.params.id);
      if (info.changes === 0) return fail(res, 404, "Data tidak ditemukan.");
      cleanupReplacedFiles(table, row, clean);
      res.json({ ok: true });
    } catch (err) {
      if (isSqliteUnique(err)) return fail(res, 409, sqliteErrorToMessage(err));
      console.error(`[crud:update:${resource}]`, err.message);
      return fail(res, 400, sqliteErrorToMessage(err));
    }
  });

  // ------------------------------ DELETE ------------------------------
  app.delete(`/api/${resource}/:id`, authRequired, (req, res) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    // (B3) Default-nya TOLAK. Otorisasi harus eksplisit di opts.canDelete.
    if (!row) return fail(res, 404, "Data tidak ditemukan.");
    if (opts.canDelete) {
      const verdict = opts.canDelete(req, row);
      if (verdict !== true) return fail(res, 403, verdict || "Akses ditolak.");
    } else {
      return fail(res, 403, "Akses ditolak.");
    }
    if (opts.beforeDelete) {
      const err = opts.beforeDelete(req, row, { db });
      if (err) return fail(res, 409, typeof err === "string" ? err : err.error);
    }
    try {
      const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
      if (info.changes === 0) return fail(res, 404, "Data tidak ditemukan.");
      cleanupRowFiles(table, row);
      res.json({ ok: true });
    } catch (err) {
      if (/FOREIGN KEY constraint failed/i.test(String(err?.message))) {
        return fail(res, 409, "Data masih digunakan oleh data lain sehingga tidak bisa dihapus.");
      }
      console.error(`[crud:delete:${resource}]`, err.message);
      return fail(res, 400, sqliteErrorToMessage(err));
    }
  });
}

const adminOnly = { canUpdate: (req) => req.user.role === "admin" || "Akses ditolak.", canDelete: (req) => req.user.role === "admin" || "Akses ditolak." };

// ---------------------------------------------------------------------------
// Orphan file cleanup — file lama yang tertimpa/terhapus dari DB ikut dibuang
// dari disk agar uploads/ tidak tumbuh selamanya. Tidak pernah menggagalkan
// request (hanya log).
// ---------------------------------------------------------------------------

/** Kolom path file per tabel (nama kolom TEXT path `siswa/<id>/<folder>/<file>`). */
const FILE_PATH_FIELDS = {
  attendance: ["photo_path", "check_out_photo_path"],
  journals: ["attachment_path"],
  leave_requests: ["attachment_path"],
};

/** Hapus file bila tidak direferensikan baris mana pun. */
function removeOrphanFile(rel) {
  try {
    if (typeof rel !== "string" || !rel) return;
    if (!/^siswa\/[0-9a-f-]{36}\/[a-z]+\/[A-Za-z0-9._-]+$/.test(rel)) return;
    const abs = path.join(UPLOAD_DIR, rel);
    if (!abs.startsWith(UPLOAD_DIR + path.sep)) return;
    if (!fs.existsSync(abs)) return;
    const refs = [
      ["attendance", "photo_path"],
      ["attendance", "check_out_photo_path"],
      ["journals", "attachment_path"],
      ["leave_requests", "attachment_path"],
      ["users", "avatar_url"],
    ];
    for (const [table, col] of refs) {
      if (db.prepare(`SELECT 1 FROM ${table} WHERE ${col} = ? LIMIT 1`).get(rel)) return;
    }
    fs.unlinkSync(abs);
    // Rapikan folder yang kosong (abaikan bila gagal).
    try {
      const dir = path.dirname(abs);
      if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    } catch {
      /* abaikan */
    }
  } catch (err) {
    console.error("[orphan-cleanup]", err?.message ?? err);
  }
}

/** Buang file lama yang tertimpa nilai baru pada UPDATE. */
function cleanupReplacedFiles(table, previous, clean) {
  try {
    const fields = FILE_PATH_FIELDS[table] ?? [];
    for (const f of fields) {
      if (f in clean && previous[f] && clean[f] !== previous[f]) removeOrphanFile(previous[f]);
    }
  } catch (err) {
    console.error("[orphan-cleanup]", err?.message ?? err);
  }
}

/** Buang semua file milik baris yang di-DELETE. */
function cleanupRowFiles(table, row) {
  try {
    const fields = FILE_PATH_FIELDS[table] ?? [];
    for (const f of fields) {
      if (row[f]) removeOrphanFile(row[f]);
    }
  } catch (err) {
    console.error("[orphan-cleanup]", err?.message ?? err);
  }
}

// ---------------------------- companies ----------------------------
crud("companies", {
  fields: ["name", "address", "field_of_work", "contact_person", "contact_phone", "contact_email", "notes", "is_active"],
  bools: ["is_active"],
  order: "name",
  createRoles: ["admin"],
  requiredOnCreate: ["name"],
  requiredMessages: { name: "Nama perusahaan wajib diisi." },
  validateCreate: (req, clean) => {
    const name = String(clean.name ?? "").trim();
    if (!name) return "Nama perusahaan wajib diisi.";
    if (name.length > 150) return "Nama perusahaan maksimal 150 karakter.";
    const dup = db
      .prepare("SELECT id FROM companies WHERE lower(name) = lower(?)")
      .get(name);
    if (dup) return "Perusahaan dengan nama tersebut sudah ada.";
    return null;
  },
  validateUpdate: (req, row, clean) => {
    if ("name" in clean) {
      const name = String(clean.name ?? "").trim();
      if (!name) return "Nama perusahaan wajib diisi.";
      const dup = db
        .prepare("SELECT id FROM companies WHERE lower(name) = lower(?) AND id != ?")
        .get(name, row.id);
      if (dup) return "Perusahaan dengan nama tersebut sudah ada.";
    }
    return null;
  },
  canUpdate: adminOnly.canUpdate,
  canDelete: adminOnly.canDelete,
  beforeDelete: (req, row, { db }) => {
    const used = db.prepare("SELECT COUNT(*) AS c FROM placements WHERE company_id = ?").get(row.id).c;
    return used > 0 ? "Perusahaan masih digunakan pada penempatan siswa." : null;
  },
});

// ---------------------------- periods ----------------------------
crud("periods", {
  sqlTable: "pkl_periods",
  fields: ["name", "academic_year", "start_date", "end_date", "is_active"],
  bools: ["is_active"],
  order: "start_date DESC",
  createRoles: ["admin"],
  requiredOnCreate: ["name", "academic_year", "start_date", "end_date", "is_active"],
  requiredMessages: {
    name: "Nama periode wajib diisi.",
    academic_year: "Tahun ajaran wajib diisi.",
    start_date: "Tanggal mulai wajib diisi.",
    end_date: "Tanggal selesai wajib diisi.",
    is_active: "Status aktif periode wajib diisi.",
  },
  defaultsOnCreate: (req, clean) => ("is_active" in clean ? {} : { is_active: 0 }),
  validateCreate: (req, clean) => crudPeriodValidator(clean),
  validateUpdate: (req, row, clean) => {
    const merged = { ...clean };
    if ("start_date" in clean) merged.start_date = clean.start_date;
    else merged.start_date = row.start_date;
    if ("end_date" in clean) merged.end_date = clean.end_date;
    else merged.end_date = row.end_date;
    return crudPeriodValidator(merged);
  },
  canUpdate: (req, row, clean) => {
    if (req.user.role !== "admin") return "Akses ditolak.";
    return true;
  },
  canDelete: (req, row, { db }) => {
    if (req.user.role !== "admin") return "Akses ditolak.";
    const used = db.prepare("SELECT COUNT(*) AS c FROM placements WHERE period_id = ?").get(row.id).c;
    return used > 0 ? "Periode masih digunakan pada penempatan siswa." : true;
  },
});
function crudPeriodValidator(clean) {
  if ("start_date" in clean && clean.start_date && !isValidDate(clean.start_date)) {
    return "Tanggal mulai tidak valid (format YYYY-MM-DD).";
  }
  if ("end_date" in clean && clean.end_date && !isValidDate(clean.end_date)) {
    return "Tanggal selesai tidak valid (format YYYY-MM-DD).";
  }
  if (clean.start_date && clean.end_date && isValidDate(clean.start_date) && isValidDate(clean.end_date) && clean.end_date < clean.start_date) {
    return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
  }
  return null;
}

// ---------------------------- holidays ----------------------------
crud("holidays", {
  fields: ["date", "name"],
  order: "date",
  noUpdated: true,
  createRoles: ["admin"],
  requiredOnCreate: ["date", "name"],
  requiredMessages: { date: "Tanggal hari libur wajib diisi.", name: "Nama hari libur wajib diisi." },
  validateCreate: (req, clean) => crudHolidayValidator(clean),
  validateUpdate: (req, row, clean) => crudHolidayValidator(clean),
  canUpdate: adminOnly.canUpdate,
  canDelete: adminOnly.canDelete,
});
function crudHolidayValidator(clean) {
  if (!isValidDate(clean.date)) return "Tanggal hari libur tidak valid (format YYYY-MM-DD).";
  if (!String(clean.name ?? "").trim()) return "Nama hari libur wajib diisi.";
  return null;
}

// ---------------------------- announcements ----------------------------
crud("announcements", {
  fields: ["title", "body", "audience", "is_published", "created_by", "created_by_name"],
  bools: ["is_published"],
  order: "created_at DESC",
  createRoles: ["admin", "pembimbing"],
  deniedMessage: "Hanya admin dan pembimbing yang dapat membuat pengumuman.",
  requiredOnCreate: ["title", "body", "audience", "is_published"],
  requiredMessages: {
    title: "Judul pengumuman wajib diisi.",
    body: "Isi pengumuman wajib diisi.",
    audience: "Target pengumuman wajib diisi.",
    is_published: "Status publikasi wajib diisi.",
  },
  defaultsOnCreate: (req, clean) => ({
    ...("is_published" in clean ? {} : { is_published: 1 }),
    created_by: req.user.id,
    created_by_name: req.user.full_name,
  }),
  // (B6) Scope baca per audience.
  scopeRead: (req, rows) => {
    if (req.user.role === "siswa") return rows.filter((a) => a.audience === "semua" || a.audience === "siswa");
    if (req.user.role === "pembimbing") return rows.filter((a) => a.audience === "semua" || a.audience === "pembimbing");
    return rows;
  },
  validateCreate: (req, clean) => crudAnnouncementValidator(clean),
  validateUpdate: (req, row, clean) => crudAnnouncementValidator(clean),
  canUpdate: (req, row) => (req.user.role === "admin" || row.created_by === req.user.id ? true : "Anda hanya dapat mengubah pengumuman Anda sendiri."),
  canDelete: (req, row) => (req.user.role === "admin" || row.created_by === req.user.id ? true : "Anda hanya dapat menghapus pengumuman Anda sendiri."),
});
function crudAnnouncementValidator(clean) {
  if (clean.title !== undefined && !String(clean.title).trim()) return "Judul pengumuman wajib diisi.";
  if (clean.body !== undefined && !String(clean.body).trim()) return "Isi pengumuman wajib diisi.";
  if (clean.audience !== undefined && !["semua", "pembimbing", "siswa"].includes(clean.audience)) return "Target pengumuman tidak valid.";
  return null;
}

// ---------------------------- placements ----------------------------
crud("placements", {
  fields: ["student_id", "company_id", "supervisor_id", "period_id", "start_date", "end_date", "status", "notes"],
  order: "created_at DESC",
  createRoles: ["admin"],
  requiredOnCreate: ["student_id", "company_id", "period_id", "status"],
  requiredMessages: {
    student_id: "Siswa wajib dipilih.",
    company_id: "Perusahaan wajib dipilih.",
    period_id: "Periode PKL wajib dipilih.",
    status: "Status penempatan wajib diisi.",
  },
  defaultsOnCreate: (req, clean) => ("status" in clean ? {} : { status: "draft" }),
  // (M8) Cegah yatim & duplikat aktif.
  validateCreate: (req, clean) => crudPlacementValidator(req, clean, null),
  validateUpdate: (req, row, clean) => crudPlacementValidator(req, clean, row),
  scopeRead: (req, rows) => {
    if (req.user.role === "pembimbing") return rows.filter((r) => r.supervisor_id === req.user.id);
    if (req.user.role === "siswa") return rows.filter((r) => r.student_id === req.user.id);
    return rows;
  },
  canUpdate: (req, row) => (req.user.role === "admin" ? true : "Hanya admin yang dapat mengubah penempatan."),
  canDelete: (req, row) => (req.user.role === "admin" ? true : "Hanya admin yang dapat menghapus penempatan."),
  beforeDelete: (req, row, { db }) => {
    const att = db.prepare("SELECT COUNT(*) AS c FROM attendance WHERE student_id = ?").get(row.student_id).c;
    return att > 0 ? "Siswa sudah memiliki data presensi sehingga penempatan tidak bisa dihapus." : null;
  },
});
function crudPlacementValidator(req, clean, existing) {
  if (clean.student_id && !isUuid(clean.student_id)) return "Siswa tidak valid.";
  if (clean.company_id && !isUuid(clean.company_id)) return "Perusahaan tidak valid.";
  if (clean.period_id && !isUuid(clean.period_id)) return "Periode tidak valid.";
  if (clean.supervisor_id && !isUuid(clean.supervisor_id)) return "Pembimbing tidak valid.";
  if (clean.start_date && !isValidDate(clean.start_date)) return "Tanggal mulai tidak valid (format YYYY-MM-DD).";
  if (clean.end_date && !isValidDate(clean.end_date)) return "Tanggal selesai tidak valid (format YYYY-MM-DD).";
  if (clean.start_date && clean.end_date && clean.end_date < clean.start_date) {
    return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
  }
  if (clean.status && !["draft", "aktif", "selesai", "dibatalkan"].includes(clean.status)) {
    return "Status penempatan tidak valid.";
  }
  const studentId = clean.student_id ?? existing?.student_id;
  const periodId = clean.period_id ?? existing?.period_id;
  const status = clean.status ?? existing?.status ?? "draft";
  const companyId = clean.company_id ?? existing?.company_id;
  if (status === "aktif" && (!companyId || !periodId)) {
    return "Penempatan aktif wajib memilih perusahaan dan periode.";
  }
  if (status === "aktif" && studentId && periodId && "period_id" in clean) {
    const dup = db
      .prepare("SELECT id FROM placements WHERE student_id = ? AND period_id = ? AND status = 'aktif' AND id != ?")
      .get(studentId, periodId, existing?.id ?? "");
    if (dup) return conflict("Siswa sudah memiliki penempatan aktif pada periode tersebut.");
  }
  return null;
}

// ---------------------------- attendance ----------------------------
crud("attendance", {
  fields: [
    "student_id", "date", "check_in_time", "check_out_time", "status", "note",
    "photo_path", "photo_name", "latitude", "longitude", "address", "captured_at",
    "check_out_photo_path", "check_out_photo_name", "check_out_latitude", "check_out_longitude",
    "check_out_address", "check_out_captured_at", "recorded_by",
  ],
  dateField: "date",
  order: "date DESC",
  requiredOnCreate: ["student_id", "date"],
  requiredMessages: { student_id: "Siswa wajib diisi.", date: "Tanggal presensi wajib diisi." },
  defaultsOnCreate: (req, clean) => ({
    ...("status" in clean ? {} : { status: "hadir" }),
    recorded_by: req.user.id,
  }),
  scopeRead: (req, rows) => {
    if (req.user.role === "siswa") return rows.filter((r) => r.student_id === req.user.id);
    if (req.user.role === "pembimbing") {
      const ids = new Set(myStudentIds(req.user.id));
      return rows.filter((r) => ids.has(r.student_id));
    }
    return rows;
  },
  // (M3) Validasi ketat + jam server-side WIB.
  validateCreate: (req, clean) => {
    const sid = clean.student_id;
    if (!isUuid(sid)) return "Siswa tidak valid.";
    if (req.user.role === "siswa" && sid !== req.user.id) return authz("Anda hanya dapat mencatat presensi sendiri.");
    if (req.user.role === "pembimbing" && !canSeeStudent(req.user, sid)) return "Bukan siswa bimbingan Anda.";
    if (!isValidDate(clean.date)) return "Tanggal presensi tidak valid (format YYYY-MM-DD).";
    if (clean.status && !["hadir", "izin", "sakit", "alpa"].includes(clean.status)) return "Status presensi tidak valid.";
    // (presensi mandiri) Siswa hanya bisa mencatat hadir; izin/sakit wajib lewat pengajuan.
    if (req.user.role === "siswa" && clean.status && clean.status !== "hadir") {
      return authz("Presensi mandiri hanya untuk kehadiran. Izin atau sakit lewat menu pengajuan.");
    }
    if (clean.date && clean.date !== todayJakarta() && req.user.role === "siswa") {
      return "Presensi hanya dapat dicatat untuk hari ini.";
    }
    // (libur) Siswa tidak bisa presensi masuk di hari libur admin.
    // Minggu TIDAK diblokir: ada siswa yang libur, ada yang tetap piket/shift.
    // Admin/pembimbing tetap bisa (escape hatch bila benar-benar bertugas).
    if (req.user.role === "siswa" && isHolidayDate(clean.date)) {
      return "Hari libur, presensi tidak diwajibkan. Hubungi admin bila Anda benar-benar bertugas.";
    }
    if (req.user.role === "siswa" && !hasActivePlacement(sid)) {
      return "Penempatan PKL Anda belum aktif. Hubungi Admin.";
    }
    if (clean.latitude !== undefined && clean.latitude !== null && (clean.latitude < -90 || clean.latitude > 90)) {
      return "Koordinat latitude tidak valid.";
    }
    if (clean.longitude !== undefined && clean.longitude !== null && (clean.longitude < -180 || clean.longitude > 180)) {
      return "Koordinat longitude tidak valid.";
    }
    if (clean.check_out_time && !clean.check_in_time) {
      return "Presensi keluar tidak dapat tercatat sebelum presensi masuk.";
    }
    return null;
  },
  // (m3) Waktu dicatat server dalam WIB; klien tidak boleh menentukan jam.
  serverCreateTimestamps: ["check_in_time"],
  canUpdate: (req, row) => {
    if (req.user.role === "admin") return true;
    if (req.user.role === "pembimbing") return canSeeStudent(req.user, row.student_id) ? true : "Bukan siswa bimbingan Anda.";
    return row.student_id === req.user.id ? true : "Anda hanya dapat mengubah presensi sendiri.";
  },
  canDelete: (req) => (req.user.role === "admin" ? true : "Hanya admin yang dapat menghapus presensi."),
  validateUpdate: (req, row, clean) => {
    if (req.user.role === "siswa") {
      const CHECKOUT_FIELDS = [
        "check_out_time", "check_out_photo_path", "check_out_photo_name",
        "check_out_latitude", "check_out_longitude", "check_out_address",
        "check_out_captured_at",
      ];
      const keys = Object.keys(clean);
      const onlyCheckout = keys.length > 0 && keys.every((k) => CHECKOUT_FIELDS.includes(k));
      const isToday = row.date === todayJakarta();
      // (susulan) Kemarin: hanya presensi keluar yang boleh dilengkapi.
      const isYesterdayCheckout =
        !isToday && row.date === yesterdayJakarta() && onlyCheckout && row.status === "hadir";
      if (!isToday && !isYesterdayCheckout) {
        return authz(
          row.date === yesterdayJakarta()
            ? "Untuk kemarin, hanya presensi keluar yang dapat dilengkapi."
            : "Presensi hari sebelumnya tidak dapat diubah.",
        );
      }
      if ("date" in clean && clean.date !== row.date) {
        return "Tanggal presensi tidak dapat diubah.";
      }
      if ("status" in clean && clean.status !== row.status) {
        return authz("Status presensi tidak dapat diubah.");
      }
      if (row.check_out_time && "check_out_time" in clean) {
        return authz("Presensi keluar sudah tercatat dan tidak dapat diubah.");
      }
    }
    if ("check_out_time" in clean && clean.check_out_time && !row.check_in_time) {
      return "Presensi keluar tidak dapat dicatat sebelum presensi masuk.";
    }
    if (clean.date && !isValidDate(clean.date)) return "Tanggal presensi tidak valid.";
    if (clean.status && !["hadir", "izin", "sakit", "alpa"].includes(clean.status)) return "Status presensi tidak valid.";
    return null;
  },
  // (m3) Stempel waktu server.
  serverUpdateTimestamps: ["check_out_time"],
});

// ---------------------------- journals ----------------------------
crud("journals", {
  fields: [
    "student_id", "date", "title", "description", "duration_minutes",
    "attachment_path", "attachment_name", "review_status",
    "supervisor_feedback", "reviewed_by", "reviewed_by_name", "reviewed_at",
  ],
  dateField: "date",
  order: "date DESC",
  createRoles: ["siswa", "pembimbing", "admin"],
  requiredOnCreate: ["student_id", "date", "title"],
  requiredMessages: {
    student_id: "Siswa wajib diisi.",
    date: "Tanggal jurnal wajib diisi.",
    title: "Judul kegiatan wajib diisi.",
  },
  // (B1) review_status TIDAK lagi dikirimsiswa → default DB 'menunggu' yang berlaku.
  scopeRead: (req, rows) => {
    if (req.user.role === "siswa") return rows.filter((r) => r.student_id === req.user.id);
    if (req.user.role === "pembimbing") {
      const ids = new Set(myStudentIds(req.user.id));
      return rows.filter((r) => ids.has(r.student_id));
    }
    return rows;
  },
  validateCreate: (req, clean) => {
    const sid = clean.student_id;
    if (!isUuid(sid)) return "Siswa tidak valid.";
    if (req.user.role === "siswa" && sid !== req.user.id) return authz("Anda hanya dapat membuat jurnal sendiri.");
    if (req.user.role === "pembimbing" && !canSeeStudent(req.user, sid)) return authz("Bukan siswa bimbingan Anda.");
    if (!isValidDate(clean.date)) return "Tanggal jurnal tidak valid (format YYYY-MM-DD).";
    // (jurnal) Siswa tidak boleh mengisi untuk masa depan; wajib penempatan aktif.
    if (req.user.role === "siswa" && clean.date > todayJakarta()) {
      return "Tanggal jurnal tidak boleh melebihi hari ini.";
    }
    if (req.user.role === "siswa" && !hasActivePlacement(sid)) {
      return "Penempatan PKL Anda belum aktif. Hubungi Admin.";
    }
    if (!String(clean.title ?? "").trim()) return "Judul kegiatan wajib diisi.";
    if (clean.duration_minutes !== undefined && clean.duration_minutes !== null) {
      if (clean.duration_minutes < 0 || clean.duration_minutes > 1440) return "Durasi harus antara 0 dan 1440 menit.";
    }
    // (B2) Siswa/pembimbing tidak boleh menyet review_status saat membuat.
    if (clean.review_status && clean.review_status !== "menunggu") {
      if (req.user.role === "admin") return null;
      return "Anda tidak dapat menentukan status tinjauan sendiri.";
    }
    return null;
  },
  canUpdate: (req, row) => {
    if (req.user.role === "admin") return true;
    if (req.user.role === "pembimbing") {
      return canSeeStudent(req.user, row.student_id) ? true : "Bukan siswa bimbingan Anda.";
    }
    return row.student_id === req.user.id ? true : "Anda hanya dapat mengubah jurnal sendiri.";
  },
  validateUpdate: (req, row, clean) => {
    // (B2) Siswa tidak boleh menyentuh field tinjauan.
    if (req.user.role !== "admin" && req.user.role !== "pembimbing") {
      const reviewFields = ["review_status", "supervisor_feedback", "reviewed_by", "reviewed_by_name", "reviewed_at"];
      if (reviewFields.some((f) => f in clean)) {
        return authz("Anda tidak dapat mengubah status tinjauan jurnal.");
      }
      if (row.review_status === "ditinjau") {
        return "Jurnal yang sudah ditinjau tidak dapat diubah.";
      }
    }
    if (req.user.role === "pembimbing" && !canSeeStudent(req.user, row.student_id)) return "Bukan siswa bimbingan Anda.";
    if (clean.title !== undefined && !String(clean.title).trim()) return "Judul kegiatan wajib diisi.";
    if (clean.date !== undefined && !isValidDate(clean.date)) return "Tanggal jurnal tidak valid.";
    if (req.user.role === "siswa" && clean.date && clean.date > todayJakarta()) {
      return "Tanggal jurnal tidak boleh melebihi hari ini.";
    }
    if (clean.duration_minutes !== undefined && clean.duration_minutes !== null) {
      if (clean.duration_minutes < 0 || clean.duration_minutes > 1440) return "Durasi harus antara 0 dan 1440 menit.";
    }
    if (clean.review_status && !["menunggu", "ditinjau"].includes(clean.review_status)) return "Status tinjauan tidak valid.";
    // (fix) Identitas peninjau dicatat server, bukan dipercaya dari klien.
    if (
      clean.review_status === "ditinjau" ||
      ["supervisor_feedback", "reviewed_by", "reviewed_by_name", "reviewed_at"].some((f) => f in clean)
    ) {
      clean.reviewed_by = req.user.id;
      clean.reviewed_by_name = req.user.full_name;
      clean.reviewed_at = nowISO();
    }
    return null;
  },
  canDelete: (req, row) => {
    if (req.user.role === "admin") return true;
    if (row.student_id !== req.user.id) return "Anda hanya dapat menghapus jurnal sendiri.";
    if (row.review_status === "ditinjau") return "Jurnal yang sudah ditinjau tidak dapat dihapus.";
    return true;
  },
});

// ---------------------------- leave requests ----------------------------
crud("leave", {
  sqlTable: "leave_requests",
  fields: [
    "student_id", "type", "start_date", "end_date", "reason",
    "attachment_path", "attachment_name", "status",
    "decided_by", "decided_by_name", "decided_at", "decision_note",
  ],
  order: "created_at DESC",
  createRoles: ["siswa", "pembimbing", "admin"],
  requiredOnCreate: ["student_id", "type", "start_date", "end_date", "reason"],
  requiredMessages: {
    student_id: "Siswa wajib diisi.",
    type: "Jenis pengajuan wajib dipilih.",
    start_date: "Tanggal mulai wajib diisi.",
    end_date: "Tanggal selesai wajib diisi.",
    reason: "Alasan pengajuan wajib diisi.",
  },
  defaultsOnCreate: (req, clean) => ("status" in clean ? {} : { status: "menunggu" }),
  scopeRead: (req, rows) => {
    if (req.user.role === "siswa") return rows.filter((r) => r.student_id === req.user.id);
    if (req.user.role === "pembimbing") {
      const ids = new Set(myStudentIds(req.user.id));
      return rows.filter((r) => ids.has(r.student_id));
    }
    return rows;
  },
  validateCreate: (req, clean) => {
    const sid = clean.student_id;
    if (!isUuid(sid)) return "Siswa tidak valid.";
    if (req.user.role === "siswa" && sid !== req.user.id) return authz("Anda hanya dapat mengajukan untuk diri sendiri.");
    if (req.user.role === "pembimbing" && !canSeeStudent(req.user, sid)) return authz("Bukan siswa bimbingan Anda.");
    if (!["izin", "sakit", "cuti"].includes(clean.type)) return "Jenis pengajuan harus Izin, Sakit, atau Cuti.";
    if (!isValidDate(clean.start_date)) return "Tanggal mulai tidak valid (format YYYY-MM-DD).";
    if (!isValidDate(clean.end_date)) return "Tanggal selesai tidak valid (format YYYY-MM-DD).";
    if (clean.end_date < clean.start_date) return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
    if (!String(clean.reason ?? "").trim()) return "Alasan pengajuan wajib diisi.";
    if (clean.status && clean.status !== "menunggu" && req.user.role !== "admin") {
      return "Anda tidak dapat menentukan status pengajuan sendiri.";
    }
    return null;
  },
  canUpdate: (req, row) => {
    if (req.user.role === "admin") return true;
    if (req.user.role === "pembimbing") {
      return canSeeStudent(req.user, row.student_id) ? true : "Bukan siswa bimbingan Anda.";
    }
    return row.student_id === req.user.id ? true : "Anda hanya dapat mengubah pengajuan sendiri.";
  },
  validateUpdate: (req, row, clean) => {
    const decisionFields = ["decided_by", "decided_by_name", "decided_at", "decision_note"];
    const triesDecision = decisionFields.some((f) => f in clean);
    if (req.user.role === "siswa") {
      if (triesDecision) return authz("Anda tidak dapat menyetujui atau menolak pengajuan sendiri.");
      if ("status" in clean) {
        // Siswa boleh membatalkan pengajuannya sendiri selama masih menunggu.
        if (clean.status !== "dibatalkan") {
          return authz("Anda tidak dapat menyetujui atau menolak pengajuan sendiri.");
        }
        if (row.status !== "menunggu") return "Pengajuan yang sudah diproses tidak dapat dibatalkan.";
      }
      if (row.status !== "menunggu" && Object.keys(clean).some((f) => f !== "status")) {
        return "Pengajuan yang sudah diproses tidak dapat diubah.";
      }
      if ("reason" in clean && !String(clean.reason).trim()) return "Alasan pengajuan wajib diisi.";
      if ("end_date" in clean) {
        if (!isValidDate(clean.end_date)) return "Tanggal selesai tidak valid.";
        const start = "start_date" in clean ? clean.start_date : row.start_date;
        if (clean.end_date < start) return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
      }
      return null;
    }
    if (req.user.role === "pembimbing" && !canSeeStudent(req.user, row.student_id)) {
      return "Bukan siswa bimbingan Anda.";
    }
    if (clean.status && !["menunggu", "disetujui", "ditolak", "dibatalkan"].includes(clean.status)) {
      return "Status pengajuan tidak valid.";
    }
    // (fix) Keluar dari "disetujui" dilarang: baris presensi otomatis harus dihapus
    // manual dulu agar tidak tertinggal data basi.
    if (row.status === "disetujui" && clean.status && clean.status !== "disetujui") {
      return "Pengajuan yang sudah disetujui tidak dapat diubah. Hapus baris presensi terkait terlebih dahulu bila ingin mengoreksi.";
    }
    if (row.status === "dibatalkan" && clean.status === "disetujui") {
      return "Pengajuan yang sudah dibatalkan tidak dapat disetujui.";
    }
    // (fix) Identitas penentu dicatat server, bukan dipercaya dari klien.
    if (clean.status === "disetujui" || clean.status === "ditolak" || decisionFields.some((f) => f in clean)) {
      clean.decided_by = req.user.id;
      clean.decided_by_name = req.user.full_name;
      clean.decided_at = nowISO();
    }
    return null;
  },
  canDelete: (req, row) => {
    if (req.user.role === "admin") return true;
    return row.student_id === req.user.id && row.status === "menunggu" ? true : "Pengajuan tidak dapat dihapus.";
  },
});

// ---------------------------- assessments ----------------------------
crud("assessments", {
  fields: [
    "student_id", "period_id", "score_attendance", "score_journal", "score_discipline",
    "score_competence", "score_attitude", "final_score", "predicate", "notes",
    "assessed_by", "assessed_by_name", "assessed_at",
  ],
  order: "created_at DESC",
  // (M2/B2) Hanya admin & pembimbing yang boleh menilai.
  createRoles: ["admin", "pembimbing"],
  deniedMessage: "Hanya admin dan pembimbing yang dapat membuat penilaian.",
  requiredOnCreate: ["student_id"],
  requiredMessages: { student_id: "Siswa wajib diisi." },
  defaultsOnCreate: (req) => ({ assessed_by: req.user.id, assessed_by_name: req.user.full_name, assessed_at: nowISO() }),
  scopeRead: (req, rows) => {
    if (req.user.role === "siswa") return rows.filter((r) => r.student_id === req.user.id);
    if (req.user.role === "pembimbing") {
      const ids = new Set(myStudentIds(req.user.id));
      return rows.filter((r) => ids.has(r.student_id));
    }
    return rows;
  },
  validateCreate: (req, clean) => crudAssessmentValidator(req, clean),
  validateUpdate: (req, row, clean) => {
    if (req.user.role === "pembimbing" && !canWriteStudent(req.user, row.student_id)) {
      return authz("Anda hanya dapat menilai siswa bimbingan Anda.");
    }
    return crudAssessmentValidator(req, clean);
  },
  canUpdate: (req, row) => {
    if (req.user.role === "admin") return true;
    if (req.user.role === "pembimbing") {
      return canWriteStudent(req.user, row.student_id) ? true : "Anda hanya dapat menilai siswa bimbingan Anda.";
    }
    return "Anda tidak dapat mengubah nilai.";
  },
  canDelete: (req, row) => {
    if (req.user.role === "admin") return true;
    if (req.user.role === "pembimbing") {
      return canWriteStudent(req.user, row.student_id) ? true : "Anda hanya dapat menghapus penilaian siswa bimbingannya.";
    }
    return "Anda tidak dapat menghapus nilai.";
  },
});
function crudAssessmentValidator(req, clean) {
  if (clean.student_id && !isUuid(clean.student_id)) return "Siswa tidak valid.";
  if (req.user.role === "pembimbing") {
    const sid = clean.student_id;
    if (sid && !canWriteStudent(req.user, sid)) return authz("Anda hanya dapat menilai siswa bimbingan Anda.");
  }
  const scoreFields = ["score_attendance", "score_journal", "score_discipline", "score_competence", "score_attitude", "final_score"];
  for (const f of scoreFields) {
    const v = clean[f];
    if (v === undefined || v === null) continue;
    if (typeof v !== "number" || Number.isNaN(v)) return "Nilai harus berupa angka.";
    if (v < 0 || v > 100) return "Nilai harus antara 0 dan 100.";
  }
  if (clean.predicate !== undefined && clean.predicate !== null && !["A", "B", "C", "D"].includes(clean.predicate)) {
    return "Predikat harus A, B, C, atau D.";
  }
  return null;
}

// ---------------------------- activity logs ----------------------------
crud("activity-logs", {
  sqlTable: "activity_logs",
  fields: ["actor_id", "actor_name", "actor_role", "action", "entity_type", "entity_id", "description"],
  noUpdated: true,
  order: "created_at DESC",
  createRoles: ["admin", "pembimbing", "siswa"],
  // (M9) Identitas aktor diambil dari server, bukan dipercaya dari klien.
  defaultsOnCreate: (req) => ({
    actor_id: req.user.id,
    actor_name: req.user.full_name,
    actor_role: req.user.role,
  }),
  scopeRead: (req, rows) => (req.user.role === "admin" ? rows : []),
  canUpdate: () => "Log aktivitas tidak dapat diubah.",
  canDelete: (req) => (req.user.role === "admin" ? true : "Hanya admin yang dapat menghapus log aktivitas."),
  requiredOnCreate: ["action"],
  requiredMessages: { action: "Aksi log wajib diisi." },
});

// ---------------------------- students overview ----------------------------
app.get("/api/students/overview", authRequired, (req, res) => {
  let users = db.prepare("SELECT * FROM users WHERE role = 'siswa' ORDER BY full_name").all();
  if (req.user.role === "pembimbing") {
    const ids = new Set(myStudentIds(req.user.id));
    users = users.filter((u) => ids.has(u.id));
  } else if (req.user.role === "siswa") {
    users = users.filter((u) => u.id === req.user.id);
  }
  if (req.query.student_id) {
    // Selalu intersect dengan scope; tidak boleh override.
    users = users.filter((u) => u.id === req.query.student_id);
  }
  const details = new Map(db.prepare("SELECT * FROM siswa_profiles").all().map((d) => [d.profile_id, d]));
  const placements = db.prepare("SELECT * FROM placements ORDER BY created_at ASC").all();
  const companies = new Map(db.prepare("SELECT * FROM companies").all().map((c) => [c.id, mapRow(c, ["is_active"])]));
  const periods = new Map(db.prepare("SELECT * FROM pkl_periods").all().map((p) => [p.id, mapRow(p, ["is_active"])]));
  const supervisors = new Map(db.prepare("SELECT * FROM users WHERE role = 'pembimbing'").all().map((s) => [s.id, mapUser(s)]));

  res.json(
    users.map((u) => {
      // (M8) Ambil placement aktif lebih dulu agar tidak ambigu.
      const all = placements.filter((p) => p.student_id === u.id);
      const placement = all.find((p) => p.status === "aktif") ?? all[all.length - 1] ?? null;
      return {
        profile: mapUser(u),
        detail: details.get(u.id) || null,
        placement,
        company: (placement?.company_id && companies.get(placement.company_id)) || null,
        supervisor: (placement?.supervisor_id && supervisors.get(placement.supervisor_id)) || null,
        period: (placement?.period_id && periods.get(placement.period_id)) || null,
      };
    }),
  );
});

// ---------------------------------------------------------------------------
// Uploads (M4, M7, m12) — path `siswa/<studentId>/<folder>/<file>`
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const folder = ALLOWED_FOLDERS.includes(req.query.folder) ? req.query.folder : "jurnal";
      const owner = resolveUploadOwner(req);
      if (!owner) return cb(new Error("SISWA_TIDAK_VALID"));
      const dir = path.join(UPLOAD_DIR, "siswa", owner, folder);
      try {
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      const ext = UPLOAD_MIME[file.mimetype] || ".bin";
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!UPLOAD_MIME[file.mimetype]) return cb(null, false);
    cb(null, true);
  },
});

function resolveUploadOwner(req) {
  const requested = String(req.query.student_id ?? "").trim();
  // Siswa: hanya boleh mengunggah atas namanya sendiri.
  if (req.user.role === "siswa") {
    if (requested && requested !== req.user.id) return null;
    return req.user.id;
  }
  // Admin/pembimbing: wajib menyebut siswa tujuan yang sah.
  if (!isUuid(requested)) return null;
  const student = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'siswa'").get(requested);
  if (!student) return null;
  if (req.user.role === "pembimbing" && !canSeeStudent(req.user, requested)) return null;
  return requested;
}

app.post("/api/uploads", authRequired, (req, res) => {
  const folder = ALLOWED_FOLDERS.includes(req.query.folder) ? req.query.folder : "jurnal";
  const owner = resolveUploadOwner(req);
  if (!owner) return fail(res, 400, "Siswa tujuan tidak valid atau di luar wewenang Anda.");
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return fail(res, 413, `Ukuran file melebihi batas ${MAX_UPLOAD_MB} MB.`);
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return fail(res, 400, "Hanya satu file yang dapat diunggah per permintaan.");
        }
        return fail(res, 400, "Upload gagal. Silakan coba lagi.");
      }
      if (err.message === "SISWA_TIDAK_VALID") {
        return fail(res, 400, "Siswa tujuan tidak valid atau di luar wewenang Anda.");
      }
      console.error("[upload]", err.message);
      return fail(res, 500, "Upload gagal. Silakan coba lagi.");
    }
    if (!req.file) {
      return fail(res, 415, "Tipe file tidak didukung. Gunakan foto (JPG/PNG/WEBP/HEIC/HEIF) atau PDF.");
    }
    const rel = `siswa/${owner}/${folder}/${req.file.filename}`;
    const name = String(req.file.originalname || "file").replace(/[^\w.\- ]+/g, "_").slice(0, 120);
    res.status(201).json({ path: rel, name });
  });
});

app.get("/api/files", authRequired, (req, res) => {
  const rel = String(req.query.path ?? "");
  if (!/^siswa\/[0-9a-f-]{36}\/[a-z]+\/[A-Za-z0-9._-]+$/.test(rel)) {
    return fail(res, 400, "Path file tidak valid.");
  }
  const owner = rel.split("/")[1];
  // (M7) ACL per-siswa.
  if (!canSeeStudent(req.user, owner)) {
    return fail(res, 403, "Anda tidak berhak mengakses berkas ini.");
  }
  const abs = path.join(UPLOAD_DIR, rel);
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) return fail(res, 400, "Path file tidak valid.");
  if (!fs.existsSync(abs)) return fail(res, 404, "File tidak ditemukan.");
  // Cegah HTML aktif-XSS: selalu sajikan sebagai lampiran untrusted.
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${path.basename(abs)}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(abs);
});

app.get("/api/health", (req, res) => res.json({ ok: true, timezone: APP_TIMEZONE }));

// ---------------------------------------------------------------------------
// Global error handler (M1) — selalu JSON, tidak pernah stack trace
// ---------------------------------------------------------------------------

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return fail(res, 413, `Ukuran file melebihi batas ${MAX_UPLOAD_MB} MB.`);
    }
    return fail(res, 400, "Upload gagal.");
  }
  if (err?.type === "entity.too.large") {
    return fail(res, 413, "Data yang dikirim terlalu besar.");
  }
  if (err?.type === "entity.parse.failed") {
    return fail(res, 400, "Format JSON tidak valid.");
  }
  console.error("[unhandled]", err?.message ?? err);
  return fail(res, 500, "Terjadi kesalahan pada server. Silakan coba lagi.");
});

app.listen(PORT, () => {
  console.log(`[pkl-server] http://localhost:${PORT}`);
  console.log(`[pkl-server] db: ${DB_FILE}`);
  console.log(`[pkl-server] timezone: ${APP_TIMEZONE} | upload max: ${MAX_UPLOAD_MB}MB | folder: ${ALLOWED_FOLDERS.join(",")}`);
  console.log(`[pkl-server] CORS allow: ${ALLOWED_ORIGINS.join(", ")}`);
});
