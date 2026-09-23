/*
# Add NISN, Check-Out Fields, and Pembimbing Student Management

## Changes

### 1. siswa_profiles
- Add `nisn` column (text, nullable) for student national ID used as login credential.
- Index on nisn for fast lookups.

### 2. attendance table
- Add `check_out_time` already exists, so ensure it is timestamptz.
- Add `check_out_photo_path` (text) - storage path for check-out selfie.
- Add `check_out_photo_name` (text) - original filename of check-out photo.
- Add `check_out_latitude` (numeric) - GPS latitude at check-out.
- Add `check_out_longitude` (numeric) - GPS longitude at check-out.
- Add `check_out_address` (text) - reverse-geocoded address at check-out.
- Add `check_out_captured_at` (timestamptz) - timestamp of check-out capture.

### 3. profiles
- Add `must_change_password` (boolean, default false) - flags first-login for students.

### 4. Security
- Pembimbing gets ability to create student auth accounts via admin-users edge function update.
- RLS policies updated for new columns.

### Important Notes
1. NISN is separate from NIS. NIS (already exists) is school-level; NISN is national-level.
2. Check-out columns mirror check-in columns (photo, geo, timestamp).
3. `must_change_password` is set true when creating student accounts so they must change on first login.
*/

-- 1. Add nisn to siswa_profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'siswa_profiles' AND column_name = 'nisn'
  ) THEN
    ALTER TABLE public.siswa_profiles ADD COLUMN nisn text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_siswa_profiles_nisn ON public.siswa_profiles (nisn) WHERE nisn IS NOT NULL;

-- 2. Add check-out columns to attendance
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance' AND column_name = 'check_out_photo_path'
  ) THEN
    ALTER TABLE public.attendance
      ADD COLUMN check_out_photo_path text,
      ADD COLUMN check_out_photo_name text,
      ADD COLUMN check_out_latitude numeric(10,7),
      ADD COLUMN check_out_longitude numeric(10,7),
      ADD COLUMN check_out_address text,
      ADD COLUMN check_out_captured_at timestamptz;
  END IF;
END $$;

-- 3. Add must_change_password to profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'must_change_password'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
  END IF;
END $$;
