import { Link } from "react-router-dom"
import {
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  Megaphone,
  UserRound,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { EmptyState, ErrorState, LoadingState } from "@/components/page-states"
import { ScreenHeader } from "@/components/mobile-ui"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
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
  todayISO,
} from "@/lib/format"
import type { AttendanceStatus, LeaveStatus, ReviewStatus } from "@/lib/types"

const QUICK_ACTIONS = [
  { label: "Presensi", to: "/siswa/presensi", icon: CalendarCheck },
  { label: "Jurnal", to: "/siswa/jurnal", icon: BookOpen },
  { label: "Izin", to: "/siswa/pengajuan", icon: FileText },
  { label: "Nilai", to: "/siswa/nilai", icon: GraduationCap },
]

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
      <div className="space-y-5">
        <ScreenHeader title="Beranda" description="Ringkasan kegiatan PKL Anda." />
        <LoadingState rows={5} />
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="space-y-5">
        <ScreenHeader title="Beranda" description="Ringkasan kegiatan PKL Anda." />
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
  const firstName = overview?.profile.full_name.split(" ")[0] ?? profile?.full_name.split(" ")[0] ?? "Siswa"

  const placement = overview?.placement ?? null
  const notPlaced = !placement || !overview?.company || !overview?.supervisor

  let totalDays: number | null = null
  let remainingDays: number | null = null
  if (placement?.end_date) {
    const todayTime = new Date(`${today}T00:00:00`).getTime()
    const endTime = new Date(`${placement.end_date}T00:00:00`).getTime()
    if (!Number.isNaN(endTime)) {
      remainingDays = Math.max(0, Math.ceil((endTime - todayTime) / 86400000))
    }
    if (placement.start_date) {
      totalDays = Math.max(1, daysBetween(placement.start_date, placement.end_date))
    }
  }
  const progressValue =
    totalDays && remainingDays !== null ? Math.round(((totalDays - remainingDays) / totalDays) * 100) : 0

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Selamat datang kembali,</p>
        <h1 className="text-2xl font-semibold tracking-tight">{firstName}</h1>
        <p className="text-xs text-muted-foreground">{formatDate(today)}</p>
      </div>

      {notPlaced ? (
        <EmptyState
          icon={Building2}
          title="Menunggu penempatan PKL"
          description="Admin belum melengkapi data perusahaan, pembimbing, atau periode PKL Anda. Presensi dan jurnal akan aktif setelah penempatan ditetapkan."
        />
      ) : (
        <Card className="gap-0 overflow-hidden border-0 bg-primary py-0 text-primary-foreground shadow-lg shadow-primary/20">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs/relaxed opacity-80">Penempatan PKL</p>
                <p className="truncate text-lg font-semibold">{overview?.company?.name ?? "-"}</p>
                <p className="flex items-center gap-1.5 text-xs opacity-90">
                  <UserRound className="size-3.5 shrink-0" />
                  <span className="truncate">Pembimbing {overview?.supervisor?.full_name ?? "-"}</span>
                </p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
                <Building2 className="size-5" />
              </span>
            </div>

            {totalDays ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs opacity-90">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    {formatDate(placement!.start_date)} - {formatDate(placement!.end_date)}
                  </span>
                  <span className="font-medium">
                    {remainingDays === null ? "-" : `${remainingDays} hari lagi`}
                  </span>
                </div>
                <Progress
                  value={progressValue}
                  className="h-2 bg-primary-foreground/20 [&>[data-slot=progress-indicator]]:bg-primary-foreground"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="gap-0 border py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                todayAttendance?.status === "hadir"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <CalendarCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Presensi hari ini</p>
              <p className="truncate text-sm font-semibold">
                {todayAttendance ? ATTENDANCE_LABEL[todayAttendance.status as AttendanceStatus] : "Belum diisi"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0 border py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <Clock className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total hadir</p>
              <p className="text-sm font-semibold">{counts.hadir ?? 0} hari</p>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0 border py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-400">
              <BookOpen className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Jurnal terkumpul</p>
              <p className="text-sm font-semibold">{journals.length} jurnal</p>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0 border py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                pendingLeave > 0
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <FileText className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Pengajuan</p>
              <p className="text-sm font-semibold">{pendingLeave} menunggu</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Aksi cepat</p>
        <div className="grid grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="flex flex-col items-center gap-2 rounded-xl border bg-card py-3 transition-colors active:bg-accent"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <action.icon className="size-5" />
              </span>
              <span className="text-xs font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <SectionCard
        title="Jurnal terbaru"
        actionTo="/siswa/jurnal"
        actionLabel="Semua"
        empty={recentJournals.length === 0}
        emptyText="Belum ada jurnal. Mulai catat kegiatan harian Anda."
      >
        {recentJournals.map((journal, index) => (
          <div key={journal.id}>
            {index > 0 ? <Separator /> : null}
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{journal.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(journal.date)} - {formatDuration(journal.duration_minutes)}
                </p>
              </div>
              <StatusBadge
                className={cn("shrink-0", REVIEW_CLASS[journal.review_status as ReviewStatus])}
                label={REVIEW_LABEL[journal.review_status as ReviewStatus]}
              />
            </div>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="Hasil & pengumuman" actionTo="/siswa/pengumuman" actionLabel="Semua">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Nilai akhir PKL</p>
            {assessment && assessment.final_score !== null ? (
              <p className="text-sm font-semibold">
                {assessment.final_score}
                {assessment.predicate ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {assessment.predicate} - {PREDICATE_LABEL[assessment.predicate]}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Belum dinilai pembimbing.</p>
            )}
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/siswa/nilai">Lihat</Link>
          </Button>
        </div>

        {announcements.length === 0 ? (
          <p className="pt-3 text-sm text-muted-foreground">Belum ada pengumuman.</p>
        ) : (
          <ul className="divide-y">
            {announcements.slice(0, 2).map((announcement) => (
              <li key={announcement.id} className="py-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="size-3.5 shrink-0 text-primary" />
                  <p className="truncate text-sm font-medium">{announcement.title}</p>
                </div>
                <p className="mt-0.5 line-clamp-1 pl-[22px] text-xs text-muted-foreground">{announcement.body}</p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {leave.length > 0 ? (
        <SectionCard title="Pengajuan terakhir" actionTo="/siswa/pengajuan" actionLabel="Semua">
          {leave.slice(0, 3).map((row, index) => (
            <div key={row.id}>
              {index > 0 ? <Separator /> : null}
              <div className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {LEAVE_TYPE_LABEL[row.type] ?? row.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(row.start_date)} - {formatDate(row.end_date)}
                  </p>
                </div>
                <StatusBadge
                  className={cn("shrink-0", LEAVE_STATUS_CLASS[row.status as LeaveStatus])}
                  label={LEAVE_STATUS_LABEL[row.status as LeaveStatus]}
                />
              </div>
            </div>
          ))}
        </SectionCard>
      ) : null}

      {attendance.length > 0 ? (
        <SectionCard title="Rekap presensi">
          <div className="grid grid-cols-2 gap-3 pt-1">
            {(Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[]).map((status) => (
              <div
                key={status}
                className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2.5"
              >
                <StatusBadge label={ATTENDANCE_LABEL[status]} className={ATTENDANCE_CLASS[status]} />
                <span className="text-sm font-semibold">{counts[status] ?? 0}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  )
}

function SectionCard({
  title,
  actionTo,
  actionLabel,
  children,
  empty,
  emptyText,
}: {
  title: string
  actionTo?: string
  actionLabel?: string
  children?: React.ReactNode
  empty?: boolean
  emptyText?: string
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{title}</p>
          {actionTo && actionLabel ? (
            <Link
              to={actionTo}
              className="flex items-center gap-1 text-xs font-medium text-primary active:opacity-70"
            >
              {actionLabel}
              <ChevronRight className="size-3.5" />
            </Link>
          ) : null}
        </div>
        {empty ? <p className="text-sm text-muted-foreground">{emptyText}</p> : children}
      </CardContent>
    </Card>
  )
}
