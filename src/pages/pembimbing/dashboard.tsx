import { Link } from "react-router-dom"
import { BookOpen, CalendarCheck, ClipboardList, GraduationCap, UserRoundX } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchAttendance, fetchJournals, fetchLeaveRequests, fetchStudentOverviews } from "@/lib/queries"
import {
  ATTENDANCE_CLASS,
  ATTENDANCE_LABEL,
  LEAVE_STATUS_CLASS,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  formatDate,
  formatTime,
  todayISO,
} from "@/lib/format"
import type { AttendanceStatus, LeaveStatus, StudentOverview } from "@/lib/types"

export function PembimbingDashboard() {
  const { profile } = useAuth()
  const today = todayISO()

  const data = useAsyncData(
    async () => {
      if (!profile) {
        return { overviews: [] as StudentOverview[], attendance: [], journals: [], leave: [] }
      }
      const overviews = await fetchStudentOverviews()
      const ids = overviews.map((o) => o.profile.id)
      if (ids.length === 0) {
        return { overviews, attendance: [], journals: [], leave: [] }
      }
      const [attendance, journals, leave] = await Promise.all([
        fetchAttendance({ from: today, to: today }),
        fetchJournals(),
        fetchLeaveRequests({ status: "menunggu" }),
      ])
      return {
        overviews,
        attendance: attendance.filter((a) => ids.includes(a.student_id)),
        journals: journals.filter((j) => ids.includes(j.student_id)),
        leave: leave.filter((l) => ids.includes(l.student_id)),
      }
    },
    { overviews: [] as StudentOverview[], attendance: [], journals: [], leave: [] },
    [profile?.id],
  )

  const { overviews, attendance, journals, leave } = data.data
  const attendanceMap = new Map(attendance.map((a) => [a.student_id, a]))
  const notCheckedIn = overviews.filter((o) => !attendanceMap.has(o.profile.id))
  const pendingJournals = journals.filter((j) => j.review_status === "menunggu")

  if (data.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard Pembimbing" description="Ringkasan siswa bimbingan Anda." />
        <LoadingState rows={5} />
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard Pembimbing" description="Ringkasan siswa bimbingan Anda." />
        <ErrorState message={data.error} onRetry={data.reload} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Pembimbing"
        description="Pantau presensi, jurnal, dan pengajuan siswa bimbingan Anda."
      >
        <Button asChild variant="outline">
          <Link to="/pembimbing/siswa">Lihat Siswa</Link>
        </Button>
      </PageHeader>

      {overviews.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Belum ada siswa bimbingan"
          description="Admin belum menugaskan siswa kepada Anda. Silakan hubungi Admin untuk penugasan."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Siswa Bimbingan" value={overviews.length} icon={GraduationCap} />
            <StatCard label="Hadir Hari Ini" value={attendance.filter((a) => a.status === "hadir").length} icon={CalendarCheck} tone="positive" />
            <StatCard
              label="Belum Presensi"
              value={notCheckedIn.length}
              icon={UserRoundX}
              tone={notCheckedIn.length > 0 ? "warning" : "positive"}
            />
            <StatCard
              label="Jurnal Menunggu"
              value={pendingJournals.length}
              icon={BookOpen}
              tone={pendingJournals.length > 0 ? "warning" : "positive"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Presensi Hari Ini</CardTitle>
                <CardDescription>{formatDate(today)}</CardDescription>
              </CardHeader>
              <CardContent>
                {attendance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada presensi tercatat hari ini.</p>
                ) : (
                  <div className="divide-y">
                    {attendance.map((row) => {
                      const student = overviews.find((o) => o.profile.id === row.student_id)
                      return (
                        <div key={row.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {student?.profile.full_name ?? "Siswa"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Masuk {formatTime(row.check_in_time)} - Keluar {formatTime(row.check_out_time)}
                            </p>
                          </div>
                          <StatusBadge
                            label={ATTENDANCE_LABEL[row.status as AttendanceStatus]}
                            className={ATTENDANCE_CLASS[row.status as AttendanceStatus]}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    <CardTitle className="text-base">Perlu Tindakan</CardTitle>
                    <CardDescription>Jurnal dan pengajuan yang menunggu Anda.</CardDescription>
                  </div>
                  <Button asChild size="sm" variant="outline" className="w-fit">
                    <Link to="/pembimbing/jurnal">Tinjau</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Belum Presensi ({notCheckedIn.length})
                  </p>
                  {notCheckedIn.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Semua siswa sudah presensi hari ini.</p>
                  ) : (
                    <ul className="divide-y">
                      {notCheckedIn.slice(0, 4).map((row) => (
                        <li key={row.profile.id} className="py-2 text-sm first:pt-0 last:pb-0">{row.profile.full_name}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Pengajuan Menunggu ({leave.length})
                  </p>
                  {leave.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada pengajuan menunggu.</p>
                  ) : (
                    <ul className="divide-y">
                      {leave.slice(0, 4).map((row) => {
                        const student = overviews.find((o) => o.profile.id === row.student_id)
                        return (
                          <li key={row.id} className="flex items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
                            <span className="truncate">
                              {student?.profile.full_name ?? "Siswa"} - {LEAVE_TYPE_LABEL[row.type] ?? row.type}
                            </span>
                            <StatusBadge
                              label={LEAVE_STATUS_LABEL[row.status as LeaveStatus]}
                              className={LEAVE_STATUS_CLASS[row.status as LeaveStatus]}
                            />
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="text-base">Progres Siswa Bimbingan</CardTitle>
                  <CardDescription>Status penempatan dan jumlah jurnal per siswa.</CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="w-fit">
                  <Link to="/pembimbing/siswa">
                    <ClipboardList />
                    Detail
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {overviews.map((row) => {
                  const journalCount = journals.filter((j) => j.student_id === row.profile.id).length
                  return (
                    <div key={row.profile.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-medium">{row.profile.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.company?.name ?? "Tanpa perusahaan"} - {row.detail?.class_name ?? "-"}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">{journalCount} jurnal</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
