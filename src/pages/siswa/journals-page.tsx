import { useEffect, useState } from "react"
import { BookOpen, MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { AttachmentLink } from "@/components/student-detail"
import { EmptyState, ErrorState, LoadingState } from "@/components/page-states"
import { Fab, ResponsiveSheet, ScreenHeader } from "@/components/mobile-ui"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchJournals } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import { uploadStudentFile } from "@/lib/storage"
import {
  REVIEW_CLASS,
  REVIEW_LABEL,
  formatDate,
  formatDuration,
  formatDateTime,
  monthLabel,
  todayISO,
} from "@/lib/format"
import type { Journal, ReviewStatus } from "@/lib/types"

interface Form {
  date: string
  title: string
  description: string
  duration: string
  file: File | null
}

const EMPTY: Form = { date: todayISO(), title: "", description: "", duration: "", file: null }

export function SiswaJournalsPage() {
  const { profile } = useAuth()
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Journal | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)

  const data = useAsyncData(
    () => (profile ? fetchJournals({ studentId: profile.id }) : Promise.resolve([] as Journal[])),
    [] as Journal[],
    [profile?.id],
  )

  useEffect(() => {
    if (!open) return
    setForm(
      editing
        ? {
            date: editing.date,
            title: editing.title,
            description: editing.description ?? "",
            duration: editing.duration_minutes?.toString() ?? "",
            file: null,
          }
        : EMPTY,
    )
  }, [open, editing])

  const filtered = data.data.filter((journal) => {
    if (!journal.date.startsWith(month)) return false
    const term = query.trim().toLowerCase()
    if (!term) return true
    return (
      journal.title.toLowerCase().includes(term) ||
      (journal.description ?? "").toLowerCase().includes(term)
    )
  })

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile) return
    if (!form.title.trim()) {
      toast.error("Judul kegiatan wajib diisi.")
      return
    }
    if (!form.date) {
      toast.error("Tanggal kegiatan wajib diisi.")
      return
    }

    const duration = form.duration.trim() === "" ? null : Number(form.duration)
    if (duration !== null && (Number.isNaN(duration) || duration < 0)) {
      toast.error("Durasi harus berupa angka menit yang valid.")
      return
    }

    setSaving(true)
    try {
      let attachmentPath = editing?.attachment_path ?? null
      let attachmentName = editing?.attachment_name ?? null

      if (form.file) {
        const uploaded = await uploadStudentFile(profile.id, "jurnal", form.file)
        attachmentPath = uploaded.path
        attachmentName = uploaded.name
      }

      const payload = {
        student_id: profile.id,
        date: form.date,
        title: form.title.trim(),
        description: form.description.trim() || null,
        duration_minutes: duration,
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
      }

      const { error } = editing
        ? await supabase.from("journals").update(payload).eq("id", editing.id)
        : await supabase.from("journals").insert(payload)
      if (error) throw new Error(error.message)

      toast.success(editing ? "Jurnal diperbarui." : "Jurnal berhasil disimpan.")
      setOpen(false)
      setEditing(null)
      data.reload()
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.includes("duplicate")
          ? "Jurnal untuk tanggal tersebut sudah ada. Silakan ubah jurnal yang sudah dibuat."
          : "Gagal menyimpan jurnal. Silakan coba lagi.",
      )
    } finally {
      setSaving(false)
    }
  }

  const remove = async (journal: Journal) => {
    const { error } = await supabase.from("journals").delete().eq("id", journal.id)
    if (error) {
      toast.error("Gagal menghapus jurnal.")
      return
    }
    toast.success("Jurnal dihapus.")
    data.reload()
  }

  return (
    <div className="space-y-5">
      <ScreenHeader title="Jurnal Harian" description="Catat kegiatan PKL Anda setiap hari." />

      <div className="flex gap-2">
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-10 w-[9.5rem] shrink-0"
        />
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kegiatan..."
            className="h-10 pl-9"
          />
        </div>
      </div>

      {data.loading ? (
        <LoadingState rows={4} />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={query || month ? `Tidak ada jurnal pada ${monthLabel(month)}` : "Belum ada jurnal"}
          description="Tulis jurnal harian untuk mencatat kegiatan PKL Anda dan lampirkan bukti bila ada."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((journal) => (
            <Card key={journal.id} className="gap-0 py-0">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold">{journal.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(journal.date)} - {formatDuration(journal.duration_minutes)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StatusBadge
                      label={REVIEW_LABEL[journal.review_status as ReviewStatus]}
                      className={REVIEW_CLASS[journal.review_status as ReviewStatus]}
                    />
                    {journal.review_status === "menunggu" ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label="Aksi jurnal">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(journal)
                              setOpen(true)
                            }}
                          >
                            <Pencil />
                            Ubah
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => remove(journal)}>
                            <Trash2 />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>

                {journal.description ? (
                  <p className="line-clamp-3 text-sm text-muted-foreground">{journal.description}</p>
                ) : null}

                {journal.supervisor_feedback ? (
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Umpan balik {journal.reviewed_by_name ?? "pembimbing"}
                    </p>
                    {journal.supervisor_feedback}
                  </div>
                ) : journal.review_status === "menunggu" ? (
                  <p className="text-xs text-muted-foreground">Menunggu tinjauan pembimbing.</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <AttachmentLink path={journal.attachment_path} name={journal.attachment_name} />
                  {journal.review_status === "ditinjau" && journal.reviewed_at ? (
                    <span className="text-xs text-muted-foreground">
                      Ditinjau {formatDateTime(journal.reviewed_at)}
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Fab
        label="Tulis Jurnal"
        icon={Plus}
        onClick={() => {
          setEditing(null)
          setOpen(true)
        }}
      />

      <ResponsiveSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditing(null)
        }}
        title={editing ? "Ubah Jurnal" : "Tulis Jurnal Harian"}
        description="Satu jurnal per hari. Jurnal yang sudah ditinjau tidak dapat diubah."
      >
        <form className="space-y-4 pb-2" onSubmit={save}>
          <Field>
            <FieldLabel htmlFor="tanggal-jurnal">Tanggal</FieldLabel>
            <Input
              id="tanggal-jurnal"
              type="date"
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="judul-jurnal">Judul Kegiatan</FieldLabel>
            <Input
              id="judul-jurnal"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Contoh: Membuat desain banner promosi"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="uraian-jurnal">Uraian Kegiatan</FieldLabel>
            <Textarea
              id="uraian-jurnal"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Jelaskan apa yang Anda kerjakan, alat yang dipakai, dan hasilnya."
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="durasi-jurnal">Durasi (menit)</FieldLabel>
            <Input
              id="durasi-jurnal"
              type="number"
              min={0}
              value={form.duration}
              onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
              placeholder="Contoh: 480"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bukti-jurnal">Lampiran Bukti (opsional)</FieldLabel>
            <Input
              id="bukti-jurnal"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setForm((prev) => ({ ...prev, file: e.target.files?.[0] ?? null }))}
            />
            <FieldDescription>Foto atau PDF maksimal sesuai kuota penyimpanan.</FieldDescription>
          </Field>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </ResponsiveSheet>
    </div>
  )
}
