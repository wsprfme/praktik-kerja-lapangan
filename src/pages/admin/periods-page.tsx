import { useEffect, useState } from "react"
import { CalendarDays, MoreHorizontal, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchPeriods } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import { formatDate, todayISO } from "@/lib/format"
import type { PklPeriod } from "@/lib/types"

interface PeriodForm {
  name: string
  academic_year: string
  start_date: string
  end_date: string
  is_active: boolean
}

const EMPTY: PeriodForm = {
  name: "",
  academic_year: "",
  start_date: todayISO(),
  end_date: todayISO(),
  is_active: false,
}

export function AdminPeriodsPage() {
  const data = useAsyncData(fetchPeriods, [] as PklPeriod[])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PklPeriod | null>(null)
  const [form, setForm] = useState<PeriodForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      editing
        ? {
            name: editing.name,
            academic_year: editing.academic_year,
            start_date: editing.start_date,
            end_date: editing.end_date,
            is_active: editing.is_active,
          }
        : EMPTY,
    )
  }, [open, editing])

  const update = <K extends keyof PeriodForm>(key: K, value: PeriodForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || !form.academic_year.trim()) {
      toast.error("Nama periode dan tahun ajaran wajib diisi.")
      return
    }
    if (form.end_date < form.start_date) {
      toast.error("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.")
      return
    }

    setSaving(true)
    try {
      if (form.is_active) {
        const { error: resetError } = await supabase
          .from("pkl_periods")
          .update({ is_active: false })
          .neq("id", editing?.id ?? "00000000-0000-0000-0000-000000000000")
        if (resetError) throw new Error(resetError.message)
      }

      const payload = {
        name: form.name.trim(),
        academic_year: form.academic_year.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        is_active: form.is_active,
      }

      const { error } = editing
        ? await supabase.from("pkl_periods").update(payload).eq("id", editing.id)
        : await supabase.from("pkl_periods").insert(payload)
      if (error) throw new Error(error.message)

      toast.success(editing ? "Periode diperbarui." : "Periode baru ditambahkan.")
      setOpen(false)
      setEditing(null)
      data.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan periode.")
    } finally {
      setSaving(false)
    }
  }

  const setActive = async (period: PklPeriod) => {
    const { error: resetError } = await supabase.from("pkl_periods").update({ is_active: false }).neq("id", period.id)
    if (resetError) {
      toast.error("Gagal mengubah periode aktif.")
      return
    }
    const { error } = await supabase.from("pkl_periods").update({ is_active: true }).eq("id", period.id)
    if (error) {
      toast.error("Gagal mengubah periode aktif.")
      return
    }
    toast.success(`${period.name} ditetapkan sebagai periode aktif.`)
    data.reload()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Periode PKL" description="Atur periode pelaksanaan PKL dan tetapkan periode yang sedang berjalan.">
        <Button
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <Plus />
          Tambah Periode
        </Button>
      </PageHeader>

      {data.loading ? (
        <LoadingState rows={3} />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Belum ada periode PKL"
          description="Tambahkan periode agar siswa dan pembimbing dapat melihat rentang waktu PKL."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.data.map((period) => (
            <Card key={period.id}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="truncate text-base">{period.name}</CardTitle>
                  <CardDescription>Tahun Ajaran {period.academic_year}</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal />
                      <span className="sr-only">Menu periode</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(period)
                        setOpen(true)
                      }}
                    >
                      <Pencil />
                      Ubah Data
                    </DropdownMenuItem>
                    {!period.is_active ? (
                      <DropdownMenuItem onClick={() => setActive(period)}>Jadikan Aktif</DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="space-y-1 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Mulai</dt>
                    <dd>{formatDate(period.start_date)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Selesai</dt>
                    <dd>{formatDate(period.end_date)}</dd>
                  </div>
                </dl>
                <StatusBadge
                  label={period.is_active ? "Periode Aktif" : "Tidak Aktif"}
                  className={
                    period.is_active
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-muted text-muted-foreground border-border"
                  }
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Periode PKL" : "Tambah Periode PKL"}</DialogTitle>
            <DialogDescription>
              Hanya satu periode yang dapat berstatus aktif pada satu waktu.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={save}>
            <Field>
              <FieldLabel htmlFor="nama-periode">Nama Periode</FieldLabel>
              <Input
                id="nama-periode"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Contoh: PKL Gelombang 1"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="tahun-ajaran">Tahun Ajaran</FieldLabel>
              <Input
                id="tahun-ajaran"
                value={form.academic_year}
                onChange={(e) => update("academic_year", e.target.value)}
                placeholder="Contoh: 2025/2026"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="mulai">Tanggal Mulai</FieldLabel>
                <Input
                  id="mulai"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => update("start_date", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="selesai">Tanggal Selesai</FieldLabel>
                <Input
                  id="selesai"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => update("end_date", e.target.value)}
                />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Jadikan periode aktif</p>
                <p className="text-xs text-muted-foreground">
                  Periode aktif menjadi acuan utama di seluruh sistem.
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => update("is_active", checked)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
