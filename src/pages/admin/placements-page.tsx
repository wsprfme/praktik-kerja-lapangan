import { useEffect, useState } from "react"
import { ClipboardList, Search, UserCog } from "lucide-react"
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
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchCompanies, fetchPeriods, fetchProfilesByRole, fetchStudentOverviews, logActivity } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import { PLACEMENT_STATUS_CLASS, PLACEMENT_STATUS_LABEL, formatDate } from "@/lib/format"
import type { Company, PklPeriod, PlacementStatus, Profile, StudentOverview } from "@/lib/types"

interface PlacementForm {
  company_id: string
  supervisor_id: string
  period_id: string
  start_date: string
  end_date: string
  status: PlacementStatus
  notes: string
}

const EMPTY: PlacementForm = {
  company_id: "",
  supervisor_id: "",
  period_id: "",
  start_date: "",
  end_date: "",
  status: "draft",
  notes: "",
}

export function AdminPlacementsPage() {
  const { profile: admin } = useAuth()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<StudentOverview | null>(null)
  const [form, setForm] = useState<PlacementForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  const data = useAsyncData(
    async () => {
      const [overviews, companies, supervisors, periods] = await Promise.all([
        fetchStudentOverviews(),
        fetchCompanies(),
        fetchProfilesByRole("pembimbing"),
        fetchPeriods(),
      ])
      return { overviews, companies, supervisors, periods }
    },
    {
      overviews: [] as StudentOverview[],
      companies: [] as Company[],
      supervisors: [] as Profile[],
      periods: [] as PklPeriod[],
    },
  )

  useEffect(() => {
    if (!open || !target) return
    const activePeriod = data.data.periods.find((p) => p.is_active)
    setForm({
      company_id: target.placement?.company_id ?? "",
      supervisor_id: target.placement?.supervisor_id ?? "",
      period_id: target.placement?.period_id ?? activePeriod?.id ?? "",
      start_date: target.placement?.start_date ?? "",
      end_date: target.placement?.end_date ?? "",
      status: target.placement?.status ?? "draft",
      notes: target.placement?.notes ?? "",
    })
  }, [open, target, data.data.periods])

  const update = <K extends keyof PlacementForm>(key: K, value: PlacementForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const filtered = data.data.overviews.filter((row) => {
    const term = query.trim().toLowerCase()
    if (!term) return true
    return (
      row.profile.full_name.toLowerCase().includes(term) ||
      (row.detail?.class_name ?? "").toLowerCase().includes(term) ||
      (row.company?.name ?? "").toLowerCase().includes(term)
    )
  })

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!target) return

    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      toast.error("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.")
      return
    }
    if (form.status === "aktif" && (!form.company_id || !form.supervisor_id || !form.period_id)) {
      toast.error("Penempatan aktif wajib memiliki perusahaan, pembimbing, dan periode.")
      return
    }

    setSaving(true)
    const payload = {
      student_id: target.profile.id,
      company_id: form.company_id || null,
      supervisor_id: form.supervisor_id || null,
      period_id: form.period_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
    }

    const { error } = target.placement
      ? await supabase.from("placements").update(payload).eq("id", target.placement.id)
      : await supabase.from("placements").insert(payload)
    setSaving(false)

    if (error) {
      toast.error(
        error.message.includes("uq_placements_active_student_period")
          ? "Siswa ini sudah memiliki penempatan aktif pada periode tersebut."
          : "Gagal menyimpan penempatan.",
      )
      return
    }

    if (admin) {
      await logActivity({
        action: "Ubah Penempatan",
        description: `Memperbarui penempatan ${target.profile.full_name}`,
        entityType: "placement",
        entityId: target.profile.id,
        actor: admin,
      })
    }

    toast.success("Penempatan berhasil disimpan.")
    setOpen(false)
    setTarget(null)
    data.reload()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Penempatan Siswa"
        description="Tetapkan perusahaan, pembimbing, dan periode PKL untuk setiap siswa."
      />

      <div className="relative w-full sm:w-80">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari siswa, kelas, atau perusahaan..."
          className="pl-9"
        />
      </div>

      {data.loading ? (
        <LoadingState rows={5} />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={query ? "Tidak ada hasil" : "Belum ada siswa"}
          description={
            query
              ? "Coba kata kunci lain."
              : "Buat akun siswa terlebih dahulu, lalu atur penempatan PKL mereka di sini."
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daftar Penempatan</CardTitle>
            <CardDescription>{filtered.length} siswa ditampilkan.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[46rem] divide-y">
              {filtered.map((row) => (
                <div key={row.profile.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.profile.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.detail?.class_name ?? "Kelas belum diisi"} - {row.detail?.nis ?? "NIS belum diisi"}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{row.company?.name ?? "Belum ada perusahaan"}</p>
                    <p className="text-xs text-muted-foreground">
                      Pembimbing: {row.supervisor?.full_name ?? "Belum ditentukan"}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{row.period?.name ?? "Belum ada periode"}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.placement?.start_date
                        ? `${formatDate(row.placement.start_date)} - ${formatDate(row.placement.end_date)}`
                        : "Tanggal belum diatur"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      label={PLACEMENT_STATUS_LABEL[row.placement?.status ?? "draft"]}
                      className={PLACEMENT_STATUS_CLASS[row.placement?.status ?? "draft"]}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTarget(row)
                        setOpen(true)
                      }}
                    >
                      <UserCog />
                      Atur
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setTarget(null)
        }}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Atur Penempatan</DialogTitle>
            <DialogDescription>{target?.profile.full_name}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={save}>
            <Field>
              <FieldLabel htmlFor="perusahaan">Perusahaan</FieldLabel>
              <NativeSelect
                id="perusahaan"
                value={form.company_id}
                onChange={(e) => update("company_id", e.target.value)}
              >
                <option value="">Belum ditentukan</option>
                {data.data.companies
                  .filter((c) => c.is_active || c.id === form.company_id)
                  .map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
              </NativeSelect>
              {data.data.companies.length === 0 ? (
                <FieldDescription>Belum ada perusahaan. Tambahkan di menu Perusahaan.</FieldDescription>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="pembimbing">Pembimbing</FieldLabel>
              <NativeSelect
                id="pembimbing"
                value={form.supervisor_id}
                onChange={(e) => update("supervisor_id", e.target.value)}
              >
                <option value="">Belum ditentukan</option>
                {data.data.supervisors
                  .filter((s) => s.is_active || s.id === form.supervisor_id)
                  .map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.full_name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>

            <Field>
              <FieldLabel htmlFor="periode">Periode PKL</FieldLabel>
              <NativeSelect
                id="periode"
                value={form.period_id}
                onChange={(e) => update("period_id", e.target.value)}
              >
                <option value="">Belum ditentukan</option>
                {data.data.periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({period.academic_year})
                    {period.is_active ? " - aktif" : ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="mulai-pkl">Tanggal Mulai</FieldLabel>
                <Input
                  id="mulai-pkl"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => update("start_date", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="selesai-pkl">Tanggal Selesai</FieldLabel>
                <Input
                  id="selesai-pkl"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => update("end_date", e.target.value)}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="status-penempatan">Status Penempatan</FieldLabel>
              <NativeSelect
                id="status-penempatan"
                value={form.status}
                onChange={(e) => update("status", e.target.value as PlacementStatus)}
              >
                <option value="draft">Draf</option>
                <option value="aktif">Aktif</option>
                <option value="selesai">Selesai</option>
                <option value="dibatalkan">Dibatalkan</option>
              </NativeSelect>
              <FieldDescription>
                Siswa hanya dapat melakukan presensi dan jurnal pada penempatan berstatus aktif.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="catatan-penempatan">Catatan</FieldLabel>
              <Textarea
                id="catatan-penempatan"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Penempatan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
