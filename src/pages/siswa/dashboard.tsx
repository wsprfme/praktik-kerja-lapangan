import { Link } from "react-router-dom"
import {
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  LogOut,
  Megaphone,
  UserRound,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { ErrorState, LoadingState } from "@/components/page-states"
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
  fetchHolidays,
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
  formatDayName,
  formatDuration,
  formatTime,
  shiftISODate,
  todayISO,
} from "@/lib/format"
import type { AttendanceStatus, LeaveStatus, ReviewStatus } from "@/lib/types"

export function SiswaDashboard() {
  const { profile } = useAuth()
  const today = todayISO()

  const data = useAsyncData(
    async () => {
      if (!profile) {
        return { overview: null, attendance: [], journals: [], leave: [], assessment: null, announcements: [], holidays: [] }
      }
      const [overview, attendance, journals, leave, assessments, announcements, holidays] = await Promise.all([
        fetchStudentOverview(profile.id),
        fetchAttendance({ studentId: profile.id }),
        fetchJournals({ studentId: profile.id }),
        fetchLeaveRequests({ studentId: profile.id }),
        fetchAssessments([profile.id]),
        fetchAnnouncements(),
        fetchHolidays(),
      ])
      return { overview, attendance, journals, leave, assessment: assessments[0] ?? null, announcements, holidays }
    },
    { overview: null, attendance: [], journals: [], leave: [], assessment: null, announcements: [], holidays: [] },
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

  const { overview, attendance, journals, leave, assessment, announcements, holidays } = data.data
  const todayAttendance = attendance.find((a) => a.date === today) ?? null
  const yesterday = shiftISODate(today, -1)
  const yesterdayAttendance = attendance.find((a) => a.date === yesterday) ?? null
  const hasTodayJournal = journals.some((j) => j.date === today)
  const todayHoliday = holidays.find((h) => h.date === today) ?? null
  const counts = attendance.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1
    return acc
  }, {})
  const recentJournals = journals.slice(0, 3)
  const firstName = overview?.profile.full_name.split(" ")[0] ?? profile?.full_name.split(" ")[0] ?? "Siswa"

  const placement = overview?.placement ?? null
  const notPlaced = !placement || !overview?.company || !overview?.supervisor
  const placementActive =
    !!placement && !!overview?.company && !!overview?.supervisor && placement.status === "aktif"
  // Minggu dihitung hari kerja opsional: ada yang libur, ada yang piket/shift.
  const isWorkday = placementActive && !todayHoliday

  // Tugas yang benar-benar bisa diklik — hanya ini yang berbentuk tombol.
  const attention: { icon: typeof CalendarCheck; title: string; desc: string; to: string; primary: boolean }[] = []
  if (placementActive && isWorkday && !todayAttendance) {
    attention.push({
      icon: CalendarCheck,
      title: "Isi presensi hari ini",
      desc: `${formatDayName(today)}, ${formatDate(today)} — foto + lokasi`,
      to: "/siswa/presensi",
      primary: true,
    })
  }
  if (
    placementActive &&
    yesterdayAttendance &&
    yesterdayAttendance.status === "hadir" &&
    !yesterdayAttendance.check_out_time
  ) {
    attention.push({
      icon: LogOut,
      title: "Absen pulang kemarin",
      desc: `${formatDate(yesterday)} — ketuk untuk mencatat jam pulang`,
      to: "/siswa/presensi",
      primary: attention.length === 0,
    })
  }
  if (placementActive && isWorkday && !hasTodayJournal) {
    attention.push({
      icon: BookOpen,
      title: "Tulis jurnal hari ini",
      desc: "Catat kegiatan PKL Anda",
      to: "/siswa/jurnal",
      primary: attention.length === 0,
    })
  }

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
      {/* Kartu utama: sapaan + tempat PKL. Selalu paling atas. */}
      {notPlaced ? (
        <Card className="gap-0 overflow-hidden border-0 bg-primary py-0 text-primary-foreground shadow-lg shadow-primary/20">
          <CardContent className="space-y-3 p-5">
            <div className="space-y-0.5">
              <p className="text-xs opacity-80">Selamat datang kembali,</p>
              <h1 className="text-xl font-semibold tracking-tight">{firstName}</h1>
              <p className="text-xs opacity-80">
                {formatDayName(today)}, {formatDate(today)}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-primary-foreground/10 p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
                <Building2 className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Menunggu tempat PKL</p>
                <p className="text-xs opacity-80">
                  Admin belum mengatur tempat, pembimbing, atau periode Anda. Presensi dan jurnal
                  aktif setelah semuanya lengkap.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden border-0 bg-primary py-0 text-primary-foreground shadow-lg shadow-primary/20">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs opacity-80">Selamat datang kembali,</p>
                <h1 className="truncate text-xl font-semibold tracking-tight">{firstName}</h1>
                <p className="text-xs opacity-80">
                  {formatDayName(today)}, {formatDate(today)}
                </p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
                <Building2 className="size-5" />
              </span>
            </div>

            <div className="space-y-1 rounded-xl bg-primary-foreground/10 p-3">
              <p className="text-xs opacity-80">Tempat PKL</p>
              <p className="truncate text-base font-semibold">{overview?.company?.name ?? "-"}</p>
              <p className="flex items-center gap-1.5 text-xs opacity-90">
                <UserRound className="size-3.5 shrink-0" />
                <span className="truncate">Pembimbing {overview?.supervisor?.full_name ?? "-"}</span>
              </p>
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

      {/* Tugas yang bisa diklik — SELALU berbentuk tombol (chevron kanan).
          Kartu info di bawahnya TIDAK PERNAH bisa diklik: tanpa chevron,
          tanpa efek tekan. */}
      {attention.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Yang harus dilakukan</p>
          <div className="space-y-2">
            {attention.map((item) => (
              <Link
                key={item.title}
                to={item.to}
                className={
                  item.primary
                    ? "flex items-center gap-3 rounded-xl bg-primary px-4 py-3.5 text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-[0.99]"
                    : "flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors active:bg-accent"
                }
              >
                <span
                  className={
                    item.primary
                      ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15"
                      : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                  }
                >
                  <item.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.title}</span>
                  <span
                    className={
                      item.primary
                        ? "block truncate text-xs opacity-80"
                        : "block truncate text-xs text-muted-foreground"
                    }
                  >
                    {item.desc}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 opacity-70" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {placementActive && !isWorkday ? (
        <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground">
            <CalendarDays className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Hari libur</p>
            <p className="truncate text-xs text-muted-foreground">
              {todayHoliday?.name ?? "Libur"} — tidak ada tugas presensi dan jurnal.
            </p>
          </div>
        </div>
      ) : null}

      {/* Kartu info: sengaja TIDAK bisa diklik (tanpa chevron & efek tekan)
          agar tidak dikira tombol seperti dulu. */}
      {!notPlaced ? (
        <Card className="gap-0 border py-0">
          <CardContent className="space-y-2.5 p-4">
            <p className="text-sm font-semibold">Status hari ini</p>
            <dl className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted-foreground">Presensi masuk</dt>
                <dd className="font-semibold">
                  {todayAttendance ? ATTENDANCE_LABEL[todayAttendance.status as AttendanceStatus] : "Belum diisi"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted-foreground">Presensi keluar</dt>
                <dd className="font-semibold">
                  {todayAttendance?.check_out_time
                    ? formatTime(todayAttendance.check_out_time)
                    : todayAttendance
                      ? "Belum"
                      : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-muted-foreground">Jurnal</dt>
                <dd className="font-semibold">{hasTodayJournal ? "Sudah diisi" : "Belum diisi"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : null}

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
