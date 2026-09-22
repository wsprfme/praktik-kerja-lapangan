import { useState } from "react"
import { BookOpen, CalendarCheck, FileText, GraduationCap, Link2, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState, ErrorState, InlineLoading } from "@/components/page-states"
import { StatusBadge } from "@/components/status-badge"
import { useAsyncData } from "@/hooks/use-async-data"
import {
  fetchAssessments,
  fetchAttendance,
  fetchJournals,
  fetchLeaveRequests,
  fetchStudentOverview,
} from "@/lib/queries"
import { getSignedUrl } from "@/lib/storage"
import {
  ATTENDANCE_CLASS,
  ATTENDANCE_LABEL,
  LEAVE_STATUS_CLASS,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  PREDICATE_LABEL,
  REVIEW_CLASS,
  REVIEW_LABEL,
  formatDate,
  formatDateTime,
  formatDuration,
  formatTime,
} from "@/lib/format"
import type { AttendanceStatus, LeaveStatus, ReviewStatus } from "@/lib/types"

export function AttachmentLink({ path, name }: { path: string | null; name: string | null }) {
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!path) return null

  const open = async () => {
    setLoading(true)
    setFailed(false)
    const url = await getSignedUrl(path)
    setLoading(false)
    if (!url) {
      setFailed(true)
      return
    }
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <Button variant="outline" size="sm" onClick={open} disabled={loading}>
      {loading ? <Loader2 className="animate-spin" /> : <Link2 />}
      {failed ? "Berkas tidak tersedia" : (name ?? "Lihat lampiran")}
    </Button>
  )
}

export function StudentDetail({ studentId }: { studentId: string }) {
  const overview = useAsyncData(() => fetchStudentOverview(studentId), null, [studentId])
  const attendance = useAsyncData(() => fetchAttendance({ studentId }), [], [studentId])
  const journals = useAsyncData(() => fetchJournals({ studentId }), [], [studentId])
  const leave = useAsyncData(() => fetchLeaveRequests({ studentId }), [], [studentId])
  const assessment = useAsyncData(() => fetchAssessments([studentId]), [], [studentId])

  if (overview.loading) return <InlineLoading />
  if (overview.error) return <ErrorState message={overview.error} onRetry={overview.reload} />

  const student = overview.data
  if (!student) {
    return <ErrorState message="Data siswa tidak ditemukan." onRetry={overview.reload} />
  }

  const result = assessment.data[0] ?? null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profil & Penempatan</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Nama" value={student.profile.full_name} />
            <Detail label="NIS" value={student.detail?.nis} />
            <Detail label="Kelas" value={student.detail?.class_name} />
            <Detail label="Jurusan" value={student.detail?.major} />
            <Detail label="Perusahaan" value={student.company?.name} />
            <Detail label="Bidang Kerja" value={student.company?.field_of_work} />
            <Detail label="Pembimbing" value={student.supervisor?.full_name} />
            <Detail label="Periode PKL" value={student.period?.name} />
            <Detail label="Status Penempatan" value={student.placement?.status} />
          </dl>
        </CardContent>
      </Card>

      <Tabs defaultValue="presensi">
        <TabsList>
          <TabsTrigger value="presensi">Presensi ({attendance.data.length})</TabsTrigger>
          <TabsTrigger value="jurnal">Jurnal ({journals.data.length})</TabsTrigger>
          <TabsTrigger value="izin">Pengajuan ({leave.data.length})</TabsTrigger>
          <TabsTrigger value="nilai">Nilai</TabsTrigger>
        </TabsList>

        <TabsContent value="presensi" className="space-y-2">
          {attendance.loading ? (
            <InlineLoading />
          ) : attendance.data.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="Belum ada presensi" />
          ) : (
            attendance.data.map((row) => (
              <Card key={row.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium">{formatDate(row.date)}</p>
                    <p className="text-xs text-muted-foreground">
                      Masuk {formatTime(row.check_in_time)} - Keluar {formatTime(row.check_out_time)}
                    </p>
                    {row.note ? <p className="text-xs text-muted-foreground">Catatan: {row.note}</p> : null}
                  </div>
                  <StatusBadge
                    label={ATTENDANCE_LABEL[row.status as AttendanceStatus]}
                    className={ATTENDANCE_CLASS[row.status as AttendanceStatus]}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="jurnal" className="space-y-2">
          {journals.loading ? (
            <InlineLoading />
          ) : journals.data.length === 0 ? (
            <EmptyState icon={BookOpen} title="Belum ada jurnal" />
          ) : (
            journals.data.map((row) => (
              <Card key={row.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{row.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(row.date)} - {formatDuration(row.duration_minutes)}
                      </p>
                    </div>
                    <StatusBadge
                      label={REVIEW_LABEL[row.review_status as ReviewStatus]}
                      className={REVIEW_CLASS[row.review_status as ReviewStatus]}
                    />
                  </div>
                  {row.description ? (
                    <p className="text-sm text-muted-foreground">{row.description}</p>
                  ) : null}
                  {row.supervisor_feedback ? (
                    <div className="rounded-md bg-muted p-3 text-sm">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Umpan balik {row.reviewed_by_name ?? ""}
                      </p>
                      {row.supervisor_feedback}
                    </div>
                  ) : null}
                  <AttachmentLink path={row.attachment_path} name={row.attachment_name} />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="izin" className="space-y-2">
          {leave.loading ? (
            <InlineLoading />
          ) : leave.data.length === 0 ? (
            <EmptyState icon={FileText} title="Belum ada pengajuan" />
          ) : (
            leave.data.map((row) => (
              <Card key={row.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{LEAVE_TYPE_LABEL[row.type] ?? row.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(row.start_date)} - {formatDate(row.end_date)}
                      </p>
                    </div>
                    <StatusBadge
                      label={LEAVE_STATUS_LABEL[row.status as LeaveStatus]}
                      className={LEAVE_STATUS_CLASS[row.status as LeaveStatus]}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">{row.reason}</p>
                  {row.decision_note ? (
                    <p className="text-xs text-muted-foreground">
                      Catatan {row.decided_by_name ?? ""}: {row.decision_note}
                    </p>
                  ) : null}
                  {row.decided_at ? (
                    <p className="text-xs text-muted-foreground">
                      Diputuskan {formatDateTime(row.decided_at)}
                    </p>
                  ) : null}
                  <AttachmentLink path={row.attachment_path} name={row.attachment_name} />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="nilai" className="space-y-2">
          {assessment.loading ? (
            <InlineLoading />
          ) : !result ? (
            <EmptyState icon={GraduationCap} title="Nilai belum diisi" />
          ) : (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Hasil Penilaian</CardTitle>
                {result.predicate ? (
                  <Badge>
                    {result.predicate} - {PREDICATE_LABEL[result.predicate]}
                  </Badge>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Detail label="Presensi" value={result.score_attendance} />
                  <Detail label="Jurnal" value={result.score_journal} />
                  <Detail label="Kedisiplinan" value={result.score_discipline} />
                  <Detail label="Kompetensi" value={result.score_competence} />
                  <Detail label="Sikap" value={result.score_attitude} />
                  <Detail label="Nilai Akhir" value={result.final_score} />
                </dl>
                {result.notes ? <p className="text-sm text-muted-foreground">{result.notes}</p> : null}
                {result.assessed_by_name ? (
                  <p className="text-xs text-muted-foreground">
                    Dinilai oleh {result.assessed_by_name}
                    {result.assessed_at ? ` pada ${formatDateTime(result.assessed_at)}` : ""}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value === null || value === undefined || value === "" ? "-" : value}</dd>
    </div>
  )
}
