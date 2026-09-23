import { useState } from "react"
import { FileText, Plus, XCircle } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { AttachmentLink } from "@/components/student-detail"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
    <div className="space-y-6">
      <PageHeader
        title="Pengajuan Izin, Sakit & Cuti"
        description="Ajukan ketidakhadiran dan pantau keputusannya."
      >
        <Button
          onClick={() => {
            setForm(EMPTY)
            setOpen(true)
          }}
          disabled={!placementReady}
        >
          <Plus />
          Buat Pengajuan
        </Button>
      </PageHeader>

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
            <Card key={request.id}>
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base">
                      {LEAVE_TYPE_LABEL[request.type] ?? request.type}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(request.start_date)} - {formatDate(request.end_date)} - diajukan{" "}
                      {formatDateTime(request.created_at)}
                    </CardDescription>
                  </div>
                  <StatusBadge
                    label={LEAVE_STATUS_LABEL[request.status as LeaveStatus]}
                    className={LEAVE_STATUS_CLASS[request.status as LeaveStatus]}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{request.reason}</p>

                {request.status !== "menunggu" && request.decided_by_name ? (
                  <div className="rounded-md bg-muted p-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Keputusan {request.decided_by_name}
                      {request.decided_at ? ` - ${formatDateTime(request.decided_at)}` : ""}
                    </p>
                    {request.decision_note ?? "Tanpa catatan tambahan."}
                  </div>
                ) : null}

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Pengajuan</DialogTitle>
            <DialogDescription>
              Pengajuan akan dikirim kepada pembimbing Anda untuk disetujui.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="mulai-izin">Tanggal Mulai</FieldLabel>
                <Input
                  id="mulai-izin"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="selesai-izin">Tanggal Selesai</FieldLabel>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Mengirim..." : "Kirim Pengajuan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
