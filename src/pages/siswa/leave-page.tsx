import { useState } from "react"
import { FileText, Plus, XCircle } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { AttachmentLink } from "@/components/student-detail"
import { EmptyState, ErrorState, LoadingState } from "@/components/page-states"
import { Fab, ResponsiveSheet, ScreenHeader } from "@/components/mobile-ui"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchLeaveRequests, fetchStudentOverview } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import { uploadStudentFile } from "@/lib/storage"
import {
  LEAVE_STATUS_CLASS,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  formatDate,
  formatDateTime,
  todayISO,
} from "@/lib/format"
import type { LeaveRequest, LeaveStatus, LeaveType } from "@/lib/types"

interface Form {
  type: LeaveType
  start_date: string
  end_date: string
  reason: string
  file: File | null
}

const EMPTY: Form = { type: "izin", start_date: todayISO(), end_date: todayISO(), reason: "", file: null }

export function SiswaLeavePage() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)

  const data = useAsyncData(
    async () => {
      if (!profile) return { requests: [] as LeaveRequest[], overview: null }
      const [requests, overview] = await Promise.all([
        fetchLeaveRequests({ studentId: profile.id }),
        fetchStudentOverview(profile.id),
      ])
      return { requests, overview }
    },
    { requests: [] as LeaveRequest[], overview: null },
    [profile?.id],
  )

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile) return

    if (!form.reason.trim()) {
      toast.error("Alasan pengajuan wajib diisi.")
      return
    }
    if (form.end_date < form.start_date) {
      toast.error("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.")
      return
    }

    setSaving(true)
    try {
      let attachmentPath: string | null = null
      let attachmentName: string | null = null

      if (form.file) {
        const uploaded = await uploadStudentFile(profile.id, "izin", form.file)
        attachmentPath = uploaded.path
        attachmentName = uploaded.name
      }

      const { error } = await supabase.from("leave_requests").insert({
        student_id: profile.id,
        type: form.type,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason.trim(),
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
        status: "menunggu",
      })
      if (error) throw new Error(error.message)

      toast.success("Pengajuan berhasil dikirim dan menunggu persetujuan pembimbing.")
      setOpen(false)
      setForm(EMPTY)
      data.reload()
    } catch {
      toast.error("Gagal mengirim pengajuan. Silakan coba lagi.")
    } finally {
      setSaving(false)
    }
  }

  const cancel = async (request: LeaveRequest) => {
    const { error } = await supabase
      .from("leave_requests")
      .update({ status: "dibatalkan" })
      .eq("id", request.id)
    if (error) {
      toast.error("Gagal membatalkan pengajuan.")
      return
    }
    toast.success("Pengajuan dibatalkan.")
    data.reload()
  }

  const overview = data.data.overview
  const placementReady = overview?.placement?.status === "aktif"

  return (
    <div className="space-y-5">
      <ScreenHeader title="Pengajuan Izin" description="Ajukan ketidakhadiran dan pantau keputusannya." />

      {!placementReady ? (
        <EmptyState
          icon={FileText}
          title="Pengajuan belum aktif"
          description="Pengajuan dapat dibuat setelah penempatan PKL Anda berstatus aktif. Hubungi Admin bila ini terasa keliru."
        />
      ) : data.loading ? (
        <LoadingState rows={3} />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : data.data.requests.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Belum ada pengajuan"
          description="Buat pengajuan bila Anda perlu izin, sakit, atau cuti selama PKL."
        />
      ) : (
        <div className="space-y-3">
          {data.data.requests.map((request) => (
            <Card key={request.id} className="gap-0 py-0">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">{LEAVE_TYPE_LABEL[request.type] ?? request.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(request.start_date)} - {formatDate(request.end_date)}
                    </p>
                  </div>
                  <StatusBadge
                    className={LEAVE_STATUS_CLASS[request.status as LeaveStatus]}
                    label={LEAVE_STATUS_LABEL[request.status as LeaveStatus]}
                  />
                </div>

                <p className="text-sm text-muted-foreground">{request.reason}</p>

                {request.status !== "menunggu" && request.decided_by_name ? (
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Keputusan {request.decided_by_name}
                      {request.decided_at ? ` - ${formatDateTime(request.decided_at)}` : ""}
                    </p>
                    {request.decision_note ?? "Tanpa catatan tambahan."}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Diajukan {formatDateTime(request.created_at)} - menunggu pembimbing.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <AttachmentLink path={request.attachment_path} name={request.attachment_name} />
                  {request.status === "menunggu" ? (
                    <Button size="sm" variant="ghost" onClick={() => cancel(request)}>
                      <XCircle />
                      Batalkan
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Fab
        label="Buat Pengajuan"
        icon={Plus}
        disabled={!placementReady}
        onClick={() => {
          setForm(EMPTY)
          setOpen(true)
        }}
      />

      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title="Buat Pengajuan"
        description="Pengajuan akan dikirim kepada pembimbing Anda untuk disetujui."
      >
        <form className="space-y-4 pb-2" onSubmit={submit}>
          <Field>
            <FieldLabel htmlFor="jenis-pengajuan">Jenis</FieldLabel>
            <NativeSelect
              id="jenis-pengajuan"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as LeaveType }))}
            >
              <option value="izin">Izin</option>
              <option value="sakit">Sakit</option>
              <option value="cuti">Cuti</option>
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="mulai-izin">Mulai</FieldLabel>
              <Input
                id="mulai-izin"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="selesai-izin">Selesai</FieldLabel>
              <Input
                id="selesai-izin"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="alasan-izin">Alasan</FieldLabel>
            <Textarea
              id="alasan-izin"
              rows={4}
              value={form.reason}
              onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Jelaskan alasan pengajuan Anda secara singkat dan jelas."
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bukti-izin">Lampiran Bukti (opsional)</FieldLabel>
            <Input
              id="bukti-izin"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setForm((prev) => ({ ...prev, file: e.target.files?.[0] ?? null }))}
            />
            <FieldDescription>Contoh: surat dokter atau surat izin orang tua.</FieldDescription>
          </Field>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Mengirim..." : "Kirim"}
            </Button>
          </div>
        </form>
      </ResponsiveSheet>
    </div>
  )
}
