import { BarChart3, Award, StickyNote } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { EmptyState, ErrorState, LoadingState } from "@/components/page-states"
import { ScreenHeader } from "@/components/mobile-ui"
import { Card, CardContent } from "@/components/ui/card"
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
      <div className="space-y-5">
        <ScreenHeader title="Nilai PKL" description="Hasil penilaian dari pembimbing Anda." />
        <LoadingState rows={3} />
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="space-y-5">
        <ScreenHeader title="Nilai PKL" description="Hasil penilaian dari pembimbing Anda." />
        <ErrorState message={data.error} onRetry={data.reload} />
      </div>
    )
  }

  const { assessment, overview } = data.data

  return (
    <div className="space-y-5">
      <ScreenHeader
        title="Nilai PKL"
        description={
          overview?.period?.name
            ? `${overview.period.name} - ${overview.company?.name ?? "Tanpa perusahaan"}`
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
          <Card className="gap-0 border-0 bg-primary py-0 text-primary-foreground shadow-lg shadow-primary/20">
            <CardContent className="flex items-center gap-5 p-5">
              <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-full bg-primary-foreground/15">
                <span className="text-2xl font-semibold">{assessment.final_score}</span>
                <span className="text-[10px] opacity-80">dari 100</span>
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs opacity-80">Nilai akhir PKL</p>
                {assessment.predicate ? (
                  <p className="text-lg font-semibold">{assessment.predicate}</p>
                ) : null}
                <p className="text-xs opacity-90">
                  {assessment.predicate ? `${PREDICATE_LABEL[assessment.predicate]} - ` : ""}
                  {assessment.assessed_by_name
                    ? `oleh ${assessment.assessed_by_name}`
                    : "dinilai pembimbing"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center gap-2">
                <Award className="size-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Rincian komponen</p>
              </div>
              {COMPONENTS.map((component) => {
                const value = assessment[component.key] as number | null
                return (
                  <div key={component.key} className="space-y-1.5">
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
            <Card className="gap-0 py-0">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  <StickyNote className="size-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Catatan pembimbing</p>
                </div>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{assessment.notes}</p>
                {assessment.assessed_at ? (
                  <p className="text-xs text-muted-foreground">
                    Dinilai pada {formatDateTime(assessment.assessed_at)}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  )
}
