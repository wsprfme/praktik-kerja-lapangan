import { supabase } from "@/lib/supabase"
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

async function requireData<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return (data ?? []) as T
}

export async function fetchProfilesByRole(role: Profile["role"]): Promise<Profile[]> {
  return requireData<Profile[]>(
    supabase.from("profiles").select("*").eq("role", role).order("full_name"),
  )
}

export async function fetchCompanies(): Promise<Company[]> {
  return requireData<Company[]>(supabase.from("companies").select("*").order("name"))
}

export async function fetchPeriods(): Promise<PklPeriod[]> {
  return requireData<PklPeriod[]>(
    supabase.from("pkl_periods").select("*").order("start_date", { ascending: false }),
  )
}

export async function fetchHolidays(): Promise<Holiday[]> {
  return requireData<Holiday[]>(supabase.from("holidays").select("*").order("date"))
}

export async function fetchSiswaDetails(): Promise<SiswaProfile[]> {
  return requireData<SiswaProfile[]>(supabase.from("siswa_profiles").select("*"))
}

export async function fetchPembimbingDetails(): Promise<PembimbingProfile[]> {
  return requireData<PembimbingProfile[]>(supabase.from("pembimbing_profiles").select("*"))
}

interface PlacementFilters {
  studentId?: string
  supervisorId?: string
}

export async function fetchPlacements(filters: PlacementFilters = {}): Promise<Placement[]> {
  let query = supabase.from("placements").select("*")
  if (filters.studentId) query = query.eq("student_id", filters.studentId)
  if (filters.supervisorId) query = query.eq("supervisor_id", filters.supervisorId)
  return requireData<Placement[]>(query.order("created_at", { ascending: false }))
}

/** Siswa beserta penempatan, perusahaan, pembimbing, dan periode aktifnya. */
export async function fetchStudentOverviews(studentIds?: string[]): Promise<StudentOverview[]> {
  const [students, details, placements, companies, periods, supervisors] = await Promise.all([
    studentIds && studentIds.length > 0
      ? requireData<Profile[]>(supabase.from("profiles").select("*").in("id", studentIds).order("full_name"))
      : fetchProfilesByRole("siswa"),
    fetchSiswaDetails(),
    fetchPlacements(),
    fetchCompanies(),
    fetchPeriods(),
    fetchProfilesByRole("pembimbing"),
  ])

  const detailMap = new Map(details.map((d) => [d.profile_id, d]))
  const companyMap = new Map(companies.map((c) => [c.id, c]))
  const periodMap = new Map(periods.map((p) => [p.id, p]))
  const supervisorMap = new Map(supervisors.map((s) => [s.id, s]))

  return students.map((student) => {
    const placement = placements.find((p) => p.student_id === student.id) ?? null
    return {
      profile: student,
      detail: detailMap.get(student.id) ?? null,
      placement,
      company: placement?.company_id ? companyMap.get(placement.company_id) ?? null : null,
      supervisor: placement?.supervisor_id ? supervisorMap.get(placement.supervisor_id) ?? null : null,
      period: placement?.period_id ? periodMap.get(placement.period_id) ?? null : null,
    }
  })
}

export async function fetchStudentOverview(studentId: string): Promise<StudentOverview | null> {
  const rows = await fetchStudentOverviews([studentId])
  return rows[0] ?? null
}

export async function fetchAttendance(filters: { studentId?: string; from?: string; to?: string } = {}): Promise<Attendance[]> {
  let query = supabase.from("attendance").select("*")
  if (filters.studentId) query = query.eq("student_id", filters.studentId)
  if (filters.from) query = query.gte("date", filters.from)
  if (filters.to) query = query.lte("date", filters.to)
  return requireData<Attendance[]>(query.order("date", { ascending: false }))
}

export async function fetchJournals(
  filters: { studentId?: string; reviewStatus?: string; from?: string; to?: string } = {},
): Promise<Journal[]> {
  let query = supabase.from("journals").select("*")
  if (filters.studentId) query = query.eq("student_id", filters.studentId)
  if (filters.reviewStatus) query = query.eq("review_status", filters.reviewStatus)
  if (filters.from) query = query.gte("date", filters.from)
  if (filters.to) query = query.lte("date", filters.to)
  return requireData<Journal[]>(query.order("date", { ascending: false }))
}

export async function fetchLeaveRequests(
  filters: { studentId?: string; status?: string } = {},
): Promise<LeaveRequest[]> {
  let query = supabase.from("leave_requests").select("*")
  if (filters.studentId) query = query.eq("student_id", filters.studentId)
  if (filters.status) query = query.eq("status", filters.status)
  return requireData<LeaveRequest[]>(query.order("created_at", { ascending: false }))
}

export async function fetchAssessments(studentIds?: string[]): Promise<Assessment[]> {
  let query = supabase.from("assessments").select("*")
  if (studentIds && studentIds.length > 0) query = query.in("student_id", studentIds)
  return requireData<Assessment[]>(query.order("created_at", { ascending: false }))
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  return requireData<Announcement[]>(
    supabase
      .from("announcements")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false }),
  )
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
  await supabase.from("activity_logs").insert({
    actor_id: entry.actor.id,
    actor_name: entry.actor.full_name,
    actor_role: entry.actor.role,
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    description: entry.description,
  })
}
