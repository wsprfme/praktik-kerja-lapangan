import { Building2, CalendarDays, ClipboardList, GraduationCap, UserCheck, Users, XCircle } from "lucide-react"
import { Link } from "react-router-dom"
import { PageHeader, ErrorState, LoadingState, EmptyState } from "@/components/page-states"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAsyncData } from "@/hooks/use-async-data"
import {
  countStatuses,
  fetchAttendance,
  fetchCompanies,
  fetchJournals,
  fetchLeaveRequests,
  fetchPeriods,
  fetchProfilesByRole,
  fetchStudentOverviews,
} from "@/lib/queries"
import { ATTENDANCE_LABEL, todayISO } from "@/lib/format"
import { ATTENDANCE_CLASS } from "@/lib/format"
import type { AttendanceStatus } from "@/lib/types"

export function AdminDashboard() {
  const today = todayISO()

  const data = useAsyncData(
    async () => {
      const [students, supervisors, companies, periods, attendance, journals, leave] = await Promise.all([
        fetchProfilesByRole("siswa"),
        fetchProfilesByRole("pembimbing"),
        fetchCompanies(),
        fetchPeriods(),
        fetchAttendance({ from: today, to: today }),
        fetchJournals(),
        fetchLeaveRequests({ status: "menunggu" }),
      ])
      const overviews = await fetchStudentOverviews()
      return {
        students,
        supervisors,
        companies,
        periods,
        attendance,
        journals,
        leave,
        overviews,
      }
    },
    null,
  )

  if (data.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard Admin" description="Ringkasan kondisi program PKL." />
        <LoadingState rows={5} />
      </div>
    )
  }

  if (data.error || !data.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard Admin" description="Ringkasan kondisi program PKL." />
        <ErrorState message={data.error ?? "Data tidak tersedia."} onRetry={data.reload} />
      </div>
    )
  }

  const { students, supervisors, companies, periods, attendance, journals, leave, overviews } = data.data
  const activeStudents = students.filter((s) => s.is_active)
  const activeCompanies = companies.filter((c) => c.is_active)
  const activePeriod = periods.find((p) => p.is_active) ?? null

  const statusCounts = countStatuses(attendance)
  const presentToday = statusCounts.hadir ?? 0
  const notCheckedIn = activeStudents.length - attendance.length
  const pendingJournals = journals.filter((j) => j.review_status === "menunggu").length

  const notPlaced = overviews.filter((o) => !o.placement || !o.company || !o.supervisor)

  const byCompany = activeCompanies
    .map((company) => ({
      company,
      total: overviews.filter((o) => o.company?.id === company.id).length,
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Admin"
        description={
          activePeriod
            ? `Periode aktif: ${activePeriod.name} (${activePeriod.academic_year})`
            : "Belum ada periode PKL aktif."
        }
      >
        <Button asChild variant="outline">
          <Link to="/admin/laporan">Lihat Laporan</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Siswa Aktif" value={activeStudents.length} icon={GraduationCap} hint={`${students.length} total siswa`} />
        <StatCard label="Hadir Hari Ini" value={presentToday} icon={UserCheck} tone="positive" />
        <StatCard label="Belum Presensi" value={Math.max(0, notCheckedIn)} icon={XCircle} tone={notCheckedIn > 0 ? "warning" : "positive"} />
        <StatCard label="Pengajuan Menunggu" value={leave.length} icon={ClipboardList} tone={leave.length > 0 ? "warning" : "positive"} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pembimbing" value={supervisors.filter((s) => s.is_active).length} icon={UserCheck} tone="info" hint={`${supervisors.length} total`} />
        <StatCard label="Perusahaan Mitra" value={activeCompanies.length} icon={Building2} hint={`${companies.length} total`} />
        <StatCard label="Jurnal Menunggu" value={pendingJournals} icon={ClipboardList} tone={pendingJournals > 0 ? "warning" : "positive"} />
        <StatCard label="Periode PKL" value={periods.length} icon={CalendarDays} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-base">Presensi Hari Ini</CardTitle>
            <CardDescription>Rekap status kehadiran siswa pada {today}.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada presensi tercatat hari ini.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {(Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[]).map((status) => (
                <div key={status} className="flex items-center gap-2">
                  <StatusBadge label={ATTENDANCE_LABEL[status]} className={ATTENDANCE_CLASS[status]} />
                  <span className="text-sm font-medium">{statusCounts[status] ?? 0}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Sebaran Siswa per Perusahaan</CardTitle>
              <CardDescription>Jumlah siswa yang ditempatkan di setiap mitra.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {byCompany.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada penempatan siswa.</p>
            ) : (
              <ul className="divide-y">
                {byCompany.map((row) => (
                  <li key={row.company.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.company.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.company.field_of_work ?? "Bidang kerja belum diisi"}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">{row.total} siswa</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Perlu Tindakan</CardTitle>
              <CardDescription>Siswa yang belum lengkap data penempatannya.</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/penempatan">Kelola</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {notPlaced.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Semua siswa sudah memiliki perusahaan dan pembimbing.
              </p>
            ) : (
              <ul className="divide-y">
                {notPlaced.slice(0, 6).map((row) => (
                  <li key={row.profile.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.profile.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.detail?.class_name ?? "Kelas belum diisi"}
                      </p>
                    </div>
                    <StatusBadge
                      label={!row.placement ? "Belum ditempatkan" : !row.company ? "Tanpa perusahaan" : "Tanpa pembimbing"}
                      className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada akun siswa"
          description="Mulai dengan membuat akun siswa di menu Akun Pengguna, lalu tempatkan mereka pada perusahaan dan pembimbing."
        >
          <Button asChild>
            <Link to="/admin/akun">Buat Akun</Link>
          </Button>
        </EmptyState>
      ) : null}
    </div>
  )
}
