import { useState } from "react"
import {
  CalendarCheck,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  LogIn,
  MapPin,
  MessageCircle,
  ShieldAlert,
  Stethoscope,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { AttendanceCapture, type AttendanceEvidence } from "@/components/attendance-capture"
import { AttachmentLink } from "@/components/student-detail"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { StatusBadge } from "@/components/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { useAsyncData } from "@/hooks/use-async-data"
import { useCapturePermissions } from "@/hooks/use-capture-permissions"
import { fetchAttendance, fetchHolidays, fetchLeaveRequests, fetchStudentOverview } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import { uploadAttendancePhoto, uploadStudentFile } from "@/lib/storage"
import {
  ATTENDANCE_CLASS,
  ATTENDANCE_LABEL,
  LEAVE_STATUS_CLASS,
  LEAVE_STATUS_LABEL,
  formatCoordinate,
  formatDate,
  formatDayName,
  formatTime,
  todayISO,
} from "@/lib/format"
import type { AttendanceStatus, LeaveRequest, LeaveStatus, LeaveType } from "@/lib/types"

type Step = "idle" | "choose" | "capture" | "leave"

interface LeaveForm {
  type: Extract<LeaveType, "izin" | "sakit">
  reason: string
  file: File | null
}

function whatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, "")
  if (!digits) return null
  if (digits.startsWith("62")) return digits
  if (digits.startsWith("0")) return `62${digits.slice(1)}`
  return digits
}

export function SiswaAttendancePage() {
  const { profile } = useAuth()
  const today = todayISO()
  const permissions = useCapturePermissions()

  const [step, setStep] = useState<Step>("idle")
  const [leaveForm, setLeaveForm] = useState<LeaveForm>({ type: "izin", reason: "", file: null })
  const [busy, setBusy] = useState(false)
  const [consult, setConsult] = useState<{ type: LeaveType; status: LeaveStatus } | null>(null)

  const data = useAsyncData(
    async () => {
      if (!profile) return { overview: null, attendance: [], holidays: [], leave: [] }
      const [overview, attendance, holidays, leave] = await Promise.all([
        fetchStudentOverview(profile.id),
        fetchAttendance({ studentId: profile.id }),
        fetchHolidays(),
        fetchLeaveRequests({ studentId: profile.id }),
      ])
      return { overview, attendance, holidays, leave }
    },
    { overview: null, attendance: [], holidays: [], leave: [] },
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

  const { overview, attendance, holidays, leave } = data.data
  const placement = overview?.placement ?? null
  const placementReady = placement && overview?.company && overview?.supervisor && placement.status === "aktif"
  const todayHoliday = holidays.find((h) => h.date === today)
  const todayRow = attendance.find((a) => a.date === today) ?? null

  const todayLeave =
    leave.find(
      (item) =>
        item.status !== "dibatalkan" &&
        today >= item.start_date.slice(0, 10) &&
        today <= item.end_date.slice(0, 10),
    ) ?? null

  const supervisorName = overview?.supervisor?.full_name ?? null
  const supervisorPhone = whatsappNumber(overview?.supervisor?.phone)

  const permissionsReady = permissions.camera === "granted" && permissions.location === "granted"
  const missingPermissions = [
    permissions.camera === "granted" ? null : "kamera",
    permissions.location === "granted" ? null : "lokasi",
  ].filter(Boolean) as string[]

  const reload = () => data.reload()

  const recordPresent = async (evidence: AttendanceEvidence) => {
    if (!profile) return
    setBusy(true)
    try {
      const uploaded = await uploadAttendancePhoto(profile.id, evidence.blob)
      const point = evidence.geopoint
      const payload = {
        check_in_time: new Date().toISOString(),
        status: "hadir" as AttendanceStatus,
        note: null,
        photo_path: uploaded.path,
        photo_name: uploaded.name,
        latitude: point?.latitude ?? null,
        longitude: point?.longitude ?? null,
        address: point?.address ?? null,
        captured_at: point?.capturedAt ?? new Date().toISOString(),
      }
      const { error } = todayRow
        ? await supabase.from("attendance").update(payload).eq("id", todayRow.id)
        : await supabase.from("attendance").insert({ ...payload, student_id: profile.id, date: today })
      if (error) throw new Error(error.message)
      toast.success("Presensi berhasil dicatat.")
      setStep("idle")
      reload()
    } catch {
      toast.error("Gagal menyimpan presensi. Silakan coba lagi.")
    } finally {
      setBusy(false)
    }
  }

  const submitLeave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile) return
    if (!leaveForm.reason.trim()) {
      toast.error("Alasan wajib diisi.")
      return
    }

    setBusy(true)
    try {
      let attachmentPath: string | null = null
      let attachmentName: string | null = null
      if (leaveForm.file) {
        const uploaded = await uploadStudentFile(profile.id, "izin", leaveForm.file)
        attachmentPath = uploaded.path
        attachmentName = uploaded.name
      }

      const { error } = await supabase.from("leave_requests").insert({
        student_id: profile.id,
        type: leaveForm.type,
        start_date: today,
        end_date: today,
        reason: leaveForm.reason.trim(),
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        status: "menunggu",
      })
      if (error) throw new Error(error.message)

      setConsult({ type: leaveForm.type, status: "menunggu" })
      setLeaveForm({ type: leaveForm.type, reason: "", file: null })
      setStep("idle")
      toast.success("Pengajuan terkirim. Menunggu persetujuan pembimbing.")
      reload()
    } catch {
      toast.error("Gagal mengirim pengajuan. Silakan coba lagi.")
    } finally {
      setBusy(false)
    }
  }

  const cancelLeave = async (request: LeaveRequest) => {
    const { error } = await supabase
      .from("leave_requests")
      .update({ status: "dibatalkan" })
      .eq("id", request.id)
    if (error) {
      toast.error("Gagal membatalkan pengajuan.")
      return
    }
    setConsult(null)
    toast.success("Pengajuan dibatalkan.")
    reload()
  }

  const consultPanel = todayLeave ? (
    <ConsultationPanel
      request={todayLeave}
      supervisorName={supervisorName}
      supervisorPhone={supervisorPhone}
      onCancel={() => cancelLeave(todayLeave)}
    />
  ) : consult ? (
    <ConsultationPanel
      request={null}
      type={consult.type}
      supervisorName={supervisorName}
      supervisorPhone={supervisorPhone}
    />
  ) : null

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
              {todayRow ? (
                <RecordedSummary
                  row={todayRow}
                  leave={todayLeave}
                  consultation={consultPanel}
                />
              ) : step === "capture" ? (
                <AttendanceCapture
                  busy={busy}
                  busyLabel="Menyimpan..."
                  onCancel={() => setStep("choose")}
                  onSubmit={recordPresent}
                />
              ) : step === "choose" ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Pilih keterangan kehadiran</p>
                    <p className="text-xs text-muted-foreground">
                      Pilih Hadir untuk mengirim foto area kerja, atau pilih Izin/Sakit bila Anda berhalangan
                      hadir hari ini.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ChoiceCard
                      icon={Camera}
                      title="Hadir"
                      description="Ambil foto area kerja beserta lokasi dan waktu."
                      onClick={() => setStep("capture")}
                    />
                    <ChoiceCard
                      icon={FileText}
                      title="Izin"
                      description="Ajukan izin dengan alasan yang jelas."
                      onClick={() => {
                        setLeaveForm({ type: "izin", reason: "", file: null })
                        setStep("leave")
                      }}
                    />
                    <ChoiceCard
                      icon={Stethoscope}
                      title="Sakit"
                      description="Ajukan sakit, lampirkan surat dokter bila ada."
                      onClick={() => {
                        setLeaveForm({ type: "sakit", reason: "", file: null })
                        setStep("leave")
                      }}
                    />
                  </div>
                  <Button variant="ghost" onClick={() => setStep("idle")}>
                    Batal
                  </Button>
                </div>
              ) : step === "leave" ? (
                <form className="space-y-4" onSubmit={submitLeave}>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Pengajuan {leaveForm.type === "izin" ? "Izin" : "Sakit"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pengajuan akan dikirim ke pembimbing {supervisorName ?? "-"} untuk disetujui.
                    </p>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="jenis-absen">Keterangan</FieldLabel>
                    <NativeSelect
                      id="jenis-absen"
                      value={leaveForm.type}
                      onChange={(e) =>
                        setLeaveForm((prev) => ({
                          ...prev,
                          type: e.target.value as LeaveForm["type"],
                        }))
                      }
                    >
                      <option value="izin">Izin</option>
                      <option value="sakit">Sakit</option>
                    </NativeSelect>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="alasan-absen">Alasan</FieldLabel>
                    <Textarea
                      id="alasan-absen"
                      rows={3}
                      value={leaveForm.reason}
                      onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))}
                      placeholder="Contoh: mengikuti lomba di sekolah"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="bukti-absen">Lampiran Bukti (opsional)</FieldLabel>
                    <Input
                      id="bukti-absen"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) =>
                        setLeaveForm((prev) => ({ ...prev, file: e.target.files?.[0] ?? null }))
                      }
                    />
                    <FieldDescription>Contoh: surat dokter atau surat izin orang tua.</FieldDescription>
                  </Field>

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={busy}>
                      {busy ? "Mengirim..." : "Kirim Pengajuan"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setStep("choose")} disabled={busy}>
                      Batal
                    </Button>
                  </div>
                </form>
              ) : todayLeave ? (
                <div className="space-y-4">
                  <Alert>
                    <FileText />
                    <AlertTitle>
                      Pengajuan {todayLeave.type === "sakit" ? "sakit" : "izin"} menunggu persetujuan
                    </AlertTitle>
                    <AlertDescription>
                      Presensi hari ini akan tercatat setelah pembimbing menyetujui pengajuan Anda.
                    </AlertDescription>
                  </Alert>
                  {consultPanel}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Anda belum mencatat presensi hari ini.
                  </p>

                  {!permissionsReady ? (
                    <Alert variant="destructive">
                      <ShieldAlert />
                      <AlertTitle>Akses {missingPermissions.join(" dan ")} wajib aktif</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>
                          Presensi memerlukan kamera dan lokasi agar foto bukti memuat titik lokasi serta waktu
                          pengambilan. Izinkan akses berikut ini:
                        </p>
                        <ul className="list-disc pl-4">
                          <li>
                            Kamera:{" "}
                            <span className="font-medium">
                              {permissionLabel(permissions.camera)}
                            </span>
                          </li>
                          <li>
                            Lokasi:{" "}
                            <span className="font-medium">
                              {permissionLabel(permissions.location)}
                            </span>
                          </li>
                        </ul>
                        <p>
                          Jika akses sudah pernah ditolak, aktifkan kembali melalui pengaturan izin situs pada
                          browser Anda.
                        </p>
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {permissionsReady ? (
                    <Button onClick={() => setStep("choose")}>
                      <Camera />
                      Absen
                    </Button>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {permissions.camera !== "granted" && (
                        <Button
                          onClick={() => void permissions.requestCamera()}
                          disabled={permissions.requesting}
                        >
                          <Camera />
                          {permissions.step === "camera"
                            ? "Meminta izin kamera..."
                            : "Aktifkan Kamera"}
                        </Button>
                      )}
                      {permissions.location !== "granted" && (
                        <Button
                          variant={permissions.camera === "granted" ? "default" : "outline"}
                          onClick={() => void permissions.requestLocation()}
                          disabled={permissions.requesting}
                        >
                          <MapPin />
                          {permissions.step === "location"
                            ? "Meminta izin lokasi..."
                            : "Aktifkan Lokasi"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
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
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium">
                          {formatDayName(row.date)}, {formatDate(row.date)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Masuk {formatTime(row.check_in_time)}
                          {row.note ? ` - ${row.note}` : ""}
                        </p>
                        {row.address || row.latitude !== null ? (
                          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="mt-0.5 size-3.5 shrink-0" />
                            <span className="min-w-0">
                              {row.address ?? "Alamat tidak tersedia"}
                              {row.latitude !== null && row.longitude !== null
                                ? ` (${formatCoordinate(row.latitude, row.longitude)})`
                                : ""}
                            </span>
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <AttachmentLink path={row.photo_path} name={row.photo_name} />
                        <StatusBadge
                          label={ATTENDANCE_LABEL[row.status as AttendanceStatus]}
                          className={ATTENDANCE_CLASS[row.status as AttendanceStatus]}
                        />
                      </div>
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

function permissionLabel(state: string): string {
  if (state === "granted") return "sudah diizinkan"
  if (state === "denied") return "ditolak"
  if (state === "prompt") return "belum diminta"
  return "belum diketahui"
}

function ChoiceCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof Camera
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Icon className="size-5 text-muted-foreground" />
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  )
}

function ConsultationPanel({
  request,
  type,
  supervisorName,
  supervisorPhone,
  onCancel,
}: {
  request: LeaveRequest | null
  type?: LeaveType
  supervisorName: string | null
  supervisorPhone: string | null
  onCancel?: () => void
}) {
  const leaveType = request?.type ?? type ?? "izin"
  const label = leaveType === "sakit" ? "sakit" : leaveType === "cuti" ? "cuti" : "izin"
  const status = (request?.status ?? "menunggu") as LeaveStatus

  const message =
    `Assalamualaikum${supervisorName ? ` Pak/Bu ${supervisorName}` : ""}, saya mengajukan ${label} ` +
    `untuk tanggal ${formatDate(request?.start_date ?? todayISO())} ` +
    `${request?.reason ? `dengan alasan: ${request.reason}. ` : ""}` +
    `Mohon persetujuannya. Terima kasih.`

  const link = supervisorPhone
    ? `https://wa.me/${supervisorPhone}?text=${encodeURIComponent(message)}`
    : null

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Pengajuan {label}</p>
        <StatusBadge
          label={LEAVE_STATUS_LABEL[status]}
          className={LEAVE_STATUS_CLASS[status]}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Pengajuan berstatus {LEAVE_STATUS_LABEL[status].toLowerCase()}. Silakan konfirmasi kepada pembimbing
        melalui WhatsApp agar pengajuan segera diputuskan.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {link ? (
          <Button asChild size="sm">
            <a href={link} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
              Hubungi Pembimbing
            </a>
          </Button>
        ) : (
          <p className="text-xs text-destructive">
            Nomor WhatsApp pembimbing belum tersedia. Silakan hubungi Admin.
          </p>
        )}
        {request ? <AttachmentLink path={request.attachment_path} name={request.attachment_name} /> : null}
        {request && request.status === "menunggu" && onCancel ? (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <XCircle />
            Batalkan
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function RecordedSummary({
  row,
  leave,
  consultation,
}: {
  row: {
    status: AttendanceStatus
    check_in_time: string | null
    note: string | null
    photo_path: string | null
    photo_name: string | null
    latitude: number | null
    longitude: number | null
    address: string | null
    captured_at: string | null
  }
  leave: LeaveRequest | null
  consultation: React.ReactNode
}) {
  if (row.status === "hadir") {
    return (
      <div className="space-y-4">
        <Alert className="border-emerald-500/30 bg-emerald-500/5">
          <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />
          <AlertTitle>Presensi hari ini tercatat</AlertTitle>
          <AlertDescription>
            Kehadiran Anda tercatat pada {formatTime(row.check_in_time)} beserta foto bukti area kerja.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryTile icon={LogIn} label="Jam Masuk" value={formatTime(row.check_in_time)} />
          <SummaryTile icon={Camera} label="Waktu Foto" value={formatTime(row.captured_at)} />
          <SummaryTile
            icon={Clock}
            label="Status"
            badge={
              <StatusBadge
                label={ATTENDANCE_LABEL[row.status]}
                className={ATTENDANCE_CLASS[row.status]}
              />
            }
          />
        </div>

        <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
          <div className="space-y-0.5">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" /> Alamat
            </p>
            <p className="text-sm">{row.address ?? "Alamat tidak tersedia"}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Koordinat</p>
            <p className="font-mono text-sm">{formatCoordinate(row.latitude, row.longitude)}</p>
          </div>
        </div>

        <AttachmentLink path={row.photo_path} name={row.photo_name} />
      </div>
    )
  }

  if (row.status === "izin" || row.status === "sakit") {
    return (
      <div className="space-y-4">
        <Alert>
          <FileText />
          <AlertTitle>
            {ATTENDANCE_LABEL[row.status]} tercatat untuk hari ini
          </AlertTitle>
          <AlertDescription>
            {row.note ?? "Pengajuan Anda sedang menunggu keputusan pembimbing."}
          </AlertDescription>
        </Alert>
        {consultation}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <ShieldAlert />
        <AlertTitle>Anda tidak hadir tanpa keterangan</AlertTitle>
        <AlertDescription>
          Sistem menandai Anda alpa pada hari ini karena tidak ada catatan presensi maupun pengajuan izin.
          Hubungi pembimbing Anda bila ini keliru.
        </AlertDescription>
      </Alert>
      {leave ? consultation : null}
    </div>
  )
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: typeof Clock
  label: string
  value?: string
  badge?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      {badge ?? <p className="text-lg font-semibold">{value ?? "-"}</p>}
    </div>
  )
}
