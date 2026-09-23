export type Role = "admin" | "pembimbing" | "siswa"

export interface Profile {
  id: string
  role: Role
  full_name: string
  email: string
  phone: string | null
  address: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PembimbingProfile {
  profile_id: string
  nip: string | null
  department: string | null
}

export interface SiswaProfile {
  profile_id: string
  nis: string | null
  class_name: string | null
  major: string | null
}

export interface Company {
  id: string
  name: string
  address: string | null
  field_of_work: string | null
  contact_person: string | null
  contact_phone: string | null
  contact_email: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PklPeriod {
  id: string
  name: string
  academic_year: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PlacementStatus = "draft" | "aktif" | "selesai" | "dibatalkan"

export interface Placement {
  id: string
  student_id: string
  company_id: string | null
  supervisor_id: string | null
  period_id: string | null
  start_date: string | null
  end_date: string | null
  status: PlacementStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type AttendanceStatus = "hadir" | "izin" | "sakit" | "alpa"

export interface Attendance {
  id: string
  student_id: string
  date: string
  check_in_time: string | null
  check_out_time: string | null
  status: AttendanceStatus
  note: string | null
  photo_path: string | null
  photo_name: string | null
  latitude: number | null
  longitude: number | null
  address: string | null
  captured_at: string | null
  recorded_by: string | null
  created_at: string
  updated_at: string
}

export type ReviewStatus = "menunggu" | "ditinjau"

export interface Journal {
  id: string
  student_id: string
  date: string
  title: string
  description: string | null
  duration_minutes: number | null
  attachment_path: string | null
  attachment_name: string | null
  review_status: ReviewStatus
  supervisor_feedback: string | null
  reviewed_by: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export type LeaveType = "izin" | "sakit" | "cuti"
export type LeaveStatus = "menunggu" | "disetujui" | "ditolak" | "dibatalkan"

export interface LeaveRequest {
  id: string
  student_id: string
  type: LeaveType
  start_date: string
  end_date: string
  reason: string
  attachment_path: string | null
  attachment_name: string | null
  status: LeaveStatus
  decided_by: string | null
  decided_by_name: string | null
  decided_at: string | null
  decision_note: string | null
  created_at: string
  updated_at: string
}

export interface Assessment {
  id: string
  student_id: string
  period_id: string | null
  score_attendance: number | null
  score_journal: number | null
  score_discipline: number | null
  score_competence: number | null
  score_attitude: number | null
  final_score: number | null
  predicate: "A" | "B" | "C" | "D" | null
  notes: string | null
  assessed_by: string | null
  assessed_by_name: string | null
  assessed_at: string | null
  created_at: string
  updated_at: string
}

export type AnnouncementAudience = "semua" | "pembimbing" | "siswa"

export interface Announcement {
  id: string
  title: string
  body: string
  audience: AnnouncementAudience
  is_published: boolean
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface ActivityLog {
  id: string
  actor_id: string | null
  actor_name: string | null
  actor_role: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  description: string | null
  created_at: string
}

export interface Holiday {
  id: string
  date: string
  name: string
  created_at: string
}

/** Siswa beserta data penempatan dan profil, dipakai lintas halaman. */
export interface StudentOverview {
  profile: Profile
  detail: SiswaProfile | null
  placement: Placement | null
  company: Company | null
  supervisor: Profile | null
  period: PklPeriod | null
}
