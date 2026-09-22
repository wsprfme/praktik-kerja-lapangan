import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { callAdminUsers } from "@/lib/supabase"
import { PASSWORD_HINT, validatePassword } from "@/lib/password"
import type { PembimbingProfile, Profile, SiswaProfile } from "@/lib/types"

interface AccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editing: Profile | null
  editingExtra: SiswaProfile | PembimbingProfile | null
  defaultRole?: "pembimbing" | "siswa"
}

interface FormState {
  role: "pembimbing" | "siswa"
  full_name: string
  email: string
  password: string
  phone: string
  address: string
  nis: string
  class_name: string
  major: string
  nip: string
  department: string
}

const EMPTY: FormState = {
  role: "siswa",
  full_name: "",
  email: "",
  password: "",
  phone: "",
  address: "",
  nis: "",
  class_name: "",
  major: "",
  nip: "",
  department: "",
}

export function AccountFormDialog({
  open,
  onOpenChange,
  onSaved,
  editing,
  editingExtra,
  defaultRole = "siswa",
}: AccountFormDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const passwordIssue = form.password ? validatePassword(form.password) : null

  useEffect(() => {
    if (!open) return
    if (editing) {
      const extra = editingExtra as SiswaProfile & PembimbingProfile | null
      setForm({
        role: editing.role === "pembimbing" ? "pembimbing" : "siswa",
        full_name: editing.full_name,
        email: editing.email,
        password: "",
        phone: editing.phone ?? "",
        address: editing.address ?? "",
        nis: extra?.nis ?? "",
        class_name: extra?.class_name ?? "",
        major: extra?.major ?? "",
        nip: extra?.nip ?? "",
        department: extra?.department ?? "",
      })
    } else {
      setForm({ ...EMPTY, role: defaultRole })
    }
  }, [open, editing, editingExtra, defaultRole])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error("Nama lengkap dan email wajib diisi.")
      return
    }
    if (!editing) {
      const issue = validatePassword(form.password)
      if (issue) {
        toast.error(issue)
        return
      }
    } else if (form.password) {
      const issue = validatePassword(form.password)
      if (issue) {
        toast.error(issue)
        return
      }
    }

    setSaving(true)
    try {
      const base = {
        role: form.role,
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        nis: form.nis.trim() || null,
        class_name: form.class_name.trim() || null,
        major: form.major.trim() || null,
        nip: form.nip.trim() || null,
        department: form.department.trim() || null,
      }

      if (editing) {
        await callAdminUsers({
          action: "update",
          user_id: editing.id,
          ...base,
          password: form.password || undefined,
        })
        toast.success("Data akun berhasil diperbarui.")
      } else {
        await callAdminUsers({
          action: "create",
          ...base,
          password: form.password,
        })
        toast.success("Akun baru berhasil dibuat.")
      }

      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan akun.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Ubah Data Akun" : "Buat Akun Baru"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Perbarui data akun. Kosongkan kata sandi jika tidak ingin mengubahnya."
              : "Akun dibuat langsung aktif dan dapat digunakan untuk masuk."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {!editing ? (
            <Field>
              <FieldLabel htmlFor="peran">Peran Akun</FieldLabel>
              <Select value={form.role} onValueChange={(value) => update("role", value as FormState["role"])}>
                <SelectTrigger id="peran" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="siswa">Siswa</SelectItem>
                  <SelectItem value="pembimbing">Pembimbing</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field>
            <FieldLabel htmlFor="nama">Nama Lengkap</FieldLabel>
            <Input id="nama" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
          </Field>

          <Field>
            <FieldLabel htmlFor="email-akun">Email</FieldLabel>
            <Input id="email-akun" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          </Field>

          <Field>
            <FieldLabel htmlFor="password-akun">
              {editing ? "Kata Sandi Baru (opsional)" : "Kata Sandi Awal"}
            </FieldLabel>
            <Input
              id="password-akun"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
            <FieldDescription>{PASSWORD_HINT}</FieldDescription>
            {passwordIssue ? (
              <p className="text-xs text-destructive">{passwordIssue}</p>
            ) : null}
          </Field>

          {form.role === "siswa" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="nis">NIS</FieldLabel>
                <Input id="nis" value={form.nis} onChange={(e) => update("nis", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="kelas">Kelas</FieldLabel>
                <Input id="kelas" value={form.class_name} onChange={(e) => update("class_name", e.target.value)} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="jurusan">Jurusan</FieldLabel>
                <Input id="jurusan" value={form.major} onChange={(e) => update("major", e.target.value)} />
              </Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="nip">NIP</FieldLabel>
                <Input id="nip" value={form.nip} onChange={(e) => update("nip", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="bidang">Bidang / Unit</FieldLabel>
                <Input
                  id="bidang"
                  value={form.department}
                  onChange={(e) => update("department", e.target.value)}
                />
              </Field>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="telepon">Nomor Telepon</FieldLabel>
              <Input id="telepon" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="alamat">Alamat</FieldLabel>
              <Input id="alamat" value={form.address} onChange={(e) => update("address", e.target.value)} />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
