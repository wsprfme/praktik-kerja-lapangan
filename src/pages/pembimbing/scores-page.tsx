import { useEffect, useState } from "react"
import { BarChart3, Search } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
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
import { Textarea } from "@/components/ui/textarea"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchAssessments, fetchStudentOverviews } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import { PREDICATE_LABEL, predicateFor } from "@/lib/format"
import type { Assessment } from "@/lib/types"

interface ScoreForm {
  score_attendance: string
  score_journal: string
  score_discipline: string
  score_competence: string
  score_attitude: string
  notes: string
}

const EMPTY: ScoreForm = {
  score_attendance: "",
  score_journal: "",
  score_discipline: "",
  score_competence: "",
  score_attitude: "",
  notes: "",
}

export function PembimbingScoresPage() {
  const { profile } = useAuth()
  const [query, setQuery] = useState("")
  const [target, setTarget] = useState<string | null>(null)
  const [form, setForm] = useState<ScoreForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  const data = useAsyncData(
    async () => {
      const [overviews, assessments] = await Promise.all([fetchStudentOverviews(), fetchAssessments()])
      return { overviews, assessments }
    },
    { overviews: [], assessments: [] as Assessment[] },
    [profile?.id],
  )

  const targetStudent = data.data.overviews.find((row) => row.profile.id === target) ?? null
  const targetAssessment =
    data.data.assessments.find((a) => a.student_id === target) ?? null

  useEffect(() => {
    if (!target) return
    setForm(
      targetAssessment
        ? {
            score_attendance: targetAssessment.score_attendance?.toString() ?? "",
            score_journal: targetAssessment.score_journal?.toString() ?? "",
            score_discipline: targetAssessment.score_discipline?.toString() ?? "",
            score_competence: targetAssessment.score_competence?.toString() ?? "",
            score_attitude: targetAssessment.score_attitude?.toString() ?? "",
            notes: targetAssessment.notes ?? "",
          }
        : EMPTY,
    )
  }, [target, targetAssessment])

  const filtered = data.data.overviews.filter((row) => {
    const term = query.trim().toLowerCase()
    if (!term) return true
    return (
      row.profile.full_name.toLowerCase().includes(term) ||
      (row.detail?.class_name ?? "").toLowerCase().includes(term)
    )
  })

  const parsed = [form.score_attendance, form.score_journal, form.score_discipline, form.score_competence, form.score_attitude]
    .map((value) => (value.trim() === "" ? null : Number(value)))
    .filter((value): value is number => value !== null && !Number.isNaN(value))

  const average = parsed.length > 0 ? parsed.reduce((a, b) => a + b, 0) / parsed.length : null
  const finalScore = average === null ? null : Math.round(average * 100) / 100
  const predicate = predicateFor(finalScore)

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!target || !profile || !targetStudent) return

    const values = [
      form.score_attendance,
      form.score_journal,
      form.score_discipline,
      form.score_competence,
      form.score_attitude,
    ].map((value) => (value.trim() === "" ? null : Number(value)))

    if (values.some((value) => value !== null && (Number.isNaN(value) || value < 0 || value > 100))) {
      toast.error("Setiap nilai harus berupa angka antara 0 dan 100.")
      return
    }
    if (values.every((value) => value === null)) {
      toast.error("Isi minimal satu komponen penilaian.")
      return
    }

    setSaving(true)
    const payload = {
      student_id: target,
      period_id: targetStudent.placement?.period_id ?? null,
      score_attendance: values[0],
      score_journal: values[1],
      score_discipline: values[2],
      score_competence: values[3],
      score_attitude: values[4],
      final_score: finalScore,
      predicate,
      notes: form.notes.trim() || null,
      assessed_by: profile.id,
      assessed_by_name: profile.full_name,
      assessed_at: new Date().toISOString(),
    }

    const { error } = targetAssessment
      ? await supabase.from("assessments").update(payload).eq("id", targetAssessment.id)
      : await supabase.from("assessments").insert(payload)
    setSaving(false)

    if (error) {
      toast.error("Gagal menyimpan penilaian.")
      return
    }
    toast.success("Penilaian berhasil disimpan.")
    setTarget(null)
    data.reload()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Penilaian PKL" description="Berikan nilai untuk siswa bimbingan Anda." />

      <div className="relative w-full sm:w-80">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama siswa..."
          className="pl-9"
        />
      </div>

      {data.loading ? (
        <LoadingState rows={4} />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={query ? "Tidak ada hasil" : "Belum ada siswa bimbingan"}
          description={query ? "Coba kata kunci lain." : "Hubungi Admin untuk penugasan siswa."}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daftar Nilai</CardTitle>
            <CardDescription>{filtered.length} siswa bimbingan.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {filtered.map((row) => {
              const assessment = data.data.assessments.find((a) => a.student_id === row.profile.id)
              return (
                <div key={row.profile.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{row.profile.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.detail?.class_name ?? "-"} - {row.company?.name ?? "Tanpa perusahaan"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {assessment?.final_score !== null && assessment?.final_score !== undefined ? (
                      <StatusBadge
                        label={`${assessment.final_score} - ${assessment.predicate ? PREDICATE_LABEL[assessment.predicate] : "-"}`}
                        className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30"
                      />
                    ) : (
                      <StatusBadge label="Belum dinilai" className="bg-muted text-muted-foreground border-border" />
                    )}
                    <Button size="sm" variant="outline" onClick={() => setTarget(row.profile.id)}>
                      {assessment ? "Ubah Nilai" : "Beri Nilai"}
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Penilaian PKL</DialogTitle>
            <DialogDescription>{targetStudent?.profile.full_name}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={save}>
            <div className="grid gap-4 sm:grid-cols-2">
              <ScoreField
                id="nilai-presensi"
                label="Presensi"
                value={form.score_attendance}
                onChange={(value) => setForm((prev) => ({ ...prev, score_attendance: value }))}
              />
              <ScoreField
                id="nilai-jurnal"
                label="Jurnal"
                value={form.score_journal}
                onChange={(value) => setForm((prev) => ({ ...prev, score_journal: value }))}
              />
              <ScoreField
                id="nilai-kedisiplinan"
                label="Kedisiplinan"
                value={form.score_discipline}
                onChange={(value) => setForm((prev) => ({ ...prev, score_discipline: value }))}
              />
              <ScoreField
                id="nilai-kompetensi"
                label="Kompetensi"
                value={form.score_competence}
                onChange={(value) => setForm((prev) => ({ ...prev, score_competence: value }))}
              />
              <ScoreField
                id="nilai-sikap"
                label="Sikap"
                value={form.score_attitude}
                onChange={(value) => setForm((prev) => ({ ...prev, score_attitude: value }))}
              />
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">Nilai Akhir (rata-rata komponen terisi)</p>
              <p className="text-2xl font-semibold">{finalScore ?? "-"}</p>
              {predicate ? (
                <p className="text-sm text-muted-foreground">
                  Predikat {predicate} - {PREDICATE_LABEL[predicate]}
                </p>
              ) : null}
            </div>

            <Field>
              <FieldLabel htmlFor="catatan-nilai">Catatan Penilaian</FieldLabel>
              <Textarea
                id="catatan-nilai"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
              <FieldDescription>Catatan ini akan terlihat oleh siswa.</FieldDescription>
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTarget(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Penilaian"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ScoreField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        min={0}
        max={100}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0 - 100"
      />
    </Field>
  )
}
