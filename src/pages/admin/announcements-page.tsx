import { useEffect, useState } from "react"
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { useAsyncData } from "@/hooks/use-async-data"
import { supabase } from "@/lib/supabase"
import { formatDateTime } from "@/lib/format"
import type { Announcement, AnnouncementAudience } from "@/lib/types"

const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  semua: "Semua Pengguna",
  pembimbing: "Pembimbing",
  siswa: "Siswa",
}

interface Form {
  title: string
  body: string
  audience: AnnouncementAudience
}

const EMPTY: Form = { title: "", body: "", audience: "semua" }

async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Announcement[]
}

export function AdminAnnouncementsPage() {
  const { profile } = useAuth()
  const data = useAsyncData(fetchAnnouncements, [] as Announcement[])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(editing ? { title: editing.title, body: editing.body, audience: editing.audience } : EMPTY)
  }, [open, editing])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Judul dan isi pengumuman wajib diisi.")
      return
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      audience: form.audience,
      created_by: profile?.id ?? null,
      created_by_name: profile?.full_name ?? null,
    }
    const { error } = editing
      ? await supabase.from("announcements").update(payload).eq("id", editing.id)
      : await supabase.from("announcements").insert(payload)
    setSaving(false)

    if (error) {
      toast.error("Gagal menyimpan pengumuman.")
      return
    }
    toast.success("Pengumuman disimpan.")
    setOpen(false)
    setEditing(null)
    data.reload()
  }

  const remove = async (announcement: Announcement) => {
    const { error } = await supabase.from("announcements").delete().eq("id", announcement.id)
    if (error) {
      toast.error("Gagal menghapus pengumuman.")
      return
    }
    toast.success("Pengumuman dihapus.")
    data.reload()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pengumuman" description="Bagikan informasi penting kepada pengguna sistem.">
        <Button
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <Plus />
          Buat Pengumuman
        </Button>
      </PageHeader>

      {data.loading ? (
        <LoadingState rows={3} />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Belum ada pengumuman"
          description="Pengumuman akan tampil pada dashboard penerima yang sesuai."
        />
      ) : (
        <div className="space-y-4">
          {data.data.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base">{announcement.title}</CardTitle>
                  <CardDescription>
                    {AUDIENCE_LABEL[announcement.audience]} - {formatDateTime(announcement.created_at)}
                    {announcement.created_by_name ? ` - oleh ${announcement.created_by_name}` : ""}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <Pencil />
                      <span className="sr-only">Menu pengumuman</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(announcement)
                        setOpen(true)
                      }}
                    >
                      <Pencil />
                      Ubah
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => remove(announcement)}>
                      <Trash2 />
                      Hapus
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{announcement.body}</p>
                <StatusBadge
                  label={AUDIENCE_LABEL[announcement.audience]}
                  className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30"
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
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Pengumuman" : "Buat Pengumuman"}</DialogTitle>
            <DialogDescription>Pilih siapa yang akan menerima pengumuman ini.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={save}>
            <Field>
              <FieldLabel htmlFor="judul-pengumuman">Judul</FieldLabel>
              <Input
                id="judul-pengumuman"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="isi-pengumuman">Isi Pengumuman</FieldLabel>
              <Textarea
                id="isi-pengumuman"
                rows={5}
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="sasaran">Sasaran</FieldLabel>
              <NativeSelect
                id="sasaran"
                value={form.audience}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, audience: e.target.value as AnnouncementAudience }))
                }
              >
                <option value="semua">Semua Pengguna</option>
                <option value="pembimbing">Hanya Pembimbing</option>
                <option value="siswa">Hanya Siswa</option>
              </NativeSelect>
            </Field>
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
