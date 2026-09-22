import { useState } from "react"
import { KeyRound, Save, UserRound } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { PageHeader } from "@/components/page-states"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase"
import { ROLE_LABEL, formatDateTime, initials } from "@/lib/format"
import { PASSWORD_HINT, translateAuthError, validatePassword } from "@/lib/password"
import type { StudentOverview } from "@/lib/types"

interface ProfilePageProps {
  overview?: StudentOverview | null
}

export function ProfilePage({ overview }: ProfilePageProps) {
  const { profile, refresh } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name ?? "")
  const [phone, setPhone] = useState(profile?.phone ?? "")
  const [address, setAddress] = useState(profile?.address ?? "")
  const [savingProfile, setSavingProfile] = useState(false)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  if (!profile) return null

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!fullName.trim()) {
      toast.error("Nama lengkap wajib diisi.")
      return
    }
    setSavingProfile(true)
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      })
      .eq("id", profile.id)
    setSavingProfile(false)

    if (error) {
      toast.error("Gagal menyimpan perubahan. Silakan coba lagi.")
      return
    }
    toast.success("Profil berhasil diperbarui.")
    await refresh()
  }

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    const issue = validatePassword(password)
    if (issue) {
      toast.error(issue)
      return
    }
    if (password !== confirmPassword) {
      toast.error("Konfirmasi kata sandi tidak sama.")
      return
    }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSavingPassword(false)

    if (error) {
      toast.error(translateAuthError(error.message))
      return
    }
    setPassword("")
    setConfirmPassword("")
    toast.success("Kata sandi berhasil diubah.")
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profil & Kata Sandi" description="Perbarui data diri dan kata sandi akun Anda." />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <Avatar className="size-14">
            <AvatarFallback className="text-lg">{initials(profile.full_name)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="font-semibold">{profile.full_name}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <p className="text-xs text-muted-foreground">
              Peran: {ROLE_LABEL[profile.role]} - Akun dibuat {formatDateTime(profile.created_at)}
            </p>
          </div>
        </CardContent>
      </Card>

      {overview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data PKL Saya</CardTitle>
            <CardDescription>Data berikut hanya dapat diubah oleh Admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReadOnly label="NIS" value={overview.detail?.nis} />
              <ReadOnly label="Kelas" value={overview.detail?.class_name} />
              <ReadOnly label="Jurusan" value={overview.detail?.major} />
              <ReadOnly label="Perusahaan" value={overview.company?.name} />
              <ReadOnly label="Pembimbing" value={overview.supervisor?.full_name} />
              <ReadOnly label="Periode PKL" value={overview.period?.name} />
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4" /> Data Diri
            </CardTitle>
            <CardDescription>Perubahan langsung tersimpan ke akun Anda.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={saveProfile}>
              <Field>
                <FieldLabel htmlFor="nama">Nama Lengkap</FieldLabel>
                <Input id="nama" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="telepon">Nomor Telepon</FieldLabel>
                <Input
                  id="telepon"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="08xxxxxxxxxx"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="alamat">Alamat</FieldLabel>
                <Input id="alamat" value={address} onChange={(event) => setAddress(event.target.value)} />
              </Field>
              <Button type="submit" disabled={savingProfile}>
                <Save />
                {savingProfile ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4" /> Ubah Kata Sandi
            </CardTitle>
            <CardDescription>Gunakan kata sandi yang kuat dan mudah Anda ingat.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={savePassword}>
              <Field>
                <FieldLabel htmlFor="sandi-baru">Kata Sandi Baru</FieldLabel>
                <Input
                  id="sandi-baru"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <FieldDescription>{PASSWORD_HINT}</FieldDescription>
              </Field>
              <Separator />
              <Field>
                <FieldLabel htmlFor="sandi-ulang">Konfirmasi Kata Sandi</FieldLabel>
                <Input
                  id="sandi-ulang"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </Field>
              <Button type="submit" variant="secondary" disabled={savingPassword}>
                {savingPassword ? "Menyimpan..." : "Ubah Kata Sandi"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ReadOnly({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value || "-"}</dd>
    </div>
  )
}
