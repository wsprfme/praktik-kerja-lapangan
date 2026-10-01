-- Skema SQLite untuk PKL Management.
-- Prinsip: file gambar HANYA di folder uploads/, TIDAK PERNAH sebagai BLOB/base64 di DB.
-- Semua kolom file berupa TEXT path relatif (mis. presensi/123.jpg), bukan isi file.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin','pembimbing','siswa')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  avatar_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS siswa_profiles (
  profile_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nis TEXT,
  nisn TEXT UNIQUE,
  class_name TEXT,
  major TEXT
);
CREATE INDEX IF NOT EXISTS idx_siswa_nisn ON siswa_profiles(nisn);

CREATE TABLE IF NOT EXISTS pembimbing_profiles (
  profile_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nip TEXT,
  department TEXT
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  field_of_work TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS pkl_periods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS placements (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  company_id TEXT REFERENCES companies(id) ON DELETE RESTRICT,
  supervisor_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  period_id TEXT REFERENCES pkl_periods(id) ON DELETE RESTRICT,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','aktif','selesai','dibatalkan')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_placements_student ON placements(student_id);
CREATE INDEX IF NOT EXISTS idx_placements_supervisor ON placements(supervisor_id);

CREATE INDEX IF NOT EXISTS idx_placements_company ON placements(company_id);

-- Menolak placement aktif ganda untuk pasangan siswa + periode yang sama.
CREATE UNIQUE INDEX IF NOT EXISTS uq_placement_aktif
  ON placements(student_id, period_id) WHERE status = 'aktif';

CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  check_in_time TEXT,
  check_out_time TEXT,
  status TEXT NOT NULL DEFAULT 'hadir' CHECK (status IN ('hadir','izin','sakit','alpa')),
  note TEXT,
  photo_path TEXT,
  photo_name TEXT,
  latitude REAL,
  longitude REAL,
  address TEXT,
  captured_at TEXT,
  check_out_photo_path TEXT,
  check_out_photo_name TEXT,
  check_out_latitude REAL,
  check_out_longitude REAL,
  check_out_address TEXT,
  check_out_captured_at TEXT,
  recorded_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(student_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);

CREATE TABLE IF NOT EXISTS journals (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  attachment_path TEXT,
  attachment_name TEXT,
  review_status TEXT NOT NULL DEFAULT 'menunggu' CHECK (review_status IN ('menunggu','ditinjau')),
  supervisor_feedback TEXT,
  reviewed_by TEXT,
  reviewed_by_name TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_journals_student_date ON journals(student_id, date);

-- Satu jurnal per pasangan siswa + tanggal (sesuai "Satu jurnal per hari" di UI).
CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_student_date ON journals(student_id, date);

CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('izin','sakit','cuti')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  attachment_path TEXT,
  attachment_name TEXT,
  status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','disetujui','ditolak','dibatalkan')),
  decided_by TEXT,
  decided_by_name TEXT,
  decided_at TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_leave_student ON leave_requests(student_id);

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_id TEXT REFERENCES pkl_periods(id) ON DELETE SET NULL,
  score_attendance REAL,
  score_journal REAL,
  score_discipline REAL,
  score_competence REAL,
  score_attitude REAL,
  final_score REAL,
  predicate TEXT CHECK (predicate IN ('A','B','C','D')),
  notes TEXT,
  assessed_by TEXT,
  assessed_by_name TEXT,
  assessed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_assessments_student ON assessments(student_id);

-- Satu penilaian per pasangan siswa + periode (NULL periode dinormalisasi).
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_student_period
  ON assessments(student_id, COALESCE(period_id, ''));

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'semua' CHECK (audience IN ('semua','pembimbing','siswa')),
  is_published INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_by_name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
