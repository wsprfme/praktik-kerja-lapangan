import { api } from "@/lib/api"
import type {
  Announcement,
  Assessment,
  Attendance,
  Company,
  Holiday,
  Journal,
  LeaveRequest,
  PembimbingProfile,
  PklPeriod,
  Placement,
  Profile,
  SiswaProfile,
  StudentOverview,
} from "@/lib/types"

export async function fetchProfilesByRole(role: Profile["role"]): Promise<Profile[]> {
  return api.list<Profile>("users", { role })
}

export async function fetchCompanies(): Promise<Company[]> {
  return api.list<Company>("companies")
}

export async function fetchPeriods(): Promise<PklPeriod[]> {
  return api.list<PklPeriod>("periods")
}

export async function fetchHolidays(): Promise<Holiday[]> {
  return api.list<Holiday>("holidays")
}

export async function fetchSiswaDetails(): Promise<SiswaProfile[]> {
  return api.list<SiswaProfile>("siswa-details")
}

export async function fetchPembimbingDetails(): Promise<PembimbingProfile[]> {
  // Backend menyimpan di users + tabel terpisah; sediakan via /api/users?role=pembimbing
  // dan detail digabung di overview. Untuk kompat, kembalikan list kosong bila endpoint belum ada.
  try {
    return await api.list<PembimbingProfile>("pembimbing-details")
  } catch {
    return []
  }
}

interface PlacementFilters {
  studentId?: string
  supervisorId?: string
}

export async function fetchPlacements(filters: PlacementFilters = {}): Promise<Placement[]> {
  const params: Record<string, string> = {}
  if (filters.studentId) params.student_id = filters.studentId
  if (filters.supervisorId) params.supervisor_id = filters.supervisorId
  void params
  // Backend filter via client karena endpoint generic; ambil semua lalu filter.
  const all = await api.list<Placement>("placements")
  return all.filter(
    (p) =>
      (!filters.studentId || p.student_id === filters.studentId) &&
      (!filters.supervisorId || p.supervisor_id === filters.supervisorId),
  )
}

/** Siswa beserta penempatan, perusahaan, pembimbing, dan periode aktifnya. */
export async function fetchStudentOverviews(studentIds?: string[]): Promise<StudentOverview[]> {
  if (studentIds && studentIds.length === 1) {
    const rows = await api.list<StudentOverview>("students/overview", { student_id: studentIds[0] })
    return rows
  }
  const rows = await api.list<StudentOverview>("students/overview")
  if (studentIds && studentIds.length > 0) {
    const set = new Set(studentIds)
    return rows.filter((r) => set.has(r.profile.id))
  }
  return rows
}

export async function fetchStudentOverview(studentId: string): Promise<StudentOverview | null> {
  const rows = await fetchStudentOverviews([studentId])
  return rows[0] ?? null
}

export async function fetchAttendance(filters: { studentId?: string; from?: string; to?: string } = {}): Promise<Attendance[]> {
  const params: Record<string, string> = {}
  if (filters.studentId) params.student_id = filters.studentId
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  return api.list<Attendance>("attendance", params)
}

export async function fetchJournals(
  filters: { studentId?: string; reviewStatus?: string; from?: string; to?: string } = {},
): Promise<Journal[]> {
  const params: Record<string, string> = {}
  if (filters.studentId) params.student_id = filters.studentId
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  const rows = await api.list<Journal>("journals", params)
  return filters.reviewStatus ? rows.filter((j) => j.review_status === filters.reviewStatus) : rows
}

export async function fetchLeaveRequests(
  filters: { studentId?: string; status?: string } = {},
): Promise<LeaveRequest[]> {
  const params: Record<string, string> = {}
  if (filters.studentId) params.student_id = filters.studentId
  if (filters.status) params.status = filters.status
  return api.list<LeaveRequest>("leave", params)
}

export async function fetchAssessments(studentIds?: string[]): Promise<Assessment[]> {
  const rows = await api.list<Assessment>("assessments")
  if (studentIds && studentIds.length > 0) {
    const set = new Set(studentIds)
    return rows.filter((a) => set.has(a.student_id))
  }
  return rows
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const rows = await api.list<Announcement>("announcements")
  return rows.filter((a) => a.is_published)
}

export function countStatuses(rows: { status: string }[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1
    return acc
  }, {})
}

export async function logActivity(entry: {
  action: string
  description: string
  entityType?: string
  entityId?: string
  actor: Profile
}): Promise<void> {
  await api.create("activity-logs", {
    actor_id: entry.actor.id,
    actor_name: entry.actor.full_name,
    actor_role: entry.actor.role,
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    description: entry.description,
  })
}
