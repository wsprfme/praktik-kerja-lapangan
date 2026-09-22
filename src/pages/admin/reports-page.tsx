import { useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import { Download, Printer } from "lucide-react"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAsyncData } from "@/hooks/use-async-data"
import {
  fetchAssessments,
  fetchAttendance,
  fetchJournals,
  fetchLeaveRequests,
  fetchPeriods,
  fetchProfilesByRole,
  fetchStudentOverviews,
} from "@/lib/queries"
import { ATTENDANCE_LABEL, PREDICATE_LABEL, formatDate, monthLabel, todayISO } from "@/lib/format"
import type { Journal, StudentOverview } from "@/lib/types"

const attendanceConfig = {
  hadir: { label: "Hadir", color: "var(--chart-2)" },
  izin: { label: "Izin", color: "var(--chart-4)" },
  sakit: { label: "Sakit", color: "var(--chart-1)" },
  alpa: { label: "Alpa", color: "var(--chart-5)" },
} satisfies ChartConfig

const leaveConfig = {
  disetujui: { label: "Disetujui", color: "var(--chart-2)" },
  menunggu: { label: "Menunggu", color: "var(--chart-4)" },
  ditolak: { label: "Ditolak", color: "var(--chart-5)" },
} satisfies ChartConfig

export function AdminReportsPage() {
  const [month, setMonth] = useState(todayISO().slice(0, 7))

  const data = useAsyncData(
    async () => {
      const monthStart = `${month}-01`
      const monthEnd = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
        .toISOString()
        .slice(0, 10)
      const [overviews, attendance, journals, leave, assessments, periods, supervisors] = await Promise.all([
        fetchStudentOverviews(),
        fetchAttendance({ from: monthStart, to: monthEnd }),
        fetchJournals({ from: monthStart, to: monthEnd }),
        fetchLeaveRequests(),
        fetchAssessments(),
        fetchPeriods(),
        fetchProfilesByRole("pembimbing"),
      ])
      return {
        overviews,
        attendance,
        journals,
        leave,
        assessments,
        periodName: periods.find((p) => p.is_active)?.name ?? "Semua periode",
        supervisorCount: supervisors.length,
      }
    },
    {
      overviews: [] as StudentOverview[],
      attendance: [],
      journals: [] as Journal[],
      leave: [],
      assessments: [],
      periodName: "",
      supervisorCount: 0,
    },
    [month],
  )

  const rows = data.data.overviews.map((student) => {
    const studentAttendance = data.data.attendance.filter((a) => a.student_id === student.profile.id)
    const studentJournals = data.data.journals.filter((j) => j.student_id === student.profile.id)
    const studentLeave = data.data.leave.filter((l) => l.student_id === student.profile.id)
    const assessment = data.data.assessments.find((a) => a.student_id === student.profile.id) ?? null
    const counts = studentAttendance.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1
      return acc
    }, {})
    return {
      student,
      hadir: counts.hadir ?? 0,
      izin: counts.izin ?? 0,
      sakit: counts.sakit ?? 0,
      alpa: counts.alpa ?? 0,
      total: studentAttendance.length,
      journals: studentJournals.length,
      reviewed: studentJournals.filter((j) => j.review_status === "ditinjau").length,
      leaveApproved: studentLeave.filter((l) => l.status === "disetujui").length,
      leavePending: studentLeave.filter((l) => l.status === "menunggu").length,
      leaveRejected: studentLeave.filter((l) => l.status === "ditolak").length,
      finalScore: assessment?.final_score ?? null,
      predicate: assessment?.predicate ?? null,
    }
  })

  const attendanceChart = rows.map((row) => ({
    name: row.student.profile.full_name.split(" ")[0] ?? row.student.profile.full_name,
    hadir: row.hadir,
    izin: row.izin,
    sakit: row.sakit,
    alpa: row.alpa,
  }))

  const leavePie = [
    { key: "disetujui", value: rows.reduce((s, r) => s + r.leaveApproved, 0) },
    { key: "menunggu", value: rows.reduce((s, r) => s + r.leavePending, 0) },
    { key: "ditolak", value: rows.reduce((s, r) => s + r.leaveRejected, 0) },
  ].filter((item) => item.value > 0)

  const exportCsv = () => {
    const header = [
      "Nama",
      "Kelas",
      "Pembimbing",
      "Hadir",
      "Izin",
      "Sakit",
      "Alpa",
      "Total Presensi",
      "Jurnal",
      "Jurnal Ditinjau",
      "Izin Disetujui",
      "Nilai Akhir",
      "Predikat",
    ]
    const lines = rows.map((row) => [
      row.student.profile.full_name,
      row.student.detail?.class_name ?? "",
      row.student.supervisor?.full_name ?? "",
      String(row.hadir),
      String(row.izin),
      String(row.sakit),
      String(row.alpa),
      String(row.total),
      String(row.journals),
      String(row.reviewed),
      String(row.leaveApproved),
      row.finalScore === null ? "" : String(row.finalScore),
      row.predicate ?? "",
    ])
    const csv = [header, ...lines].map((line) => line.map((c) => `"${c}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `laporan-pkl-${month}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan & Ekspor"
        description={`Rekap ${monthLabel(month)} - ${data.data.periodName}`}
      >
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-40"
        />
        <Button variant="outline" onClick={() => window.print()}>
          <Printer />
          Cetak
        </Button>
        <Button onClick={exportCsv} disabled={rows.length === 0}>
          <Download />
          Ekspor CSV
        </Button>
      </PageHeader>

      {data.loading ? (
        <LoadingState rows={6} />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Download}
          title="Belum ada data untuk dilaporkan"
          description="Laporan tersedia setelah siswa memiliki presensi dan jurnal."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Rekap Presensi per Siswa</CardTitle>
                <CardDescription>Periode {monthLabel(month)}</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={attendanceConfig} className="min-h-[280px] w-full">
                  <BarChart accessibilityLayer data={attendanceChart}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="hadir" stackId="a" fill="var(--color-hadir)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="izin" stackId="a" fill="var(--color-izin)" />
                    <Bar dataKey="sakit" stackId="a" fill="var(--color-sakit)" />
                    <Bar dataKey="alpa" stackId="a" fill="var(--color-alpa)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rekap Pengajuan Izin</CardTitle>
                <CardDescription>Seluruh periode</CardDescription>
              </CardHeader>
              <CardContent>
                {leavePie.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Belum ada pengajuan izin tercatat.
                  </p>
                ) : (
                  <ChartContainer config={leaveConfig} className="mx-auto min-h-[280px] w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="key" />} />
                      <Pie data={leavePie} dataKey="value" nameKey="key" innerRadius={50} outerRadius={90}>
                        {leavePie.map((entry) => (
                          <Cell key={entry.key} fill={`var(--color-${entry.key})`} />
                        ))}
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="key" />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tabel Rekap Lengkap</CardTitle>
              <CardDescription>
                {rows.length} siswa - {data.data.supervisorCount} pembimbing
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Pembimbing</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Izin</TableHead>
                    <TableHead className="text-center">Sakit</TableHead>
                    <TableHead className="text-center">Alpa</TableHead>
                    <TableHead className="text-center">Jurnal</TableHead>
                    <TableHead className="text-center">Izin Disetujui</TableHead>
                    <TableHead className="text-center">Nilai Akhir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.student.profile.id}>
                      <TableCell>
                        <p className="font-medium">{row.student.profile.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.student.detail?.class_name ?? "-"} - {row.student.company?.name ?? "Tanpa perusahaan"}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">{row.student.supervisor?.full_name ?? "-"}</TableCell>
                      <TableCell className="text-center">{row.hadir}</TableCell>
                      <TableCell className="text-center">{row.izin}</TableCell>
                      <TableCell className="text-center">{row.sakit}</TableCell>
                      <TableCell className="text-center">{row.alpa}</TableCell>
                      <TableCell className="text-center">
                        {row.journals}
                        <span className="block text-xs text-muted-foreground">{row.reviewed} ditinjau</span>
                      </TableCell>
                      <TableCell className="text-center">{row.leaveApproved}</TableCell>
                      <TableCell className="text-center">
                        {row.finalScore ?? "-"}
                        {row.predicate ? (
                          <span className="block text-xs text-muted-foreground">
                            {row.predicate} - {PREDICATE_LABEL[row.predicate]}
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-4 text-xs text-muted-foreground">
                Laporan dihasilkan pada {formatDate(todayISO())}. Status presensi yang dihitung:{" "}
                {Object.values(ATTENDANCE_LABEL).join(", ")}.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
