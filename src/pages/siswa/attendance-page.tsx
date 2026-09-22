import { useState } from "react"
import { CalendarCheck, Clock, LogIn, LogOut } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchAttendance, fetchHolidays, fetchStudentOverview } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import {
  ATTENDANCE_CLASS,
  ATTENDANCE_LABEL,
  formatDate,
  formatDayName,
  formatTime,
  todayISO,
} from "@/lib/format"
import type { AttendanceStatus } from "@/lib/types"

export function SiswaAttendancePage() {
  const { profile } = useAuth()
  const today = todayISO()
  const [status, setStatus] = useState<AttendanceStatus>("hadir")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const data = useAsyncData(
    async () => {
      if (!profile) return { overview: null, attendance: [], holidays: [] }
      const [overview, attendance, holidays] = await Promise.all([
        fetchStudentOverview(profile.id),
        fetchAttendance({ studentId: profile.id }),
        fetchHolidays(),
      ])
      return { overview, attendance, holidays }
    },
    { overview: null, attendance: [], holidays: [] },
    [profile?.id],
  )

  if (data.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Presensi" description="Catat kehadiran harian PKL Anda." />
        <LoadingState rows={4} />
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Presensi" description="Catat kehadiran harian PKL Anda." />
        <ErrorState message={data.error} onRetry={data.reload} />
      </div>
    )
  }

  const { overview, attendance, holidays } = data.data
  const placement = overview?.placement ?? null
  const placementReady = placement && overview?.company && overview?.supervisor && placement.status === "aktif"
  const todayHoliday = holidays.find((h) => h.date === today)
  const todayRow = attendance.find((a) => a.date === today) ?? null

  const upsertToday = async (payload: Partial<{
    check_in_time: string | null
    check_out_time: string | null
    status: AttendanceStatus
    note: string | null
  }>) => {
    if (!profile) return false
    const base = {
      student_id: profile.id,
      date: today,
      recorded_by: profile.id,
    }
    const { error } = todayRow
      ? await supabase.from("attendance").update(payload).eq("id", todayRow.id)
      : await supabase.from("attendance").insert({ ...base, ...payload })
    if (error) {
      toast.error("Gagal menyimpan presensi. Silakan coba lagi.")
      return false
    }
    data.reload()
    return true
  }

  const handleCheckIn = async () => {
    setBusy(true)
    const ok = await upsertToday({
      check_in_time: new Date().toISOString(),
      status: status === "hadir" ? "hadir" : status,
      note: note.trim() || null,
    })
    setBusy(false)
    if (ok) toast.success("Presensi masuk berhasil dicatat.")
  }

  const handleCheckOut = async () => {
    setBusy(true)
    const ok = await upsertToday({ check_out_time: new Date().toISOString() })
    setBusy(false)
    if (ok) toast.success("Presensi keluar berhasil dicatat.")
  }

  const handleNonPresent = async () => {
    if (status === "hadir") {
      toast.error("Pilih Izin, Sakit, atau Alpa terlebih dahulu.")
      return
    }
    if (!note.trim()) {
      toast.error("Tuliskan keterangan singkat untuk ketidakhadiran.")
      return
    }
    setBusy(true)
    const ok = await upsertToday({ status, note: note.trim(), check_in_time: null, check_out_time: null })
    setBusy(false)
    if (ok) toast.success(`Presensi ${ATTENDANCE_LABEL[status]} tercatat.`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Presensi Harian"
        description={`${formatDayName(today)}, ${formatDate(today)}`}
      />

      {!placementReady ? (
        <EmptyState
          icon={CalendarCheck}
          title="Presensi belum aktif"
          description="Penempatan PKL Anda belum berstatus aktif. Hubungi Admin untuk melengkapi perusahaan, pembimbing, dan periode PKL."
        />
      ) : (
        <>
          {todayHoliday ? (
            <Card className="border-sky-500/30 bg-sky-500/5">
              <CardContent className="p-4 text-sm">
                Hari ini ditetapkan sebagai hari libur: <strong>{todayHoliday.name}</strong>. Presensi tidak
                diwajibkan.
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Presensi Hari Ini</CardTitle>
              <CardDescription>
                {overview?.company?.name ?? "-"} - Pembimbing {overview?.supervisor?.full_name ?? "-"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <LogIn className="size-3.5" /> Jam Masuk
                  </p>
                  <p className="text-lg font-semibold">{formatTime(todayRow?.check_in_time ?? null)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <LogOut className="size-3.5" /> Jam Keluar
                  </p>
                  <p className="text-lg font-semibold">{formatTime(todayRow?.check_out_time ?? null)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" /> Status
                  </p>
                  {todayRow ? (
                    <StatusBadge
                      label={ATTENDANCE_LABEL[todayRow.status as AttendanceStatus]}
                      className={ATTENDANCE_CLASS[todayRow.status as AttendanceStatus]}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Belum diisi</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCheckIn} disabled={busy || (!!todayRow?.check_in_time && todayRow.status === "hadir")}>
                  <LogIn />
                  Presensi Masuk
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCheckOut}
                  disabled={busy || !todayRow?.check_in_time || !!todayRow?.check_out_time}
                >
                  <LogOut />
                  Presensi Keluar
                </Button>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Tidak hadir hari ini?</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="status-absen">Keterangan</FieldLabel>
                    <NativeSelect
                      id="status-absen"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
                    >
                      <option value="hadir">Hadir</option>
                      <option value="izin">Izin</option>
                      <option value="sakit">Sakit</option>
                      <option value="alpa">Alpa</option>
                    </NativeSelect>
                  </Field>
                  <Field className="sm:col-span-1">
                    <FieldLabel htmlFor="catatan-absen">Catatan</FieldLabel>
                    <Textarea
                      id="catatan-absen"
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Contoh: mengikuti lomba di sekolah"
                    />
                  </Field>
                </div>
                <FieldDescription>
                  Untuk izin atau sakit yang lebih dari sehari, gunakan menu Pengajuan Izin agar dapat
                  disetujui pembimbing.
                </FieldDescription>
                <Button variant="outline" onClick={handleNonPresent} disabled={busy}>
                  Simpan Keterangan
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Presensi</CardTitle>
              <CardDescription>{attendance.length} catatan presensi.</CardDescription>
            </CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada riwayat presensi.</p>
              ) : (
                <div className="divide-y">
                  {attendance.map((row) => (
                    <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {formatDayName(row.date)}, {formatDate(row.date)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Masuk {formatTime(row.check_in_time)} - Keluar {formatTime(row.check_out_time)}
                          {row.note ? ` - ${row.note}` : ""}
                        </p>
                      </div>
                      <StatusBadge
                        label={ATTENDANCE_LABEL[row.status as AttendanceStatus]}
                        className={ATTENDANCE_CLASS[row.status as AttendanceStatus]}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
