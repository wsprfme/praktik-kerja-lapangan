import { useState } from "react"
import {
  CalendarCheck,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  LogIn,
  LogOut,
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
import { EmptyState, ErrorState, LoadingState } from "@/components/page-states"
import { ResponsiveSheet, ScreenHeader } from "@/components/mobile-ui"
import { StatusBadge } from "@/components/status-badge"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

type Step = "idle" | "choose" | "capture" | "leave" | "checkout"

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
      <div className="space-y-5">
        <ScreenHeader title="Presensi" description="Catat kehadiran harian PKL Anda." />
        <LoadingState rows={4} />
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="space-y-5">
        <ScreenHeader title="Presensi" description="Catat kehadiran harian PKL Anda." />
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

  const recordCheckout = async (evidence: AttendanceEvidence) => {
    if (!profile || !todayRow) return
    setBusy(true)
    try {
      const uploaded = await uploadAttendancePhoto(profile.id, evidence.blob)
      const point = evidence.geopoint
      const { error } = await supabase
        .from("attendance")
        .update({
          check_out_time: new Date().toISOString(),
          check_out_photo_path: uploaded.path,
          check_out_photo_name: uploaded.name,
          check_out_latitude: point?.latitude ?? null,
          check_out_longitude: point?.longitude ?? null,
          check_out_address: point?.address ?? null,
          check_out_captured_at: point?.capturedAt ?? new Date().toISOString(),
        })
        .eq("id", todayRow.id)
      if (error) throw new Error(error.message)
      toast.success("Presensi keluar berhasil dicatat.")
      setStep("idle")
      reload()
    } catch {
      toast.error("Gagal menyimpan presensi keluar. Silakan coba lagi.")
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
    <div className="space-y-5">
      <ScreenHeader
        title="Presensi"
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
            <Card className="gap-0 border-sky-500/30 bg-sky-500/5 py-0">
              <CardContent className="p-4 text-sm">
                Hari ini ditetapkan sebagai hari libur: <strong>{todayHoliday.name}</strong>. Presensi tidak
                diwajibkan.
              </CardContent>
            </Card>
          ) : null}

          <Card className="gap-0 py-0">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold">Status hari ini</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {overview?.company?.name ?? "-"}
                  </p>
                </div>
                {todayRow ? (
                  <StatusBadge
                    label={ATTENDANCE_LABEL[todayRow.status as AttendanceStatus]}
                    className={ATTENDANCE_CLASS[todayRow.status as AttendanceStatus]}
                  />
                ) : null}
              </div>

              {todayRow ? (
                <RecordedSummary
                  row={todayRow}
                  leave={todayLeave}
                  consultation={consultPanel}
                  onCheckout={() => setStep("checkout")}
                  permissionsReady={permissionsReady}
                />
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
                  <div className="flex flex-col items-center gap-3 rounded-xl bg-muted/60 py-6 text-center">
                    <span className="flex size-14 items-center justify-center rounded-full bg-background">
                      <Camera className="size-6 text-muted-foreground" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Belum ada presensi hari ini</p>
                        <p className="text-xs text-muted-foreground">
                          Foto selfie beserta lokasi dan waktu untuk kehadiran.
                        </p>
                    </div>
                  </div>

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
                    <Button className="w-full" onClick={() => setStep("choose")}>
                      <Camera />
                      Absen Sekarang
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {permissions.camera !== "granted" && (
                        <Button
                          className="w-full"
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
                          className="w-full"
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

          <Card className="gap-0 py-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 pb-1">
                <p className="text-sm font-semibold">Riwayat presensi</p>
                <span className="text-xs text-muted-foreground">{attendance.length} catatan</span>
              </div>
              {attendance.length === 0 ? (
                <p className="pt-2 text-sm text-muted-foreground">Belum ada riwayat presensi.</p>
              ) : (
                <div className="divide-y">
                  {attendance.map((row) => (
                    <div key={row.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium">{formatDate(row.date)}</p>
                        <p className="text-xs text-muted-foreground">
                          Masuk {formatTime(row.check_in_time)}
                          {row.check_out_time ? ` - Keluar ${formatTime(row.check_out_time)}` : ""}
                          {row.note ? ` - ${row.note}` : ""}
                        </p>
                        {row.address || row.latitude !== null ? (
                          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="mt-0.5 size-3.5 shrink-0" />
                            <span className="line-clamp-2 min-w-0">
                              {row.address ?? "Alamat tidak tersedia"}
                            </span>
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <StatusBadge
                          label={ATTENDANCE_LABEL[row.status as AttendanceStatus]}
                          className={ATTENDANCE_CLASS[row.status as AttendanceStatus]}
                        />
                        <AttachmentLink path={row.photo_path} name={row.photo_name} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <ResponsiveSheet
        open={step !== "idle"}
        onOpenChange={(next) => {
          if (!next && step !== "capture") setStep("idle")
        }}
        title={
          step === "capture"
            ? "Presensi Masuk"
            : step === "checkout"
              ? "Presensi Keluar"
              : step === "leave"
                ? `Pengajuan ${leaveForm.type === "izin" ? "Izin" : "Sakit"}`
                : "Pilih Keterangan Kehadiran"
        }
        description={
          step === "capture"
            ? "Foto selfie untuk presensi masuk dengan lokasi dan waktu."
            : step === "checkout"
              ? "Foto selfie untuk presensi keluar dengan lokasi dan waktu."
              : step === "leave"
                ? `Pengajuan dikirim ke pembimbing ${supervisorName ?? "-"}.`
                : "Pilih Hadir untuk mengirim foto, atau Izin/Sakit bila berhalangan."
        }
      >
        {step === "capture" ? (
          <div className="pb-2">
            <AttendanceCapture
              busy={busy}
              busyLabel="Menyimpan..."
              onCancel={() => setStep("choose")}
              onSubmit={recordPresent}
              submitLabel="Kirim Presensi Masuk"
            />
          </div>
        ) : step === "checkout" ? (
          <div className="pb-2">
            <AttendanceCapture
              busy={busy}
              busyLabel="Menyimpan..."
              onCancel={() => setStep("idle")}
              onSubmit={recordCheckout}
              submitLabel="Kirim Presensi Keluar"
            />
          </div>
        ) : step === "leave" ? (
          <form className="space-y-4 pb-2" onSubmit={submitLeave}>
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

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep("choose")}
                disabled={busy}
              >
                Batal
              </Button>
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? "Mengirim..." : "Kirim"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 pb-2">
            <div className="grid gap-3">
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
          </div>
        )}
      </ResponsiveSheet>
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
      className="flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors active:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </span>
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
    <div className="space-y-3 rounded-xl border p-4">
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
  onCheckout,
  permissionsReady,
}: {
  row: {
    status: AttendanceStatus
    check_in_time: string | null
    check_out_time: string | null
    note: string | null
    photo_path: string | null
    photo_name: string | null
    latitude: number | null
    longitude: number | null
    address: string | null
    captured_at: string | null
    check_out_photo_path: string | null
    check_out_photo_name: string | null
    check_out_latitude: number | null
    check_out_longitude: number | null
    check_out_address: string | null
    check_out_captured_at: string | null
  }
  leave: LeaveRequest | null
  consultation: React.ReactNode
  onCheckout?: () => void
  permissionsReady?: boolean
}) {
  if (row.status === "hadir") {
    const hasCheckout = !!row.check_out_time
    return (
      <div className="space-y-4">
        <Alert className="border-emerald-500/30 bg-emerald-500/5">
          <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />
          <AlertTitle>Presensi hari ini tercatat</AlertTitle>
          <AlertDescription>
            Masuk {formatTime(row.check_in_time)}
            {hasCheckout ? ` — Keluar ${formatTime(row.check_out_time)}` : " — Belum presensi keluar"}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-3">
          <SummaryTile icon={LogIn} label="Jam Masuk" value={formatTime(row.check_in_time)} />
          <SummaryTile
            icon={LogOut}
            label="Jam Keluar"
            value={hasCheckout ? formatTime(row.check_out_time) : "—"}
          />
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
          <SummaryTile icon={MapPin} label="Koordinat Masuk" value={formatCoordinate(row.latitude, row.longitude)} mono />
        </div>

        <div className="space-y-0.5 rounded-lg border p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" /> Alamat Masuk
          </p>
          <p className="text-sm">{row.address ?? "Alamat tidak tersedia"}</p>
        </div>

        {hasCheckout ? (
          <div className="space-y-0.5 rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" /> Alamat Keluar
            </p>
            <p className="text-sm">{row.check_out_address ?? "Alamat tidak tersedia"}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <AttachmentLink path={row.photo_path} name={row.photo_name} label="Foto Masuk" />
          {hasCheckout ? (
            <AttachmentLink path={row.check_out_photo_path} name={row.check_out_photo_name} label="Foto Keluar" />
          ) : null}
        </div>

        {!hasCheckout && onCheckout && permissionsReady ? (
          <Button className="w-full" onClick={onCheckout}>
            <LogOut />
            Presensi Keluar
          </Button>
        ) : null}
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
  mono,
}: {
  icon: typeof Clock
  label: string
  value?: string
  badge?: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="space-y-1 rounded-xl border p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" /> <span className="truncate">{label}</span>
      </p>
      {badge ?? (
        <p className={cn("truncate text-sm font-semibold", mono && "font-mono text-xs")}>{value ?? "-"}</p>
      )}
    </div>
  )
}
