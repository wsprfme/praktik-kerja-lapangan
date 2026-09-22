import { useState } from "react"
import { BookOpen, CalendarCheck, Download, Search } from "lucide-react"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchAttendance, fetchJournals, fetchStudentOverviews } from "@/lib/queries"
import {
  ATTENDANCE_CLASS,
  ATTENDANCE_LABEL,
  REVIEW_CLASS,
  REVIEW_LABEL,
  formatDate,
  formatDuration,
  formatTime,
  todayISO,
} from "@/lib/format"
import type { AttendanceStatus, ReviewStatus, StudentOverview } from "@/lib/types"

export function AdminMonitoringPage() {
  const [date, setDate] = useState(todayISO())
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [query, setQuery] = useState("")

  const data = useAsyncData(
    async () => {
      const monthStart = `${month}-01`
      const monthEnd = new Date(
        Number(month.slice(0, 4)),
        Number(month.slice(5, 7)),
        0,
      )
        .toISOString()
        .slice(0, 10)
      const [overviews, dayAttendance, monthJournals] = await Promise.all([
        fetchStudentOverviews(),
        fetchAttendance({ from: date, to: date }),
        fetchJournals({ from: monthStart, to: monthEnd }),
      ])
      return { overviews, dayAttendance, monthJournals }
    },
    { overviews: [] as StudentOverview[], dayAttendance: [], monthJournals: [] },
    [date, month],
  )

  const attendanceMap = new Map(data.data.dayAttendance.map((row) => [row.student_id, row]))
  const journalCounts = data.data.monthJournals.reduce<Record<string, number>>((acc, journal) => {
    acc[journal.student_id] = (acc[journal.student_id] ?? 0) + 1
    return acc
  }, {})

  const filtered = data.data.overviews.filter((row) => {
    const term = query.trim().toLowerCase()
    if (!term) return true
    return (
      row.profile.full_name.toLowerCase().includes(term) ||
      (row.detail?.class_name ?? "").toLowerCase().includes(term) ||
      (row.supervisor?.full_name ?? "").toLowerCase().includes(term)
    )
  })

  const exportCsv = () => {
    const header = ["Nama", "Kelas", "Pembimbing", "Status Presensi", "Jam Masuk", "Jam Keluar", "Jurnal Bulan Ini"]
    const lines = filtered.map((row) => {
      const attendance = attendanceMap.get(row.profile.id)
      return [
        row.profile.full_name,
        row.detail?.class_name ?? "",
        row.supervisor?.full_name ?? "",
        attendance ? ATTENDANCE_LABEL[attendance.status as AttendanceStatus] : "Belum presensi",
        formatTime(attendance?.check_in_time ?? null),
        formatTime(attendance?.check_out_time ?? null),
        String(journalCounts[row.profile.id] ?? 0),
      ]
    })
    const csv = [header, ...lines].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `pemantauan-pkl-${date}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Presensi & Jurnal" description="Pantau kehadiran harian dan kedisiplinan jurnal seluruh siswa.">
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download />
          Ekspor CSV
        </Button>
      </PageHeader>

      <Tabs defaultValue="harian">
        <TabsList>
          <TabsTrigger value="harian">Rekap Harian</TabsTrigger>
          <TabsTrigger value="jurnal">Rekap Jurnal Bulanan</TabsTrigger>
        </TabsList>

        <TabsContent value="harian" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
            <div className="relative w-full sm:w-72">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari siswa atau pembimbing..."
                className="pl-9"
              />
            </div>
          </div>

          {data.loading ? (
            <LoadingState rows={5} />
          ) : data.error ? (
            <ErrorState message={data.error} onRetry={data.reload} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={query ? "Tidak ada hasil" : "Belum ada siswa"}
              description={query ? "Coba kata kunci lain." : "Akun siswa belum dibuat."}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Presensi {formatDate(date)}</CardTitle>
                <CardDescription>
                  {data.data.dayAttendance.length} dari {filtered.length} siswa sudah tercatat.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <div className="min-w-[42rem] divide-y">
                  {filtered.map((row) => {
                    const attendance = attendanceMap.get(row.profile.id)
                    return (
                      <div key={row.profile.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{row.profile.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.detail?.class_name ?? "-"} - {row.company?.name ?? "Tanpa perusahaan"}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1 text-sm">
                          <p>Pembimbing: {row.supervisor?.full_name ?? "-"}</p>
                          <p className="text-xs text-muted-foreground">
                            Masuk {formatTime(attendance?.check_in_time ?? null)} - Keluar{" "}
                            {formatTime(attendance?.check_out_time ?? null)}
                          </p>
                        </div>
                        <StatusBadge
                          label={attendance ? ATTENDANCE_LABEL[attendance.status as AttendanceStatus] : "Belum Presensi"}
                          className={
                            attendance
                              ? ATTENDANCE_CLASS[attendance.status as AttendanceStatus]
                              : "bg-muted text-muted-foreground border-border"
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="jurnal" className="mt-4 space-y-4">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-48"
          />

          {data.loading ? (
            <LoadingState rows={5} />
          ) : data.error ? (
            <ErrorState message={data.error} onRetry={data.reload} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Belum ada siswa"
              description="Rekap jurnal akan tampil setelah akun siswa dibuat."
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Jurnal Periode {month}</CardTitle>
                <CardDescription>
                  {data.data.monthJournals.length} jurnal terkumpul dari {filtered.length} siswa.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <div className="min-w-[42rem] divide-y">
                  {filtered.map((row) => {
                    const journals = data.data.monthJournals.filter((j) => j.student_id === row.profile.id)
                    const pending = journals.filter((j) => j.review_status === "menunggu").length
                    const totalMinutes = journals.reduce((sum, j) => sum + (j.duration_minutes ?? 0), 0)
                    return (
                      <div key={row.profile.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{row.profile.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.detail?.class_name ?? "-"} - {row.supervisor?.full_name ?? "Tanpa pembimbing"}
                          </p>
                        </div>
                        <div className="text-sm">
                          <p>{journals.length} jurnal</p>
                          <p className="text-xs text-muted-foreground">{formatDuration(totalMinutes)} total</p>
                        </div>
                        <StatusBadge
                          label={pending > 0 ? `${pending} menunggu` : "Semua ditinjau"}
                          className={
                            pending > 0
                              ? REVIEW_CLASS.menunggu
                              : REVIEW_CLASS[("ditinjau" as ReviewStatus) as ReviewStatus]
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Gunakan filter tanggal untuk memeriksa hari tertentu, atau bulan untuk melihat konsistensi pengisian
        jurnal. Status tinjauan: {REVIEW_LABEL.menunggu} atau {REVIEW_LABEL.ditinjau}.
      </p>
    </div>
  )
}
