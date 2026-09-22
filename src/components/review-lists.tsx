import { useState } from "react"
import { BookOpen, CalendarCheck } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { AttachmentLink } from "@/components/student-detail"
import { EmptyState, ErrorState, LoadingState } from "@/components/page-states"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  LEAVE_STATUS_CLASS,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  formatDate,
  formatDateTime,
  formatDuration,
} from "@/lib/format"
import { supabase } from "@/lib/supabase"
import type { LeaveRequest, LeaveStatus, Profile } from "@/lib/types"
import { toast } from "sonner"

interface StudentNames {
  [studentId: string]: string
}

interface JournalReviewListProps {
  journals: { id: string; student_id: string; date: string; title: string; description: string | null; duration_minutes: number | null; attachment_path: string | null; attachment_name: string | null; review_status: string; supervisor_feedback: string | null; reviewed_by_name: string | null }[]
  names: StudentNames
  loading: boolean
  error: string | null
  onReload: () => void
}

export function JournalReviewList({ journals, names, loading, error, onReload }: JournalReviewListProps) {
  const { profile } = useAuth()
  const [target, setTarget] = useState<(typeof journals)[number] | null>(null)
  const [feedback, setFeedback] = useState("")
  const [saving, setSaving] = useState(false)

  if (loading) return <LoadingState rows={4} />
  if (error) return <ErrorState message={error} onRetry={onReload} />
  if (journals.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Tidak ada jurnal"
        description="Belum ada jurnal yang perlu ditinjau pada filter ini."
      />
    )
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!target || !profile) return
    setSaving(true)
    const { error: updateError } = await supabase
      .from("journals")
      .update({
        supervisor_feedback: feedback.trim() || null,
        review_status: "ditinjau",
        reviewed_by: profile.id,
        reviewed_by_name: profile.full_name,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", target.id)
    setSaving(false)

    if (updateError) {
      toast.error("Gagal menyimpan tinjauan.")
      return
    }
    toast.success("Tinjauan jurnal tersimpan.")
    setTarget(null)
    setFeedback("")
    onReload()
  }

  return (
    <>
      <div className="space-y-3">
        {journals.map((journal) => (
          <Card key={journal.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{journal.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {names[journal.student_id] ?? "Siswa"} - {formatDate(journal.date)} -{" "}
                    {formatDuration(journal.duration_minutes)}
                  </p>
                </div>
                <StatusBadge
                  label={journal.review_status === "menunggu" ? "Menunggu Tinjauan" : "Sudah Ditinjau"}
                  className={journal.review_status === "menunggu" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"}
                />
              </div>
              {journal.description ? (
                <p className="text-sm text-muted-foreground">{journal.description}</p>
              ) : null}
              {journal.supervisor_feedback ? (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Umpan balik {journal.reviewed_by_name ?? ""}
                  </p>
                  {journal.supervisor_feedback}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <AttachmentLink path={journal.attachment_path} name={journal.attachment_name} />
                <Button
                  size="sm"
                  variant={journal.review_status === "menunggu" ? "default" : "outline"}
                  onClick={() => {
                    setTarget(journal)
                    setFeedback(journal.supervisor_feedback ?? "")
                  }}
                >
                  {journal.review_status === "menunggu" ? "Beri Umpan Balik" : "Perbarui Tinjauan"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tinjau Jurnal</DialogTitle>
            <DialogDescription>
              {target ? `${names[target.student_id] ?? "Siswa"} - ${formatDate(target.date)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <Field>
              <FieldLabel htmlFor="umpan-balik">Umpan Balik</FieldLabel>
              <Textarea
                id="umpan-balik"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tuliskan catatan, apresiasi, atau saran perbaikan..."
                rows={4}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Tinjauan akan tercatat atas nama {profile?.full_name}.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTarget(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Tandai Sudah Ditinjau"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface LeaveDecisionListProps {
  requests: LeaveRequest[]
  names: StudentNames
  loading: boolean
  error: string | null
  canDecide: boolean
  onReload: () => void
}

export function LeaveDecisionList({ requests, names, loading, error, canDecide, onReload }: LeaveDecisionListProps) {
  const { profile } = useAuth()
  const [target, setTarget] = useState<LeaveRequest | null>(null)
  const [decision, setDecision] = useState<"disetujui" | "ditolak">("disetujui")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  if (loading) return <LoadingState rows={4} />
  if (error) return <ErrorState message={error} onRetry={onReload} />
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="Tidak ada pengajuan"
        description="Belum ada pengajuan izin, sakit, atau cuti pada filter ini."
      />
    )
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!target || !profile) return
    setSaving(true)
    const { error: updateError } = await supabase
      .from("leave_requests")
      .update({
        status: decision,
        decided_by: profile.id,
        decided_by_name: profile.full_name,
        decided_at: new Date().toISOString(),
        decision_note: note.trim() || null,
      })
      .eq("id", target.id)
    setSaving(false)

    if (updateError) {
      toast.error("Gagal menyimpan keputusan.")
      return
    }
    toast.success(decision === "disetujui" ? "Pengajuan disetujui." : "Pengajuan ditolak.")
    setTarget(null)
    setNote("")
    onReload()
  }

  return (
    <>
      <div className="space-y-3">
        {requests.map((request) => (
          <Card key={request.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {names[request.student_id] ?? "Siswa"} - {LEAVE_TYPE_LABEL[request.type] ?? request.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(request.start_date)} - {formatDate(request.end_date)}
                  </p>
                </div>
                <StatusBadge
                  label={LEAVE_STATUS_LABEL[request.status as LeaveStatus]}
                  className={LEAVE_STATUS_CLASS[request.status as LeaveStatus]}
                />
              </div>
              <p className="text-sm text-muted-foreground">{request.reason}</p>
              {request.decided_by_name ? (
                <p className="text-xs text-muted-foreground">
                  Diputuskan oleh {request.decided_by_name}
                  {request.decided_at ? ` pada ${formatDateTime(request.decided_at)}` : ""}
                  {request.decision_note ? ` - ${request.decision_note}` : ""}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <AttachmentLink path={request.attachment_path} name={request.attachment_name} />
                {canDecide && request.status === "menunggu" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        setTarget(request)
                        setDecision("disetujui")
                        setNote("")
                      }}
                    >
                      Setujui
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTarget(request)
                        setDecision("ditolak")
                        setNote("")
                      }}
                    >
                      Tolak
                    </Button>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{decision === "disetujui" ? "Setujui Pengajuan" : "Tolak Pengajuan"}</DialogTitle>
            <DialogDescription>
              {target ? `${names[target.student_id] ?? "Siswa"} - ${LEAVE_TYPE_LABEL[target.type] ?? target.type}` : ""}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <Field>
              <FieldLabel htmlFor="catatan-keputusan">Catatan Keputusan (opsional)</FieldLabel>
              <Textarea
                id="catatan-keputusan"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: Surat dokter sudah diterima."
                rows={3}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTarget(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : decision === "disetujui" ? "Setujui" : "Tolak"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function buildNameMap(profiles: Pick<Profile, "id" | "full_name">[]): StudentNames {
  return profiles.reduce<StudentNames>((acc, item) => {
    acc[item.id] = item.full_name
    return acc
  }, {})
}
