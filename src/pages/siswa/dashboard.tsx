import { Link } from "react-router-dom"
import {
  BookOpen,
  Building2,
  CalendarCheck,
  Clock,
  FileText,
  GraduationCap,
  Megaphone,
  UserRound,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAsyncData } from "@/hooks/use-async-data"
import {
  fetchAnnouncements,
  fetchAssessments,
  fetchAttendance,
  fetchJournals,
  fetchLeaveRequests,
  fetchStudentOverview,
} from "@/lib/queries"
import {
  ATTENDANCE_CLASS,
  ATTENDANCE_LABEL,
  LEAVE_STATUS_CLASS,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  PREDICATE_LABEL,
  REVIEW_CLASS,
  REVIEW_LABEL,
  daysBetween,
  formatDate,
  formatDuration,
  formatTime,
  todayISO,
} from "@/lib/format"
import type { AttendanceStatus, LeaveStatus, ReviewStatus } from "@/lib/types"

export function SiswaDashboard() {
  const { profile } = useAuth()
  const today = todayISO()

  const data = useAsyncData(
    async () => {
      if (!profile) {
        return { overview: null, attendance: [], journals: [], leave: [], assessment: null, announcements: [] }
      }
      const [overview, attendance, journals, leave, assessments, announcements] = await Promise.all([
        fetchStudentOverview(profile.id),
        fetchAttendance({ studentId: profile.id }),
        fetchJournals({ studentId: profile.id }),
        fetchLeaveRequests({ studentId: profile.id }),
        fetchAssessments([profile.id]),
        fetchAnnouncements(),
      ])
      return { overview, attendance, journals, leave, assessment: assessments[0] ?? null, announcements }
    },
    { overview: null, attendance: [], journals: [], leave: [], assessment: null, announcements: [] },
    [profile?.id],
  )

  if (data.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard Siswa" description="Ringkasan kegiatan PKL Anda." />
        <LoadingState rows={5} />
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard Siswa" description="Ringkasan kegiatan PKL Anda." />
        <ErrorState message={data.error} onRetry={data.reload} />
      </div>
    )
  }

  const { overview, attendance, journals, leave, assessment, announcements } = data.data
  const todayAttendance = attendance.find((a) => a.date === today) ?? null
  const counts = attendance.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1
    return acc
  }, {})
  const recentJournals = journals.slice(0, 3)
  const pendingLeave = leave.filter((l) => l.status === "menunggu").length

  const placement = overview?.placement ?? null
  const notPlaced = !placement || !overview?.company || !overview?.supervisor

  let remainingDays: number | null = null
  if (placement?.end_date) {
    const todayDate = new Date(`${today}T00:00:00`).getTime()
    const endDate = new Date(`${placement.end_date}T00:00:00`).getTime()
    if (!Number.isNaN(endDate)) {
      remainingDays = Math.max(0, Math.ceil((endDate - todayDate) / 86400000))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Halo, ${overview?.profile.full_name.split(" ")[0] ?? "Siswa"}`}
        description={`Hari ini ${formatDate(today)}`}
      >
        <Button asChild>
          <Link to="/siswa/presensi">
            <CalendarCheck />
            Isi Presensi
          </Link>
        </Button>
      </PageHeader>

      {notPlaced ? (
        <EmptyState
          icon={Building2}
          title="Menunggu penempatan PKL"
          description="Admin belum melengkapi data perusahaan, pembimbing, atau periode PKL Anda. Silakan hubungi Admin sekolah. Fitur presensi dan jurnal akan aktif setelah penempatan ditetapkan."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Penempatan PKL Saya</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Info icon={Building2} label="Perusahaan" value={overview?.company?.name ?? "-"} />
              <Info icon={UserRound} label="Pembimbing" value={overview?.supervisor?.full_name ?? "-"} />
              <Info
                icon={CalendarCheck}
                label="Periode PKL"
                value={
                  placement?.start_date
                    ? `${formatDate(placement.start_date)} - ${formatDate(placement.end_date)}`
                    : "-"
                }
              />
              <Info
                icon={Clock}
                label="Sisa Hari"
                value={remainingDays === null ? "-" : `${remainingDays} hari`}
              />
            </dl>
            {placement?.start_date && placement?.end_date ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Total durasi PKL {daysBetween(placement.start_date, placement.end_date)} hari kalender.
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Presensi Hari Ini"
          value={todayAttendance ? ATTENDANCE_LABEL[todayAttendance.status as AttendanceStatus] : "Belum diisi"}
          icon={CalendarCheck}
          tone={todayAttendance?.status === "hadir" ? "positive" : todayAttendance ? "warning" : "default"}
          hint={
            todayAttendance
              ? `Masuk ${formatTime(todayAttendance.check_in_time)} - Keluar ${formatTime(todayAttendance.check_out_time)}`
              : "Belum ada catatan presensi"
          }
        />
        <StatCard label="Total Hadir" value={counts.hadir ?? 0} icon={CalendarCheck} tone="positive" />
        <StatCard label="Jurnal Terkumpul" value={journals.length} icon={BookOpen} />
        <StatCard
          label="Pengajuan Menunggu"
          value={pendingLeave}
          icon={FileText}
          tone={pendingLeave > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Jurnal Terbaru</CardTitle>
              <CardDescription>Catatan kegiatan harian Anda.</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/siswa/jurnal">Kelola</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentJournals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada jurnal. Mulai catat kegiatan harian Anda.
              </p>
            ) : (
              <div className="divide-y">
                {recentJournals.map((journal) => (
                  <div key={journal.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{journal.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(journal.date)} - {formatDuration(journal.duration_minutes)}
                      </p>
                    </div>
                    <StatusBadge
                      label={REVIEW_LABEL[journal.review_status as ReviewStatus]}
                      className={REVIEW_CLASS[journal.review_status as ReviewStatus]}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Hasil & Pengumuman</CardTitle>
              <CardDescription>Nilai PKL dan informasi terbaru.</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/siswa/nilai">Nilai</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4">
              {assessment && assessment.final_score !== null ? (
                <>
                  <p className="text-xs text-muted-foreground">Nilai Akhir</p>
                  <p className="text-2xl font-semibold">
                    {assessment.final_score}
                    {assessment.predicate ? (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {assessment.predicate} - {PREDICATE_LABEL[assessment.predicate]}
                      </span>
                    ) : null}
                  </p>
                  {assessment.assessed_by_name ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Dinilai oleh {assessment.assessed_by_name}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nilai belum diisi oleh pembimbing.</p>
              )}
            </div>

            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pengumuman.</p>
            ) : (
              <ul className="space-y-3">
                {announcements.slice(0, 3).map((announcement) => (
                  <li key={announcement.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Megaphone className="size-3.5 text-muted-foreground" />
                      <p className="text-sm font-medium">{announcement.title}</p>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{announcement.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {leave.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Pengajuan Terakhir</CardTitle>
              <CardDescription>Status izin, sakit, atau cuti Anda.</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/siswa/pengajuan">Kelola</Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y">
            {leave.slice(0, 3).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {LEAVE_TYPE_LABEL[row.type] ?? row.type} - {formatDate(row.start_date)} s.d.{" "}
                    {formatDate(row.end_date)}
                  </p>
                  {row.decision_note ? (
                    <p className="text-xs text-muted-foreground">{row.decision_note}</p>
                  ) : null}
                </div>
                <StatusBadge
                  label={LEAVE_STATUS_LABEL[row.status as LeaveStatus]}
                  className={LEAVE_STATUS_CLASS[row.status as LeaveStatus]}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {attendance.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rekap Presensi Saya</CardTitle>
            <CardDescription>Akumulasi seluruh catatan presensi.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {(Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[]).map((status) => (
              <div key={status} className="flex items-center gap-2">
                <StatusBadge label={ATTENDANCE_LABEL[status]} className={ATTENDANCE_CLASS[status]} />
                <span className="text-sm font-medium">{counts[status] ?? 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof GraduationCap
  label: string
  value: string
}) {
  return (
    <div className="space-y-1">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}
