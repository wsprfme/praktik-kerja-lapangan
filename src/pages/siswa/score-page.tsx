import { BarChart3 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchAssessments, fetchStudentOverview } from "@/lib/queries"
import { PREDICATE_LABEL, formatDateTime } from "@/lib/format"

const COMPONENTS: { key: keyof ScoreRow; label: string }[] = [
  { key: "score_attendance", label: "Presensi" },
  { key: "score_journal", label: "Jurnal" },
  { key: "score_discipline", label: "Kedisiplinan" },
  { key: "score_competence", label: "Kompetensi" },
  { key: "score_attitude", label: "Sikap" },
]

interface ScoreRow {
  score_attendance: number | null
  score_journal: number | null
  score_discipline: number | null
  score_competence: number | null
  score_attitude: number | null
}

export function SiswaScorePage() {
  const { profile } = useAuth()

  const data = useAsyncData(
    async () => {
      if (!profile) return { assessment: null, overview: null }
      const [assessments, overview] = await Promise.all([
        fetchAssessments([profile.id]),
        fetchStudentOverview(profile.id),
      ])
      return { assessment: assessments[0] ?? null, overview }
    },
    { assessment: null, overview: null },
    [profile?.id],
  )

  if (data.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Nilai PKL" description="Hasil penilaian dari pembimbing Anda." />
        <LoadingState rows={3} />
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Nilai PKL" description="Hasil penilaian dari pembimbing Anda." />
        <ErrorState message={data.error} onRetry={data.reload} />
      </div>
    )
  }

  const { assessment, overview } = data.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nilai PKL"
        description={
          overview?.period?.name
            ? `Periode ${overview.period.name} - ${overview.company?.name ?? "Tanpa perusahaan"}`
            : "Hasil penilaian dari pembimbing Anda."
        }
      />

      {!assessment || assessment.final_score === null ? (
        <EmptyState
          icon={BarChart3}
          title="Nilai belum tersedia"
          description="Pembimbing belum mengisi penilaian PKL Anda. Nilai akan muncul di halaman ini setelah diisi."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nilai Akhir</CardTitle>
              <CardDescription>
                {assessment.assessed_by_name
                  ? `Dinilai oleh ${assessment.assessed_by_name}${
                      assessment.assessed_at ? ` pada ${formatDateTime(assessment.assessed_at)}` : ""
                    }`
                  : "Penilaian pembimbing"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-6">
              <div className="flex size-28 flex-col items-center justify-center rounded-full border-4 border-primary/20">
                <span className="text-3xl font-semibold">{assessment.final_score}</span>
                <span className="text-xs text-muted-foreground">dari 100</span>
              </div>
              {assessment.predicate ? (
                <div className="space-y-1">
                  <StatusBadge
                    label={`Predikat ${assessment.predicate}`}
                    className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30"
                  />
                  <p className="text-sm text-muted-foreground">{PREDICATE_LABEL[assessment.predicate]}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rincian Komponen</CardTitle>
              <CardDescription>Nilai setiap komponen penilaian PKL.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {COMPONENTS.map((component) => {
                const value = assessment[component.key] as number | null
                return (
                  <div key={component.key} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{component.label}</span>
                      <span className="text-muted-foreground">{value ?? "-"}</span>
                    </div>
                    <Progress value={value ?? 0} />
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {assessment.notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Catatan Pembimbing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{assessment.notes}</p>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}
