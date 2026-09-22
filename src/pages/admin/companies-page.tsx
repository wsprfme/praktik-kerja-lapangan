import { useEffect, useState } from "react"
import { Building2, MoreHorizontal, Pencil, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-states"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAsyncData } from "@/hooks/use-async-data"
import { fetchCompanies } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import type { Company } from "@/lib/types"

interface CompanyForm {
  name: string
  field_of_work: string
  address: string
  contact_person: string
  contact_phone: string
  contact_email: string
  notes: string
}

const EMPTY: CompanyForm = {
  name: "",
  field_of_work: "",
  address: "",
  contact_person: "",
  contact_phone: "",
  contact_email: "",
  notes: "",
}

export function AdminCompaniesPage() {
  const data = useAsyncData(fetchCompanies, [] as Company[])
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [form, setForm] = useState<CompanyForm>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      editing
        ? {
            name: editing.name,
            field_of_work: editing.field_of_work ?? "",
            address: editing.address ?? "",
            contact_person: editing.contact_person ?? "",
            contact_phone: editing.contact_phone ?? "",
            contact_email: editing.contact_email ?? "",
            notes: editing.notes ?? "",
          }
        : EMPTY,
    )
  }, [open, editing])

  const update = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const filtered = data.data.filter((company) => {
    const term = query.trim().toLowerCase()
    if (!term) return true
    return (
      company.name.toLowerCase().includes(term) ||
      (company.field_of_work ?? "").toLowerCase().includes(term)
    )
  })

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) {
      toast.error("Nama perusahaan wajib diisi.")
      return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      field_of_work: form.field_of_work.trim() || null,
      address: form.address.trim() || null,
      contact_person: form.contact_person.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      contact_email: form.contact_email.trim() || null,
      notes: form.notes.trim() || null,
    }

    const { error } = editing
      ? await supabase.from("companies").update(payload).eq("id", editing.id)
      : await supabase.from("companies").insert(payload)
    setSaving(false)

    if (error) {
      toast.error("Gagal menyimpan data perusahaan.")
      return
    }
    toast.success(editing ? "Data perusahaan diperbarui." : "Perusahaan baru ditambahkan.")
    setOpen(false)
    setEditing(null)
    data.reload()
  }

  const toggleActive = async (company: Company) => {
    const { error } = await supabase
      .from("companies")
      .update({ is_active: !company.is_active })
      .eq("id", company.id)
    if (error) {
      toast.error("Gagal mengubah status perusahaan.")
      return
    }
    toast.success(company.is_active ? "Perusahaan dinonaktifkan." : "Perusahaan diaktifkan.")
    data.reload()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Perusahaan Mitra" description="Kelola daftar industri tempat siswa melaksanakan PKL.">
        <Button
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <Plus />
          Tambah Perusahaan
        </Button>
      </PageHeader>

      <div className="relative w-full sm:w-72">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari perusahaan..."
          className="pl-9"
        />
      </div>

      {data.loading ? (
        <LoadingState rows={4} />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={query ? "Tidak ada hasil" : "Belum ada perusahaan"}
          description={
            query
              ? "Coba kata kunci lain."
              : "Tambahkan perusahaan terlebih dahulu sebelum menempatkan siswa."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((company) => (
            <Card key={company.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-semibold">{company.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {company.field_of_work ?? "Bidang kerja belum diisi"}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal />
                        <span className="sr-only">Menu perusahaan</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(company)
                          setOpen(true)
                        }}
                      >
                        <Pencil />
                        Ubah Data
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive(company)}>
                        {company.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <dl className="space-y-1 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Narahubung</dt>
                    <dd>{company.contact_person ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Telepon</dt>
                    <dd>{company.contact_phone ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Alamat</dt>
                    <dd className="text-muted-foreground">{company.address ?? "-"}</dd>
                  </div>
                </dl>

                <StatusBadge
                  label={company.is_active ? "Aktif" : "Nonaktif"}
                  className={
                    company.is_active
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
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Data Perusahaan" : "Tambah Perusahaan"}</DialogTitle>
            <DialogDescription>Lengkapi informasi mitra industri untuk keperluan PKL.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={save}>
            <Field>
              <FieldLabel htmlFor="nama-perusahaan">Nama Perusahaan</FieldLabel>
              <Input id="nama-perusahaan" value={form.name} onChange={(e) => update("name", e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="bidang-kerja">Bidang Kerja</FieldLabel>
              <Input
                id="bidang-kerja"
                value={form.field_of_work}
                onChange={(e) => update("field_of_work", e.target.value)}
                placeholder="Contoh: Teknologi Informasi"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="alamat-perusahaan">Alamat</FieldLabel>
              <Input id="alamat-perusahaan" value={form.address} onChange={(e) => update("address", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="narahubung">Narahubung</FieldLabel>
                <Input
                  id="narahubung"
                  value={form.contact_person}
                  onChange={(e) => update("contact_person", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="telepon-perusahaan">Telepon</FieldLabel>
                <Input
                  id="telepon-perusahaan"
                  value={form.contact_phone}
                  onChange={(e) => update("contact_phone", e.target.value)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="email-perusahaan">Email</FieldLabel>
              <Input
                id="email-perusahaan"
                type="email"
                value={form.contact_email}
                onChange={(e) => update("contact_email", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="catatan-perusahaan">Catatan</FieldLabel>
              <Textarea
                id="catatan-perusahaan"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
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
