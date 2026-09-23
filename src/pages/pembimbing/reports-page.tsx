import { useState } from "react"
import { Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { NativeSelect } from "@/components/ui/native-select"
import { useAsyncData } from "@/hooks/use-async-data"
import {
  fetchAttendance,
  fetchJournals,
  fetchLeaveRequests,
  fetchStudentOverviews,
} from "@/lib/queries"
import {
  exportAttendanceReport,
  downloadWorkbook,
  buildDateRange,
} from "@/lib/export-excel"
import { formatDate } from "@/lib/format"
import type { Attendance, Journal, LeaveRequest, StudentOverview } from "@/lib/types"

type Mode = "harian" | "mingguan" | "bulanan" | "seluruh"

const MODE_LABELS: Record<Mode, string> = {
  harian: "Hari Ini",
  mingguan: "Minggu Ini",
  bulanan: "Bulan Ini",
  seluruh: "Seluruh Periode",
}

export function PembimbingReportsPage() {
  const { profile } = useAuth()
  const [mode, setMode] = useState<Mode>("bulanan")
  const [exporting, setExporting] = useState(false)

  const data = useAsyncData(() => fetchStudentOverviews(), [] as StudentOverview[], [profile?.id])

  const handleExport = async () => {
    if (!data.data.length) {
      toast.error("Tidak ada data siswa untuk diekspor.")
      return
    }

    setExporting(true)
    try {
      const range = buildDateRange(mode)
      const studentIds = data.data.map((s) => s.profile.id)

      const [allAttendance, allJournals, allLeave] = await Promise.all([
        Promise.all(studentIds.map((id) => fetchAttendance({ studentId: id, from: range.from, to: range.to }))).then((arrs) => arrs.flat()),
        Promise.all(studentIds.map((id) => fetchJournals({ studentId: id }))).then((arrs) =>
          (arrs.flat() as Journal[]).filter((j) => j.date >= range.from && j.date <= range.to),
        ),
        Promise.all(studentIds.map((id) => fetchLeaveRequests({ studentId: id }))).then((arrs) =>
          (arrs.flat() as LeaveRequest[]).filter(
            (l) => l.start_date.slice(0, 10) <= range.to && l.end_date.slice(0, 10) >= range.from,
          ),
        ),
      ])

      const periodLabel = data.data[0]?.period?.name ?? "PKL"
      const workbook = exportAttendanceReport({
        students: data.data,
        attendance: allAttendance as Attendance[],
        journals: allJournals,
        leaveRequests: allLeave,
        period: periodLabel,
        dateRange: range,
      })

      const filename = `Rekap_PKL_${MODE_LABELS[mode].replace(/\s/g, "_")}_${formatDate(range.from)}_${formatDate(range.to)}.xlsx`
      await downloadWorkbook(workbook, filename)
      toast.success("File Excel berhasil diunduh.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengekspor data.")
    } finally {
      setExporting(false)
    }
  }

  if (data.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Rekap & Ekspor" description="Unduh rekap kegiatan PKL siswa bimbingan Anda." />
        <LoadingState rows={3} />
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Rekap & Ekspor" description="Unduh rekap kegiatan PKL siswa bimbingan Anda." />
        <ErrorState message={data.error} onRetry={data.reload} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Rekap & Ekspor" description="Unduh rekap kegiatan PKL siswa bimbingan Anda dalam format Excel." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-5" />
            Ekspor Rekap PKL
          </CardTitle>
          <CardDescription>
            Pilih periode data lalu unduh file Excel yang berisi rekap presensi, jurnal, dan pengajuan
            izin seluruh siswa bimbingan Anda. File lengkap dengan format dan pewarnaan agar mudah dicetak.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <NativeSelect
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
              >
                {(Object.keys(MODE_LABELS) as Mode[]).map((key) => (
                  <option key={key} value={key}>{MODE_LABELS[key]}</option>
                ))}
              </NativeSelect>
            </div>
            <Button onClick={handleExport} disabled={exporting || data.data.length === 0}>
              {exporting ? <Loader2 className="animate-spin" /> : <Download />}
              {exporting ? "Mengekspor..." : "Unduh Excel"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Rentang: {formatDate(buildDateRange(mode).from)} — {formatDate(buildDateRange(mode).to)}
            {" · "}{data.data.length} siswa bimbingan
          </p>

          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium">Isi file Excel:</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li><strong>Rekap Presensi</strong> — ringkasan per siswa (hadir, izin, sakit, alpa)</li>
              <li><strong>Detail Presensi</strong> — daftar harian dengan jam masuk/keluar dan lokasi</li>
              <li><strong>Jurnal Harian</strong> — seluruh jurnal dengan status review</li>
              <li><strong>Pengajuan Izin</strong> — daftar pengajuan dengan keputusan</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
